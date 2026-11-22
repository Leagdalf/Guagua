#!/usr/bin/env node
// Prüft die Lerninhalte in content/ auf Struktur und innere Stimmigkeit.
// Aufruf: node tools/validate-content.mjs   (ohne Abhängigkeiten, Node 20+)
// Regeln siehe content/SCHEMA.md. Bei Fehlern endet das Skript mit Exit-Code 1.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "content");
const errors = [];
const warn = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

const load = (p) => {
  try {
    return JSON.parse(readFileSync(join(root, p), "utf8"));
  } catch (e) {
    err(p, `nicht lesbar oder kein gültiges JSON (${e.message})`);
    return null;
  }
};

const isStr = (v) => typeof v === "string" && v.trim().length > 0;

// Paarige spanische Satzzeichen: jedes ¿ braucht ein ?, jedes ¡ ein !
function checkPunctuation(where, es) {
  const count = (ch) => [...es].filter((c) => c === ch).length;
  if (count("¿") !== count("?")) err(where, `¿ und ? nicht paarig in „${es}"`);
  if (count("¡") !== count("!")) err(where, `¡ und ! nicht paarig in „${es}"`);
  if (/\s{2,}/.test(es)) err(where, `doppeltes Leerzeichen in „${es}"`);
  if (es !== es.trim()) err(where, `Leerzeichen am Rand in „${es}"`);
}

const course = load("course.json");
const phrasebook = load("phrasebook.json");
const reference = load("reference.json");

const unitFiles = readdirSync(join(root, "units")).filter((f) => f.endsWith(".json")).sort();
const units = unitFiles.map((f) => ({ file: `units/${f}`, data: load(`units/${f}`) })).filter((u) => u.data);

const ids = new Set();
const uniqueId = (where, id) => {
  if (!isStr(id)) return err(where, "id fehlt");
  if (ids.has(id)) err(where, `id doppelt vergeben: ${id}`);
  ids.add(id);
};
const seenEs = new Map();
const seenDe = new Map();
let itemCount = 0;

units.forEach(({ file, data: u }, index) => {
  const w = file;
  uniqueId(w, u.id);
  if (u.id !== `u${String(index + 1).padStart(2, "0")}`) err(w, `id ${u.id} passt nicht zur Reihenfolge`);
  if (u.stop !== index + 1) err(w, `stop ist ${u.stop}, erwartet ${index + 1}`);
  for (const k of ["title_es", "title_de", "can_do_de", "canarias_de"]) if (!isStr(u[k])) err(w, `${k} fehlt`);
  if (isStr(u.title_es)) checkPunctuation(w, u.title_es);

  // Grammatik
  const g = u.grammar ?? {};
  if (!isStr(g.topic_de) || !isStr(g.explanation_de)) err(w, "grammar.topic_de oder explanation_de fehlt");
  if (!Array.isArray(g.table) || g.table.length < 3) err(w, "grammar.table braucht mindestens 3 Zeilen");
  (g.table ?? []).forEach((r, i) => {
    if (!isStr(r.label_de) || !isStr(r.es) || !isStr(r.de)) err(w, `grammar.table[${i}] unvollständig`);
  });
  if (!Array.isArray(g.examples) || g.examples.length < 3) err(w, "grammar.examples braucht mindestens 3 Beispiele");
  (g.examples ?? []).forEach((e, i) => {
    if (!isStr(e.es) || !isStr(e.de)) err(w, `grammar.examples[${i}] unvollständig`);
    else checkPunctuation(`${w} grammar.examples[${i}]`, e.es);
  });

  // Items
  if (!Array.isArray(u.items) || u.items.length < 12 || u.items.length > 16)
    err(w, `items: ${u.items?.length ?? 0} Einträge, erlaubt sind 12 bis 16`);
  (u.items ?? []).forEach((it) => {
    const wi = `${w} ${it.id}`;
    uniqueId(wi, it.id);
    itemCount++;
    if (!it.id?.startsWith(`${u.id}-i`)) err(wi, "Item-id beginnt nicht mit der Unit-id");
    if (!isStr(it.es) || !isStr(it.de)) return err(wi, "es oder de fehlt");
    checkPunctuation(wi, it.es);
    if (!["word", "phrase", "frame"].includes(it.kind)) err(wi, `kind ungültig: ${it.kind}`);
    const hasSlot = it.es.includes("…");
    if (hasSlot !== (it.kind === "frame")) err(wi, "kind frame genau dann, wenn es ein … enthält");
    if (hasSlot !== it.de.includes("…")) err(wi, "… muss in es und de gleichermaßen vorkommen");
    if (it.kind === "frame") {
      if (!it.example || !isStr(it.example.es) || !isStr(it.example.de)) err(wi, "frame braucht example.es und example.de");
      else checkPunctuation(`${wi} example`, it.example.es);
    }
    if (it.es.includes("{") || it.de.includes("{")) err(wi, "Platzhalter {…} sind nur im Dialog erlaubt");
    const keyEs = it.es.toLowerCase();
    const keyDe = it.de.toLowerCase();
    if (seenEs.has(keyEs)) err(wi, `es doppelt (auch in ${seenEs.get(keyEs)}): ${it.es}`);
    if (seenDe.has(keyDe)) err(wi, `de doppelt (auch in ${seenDe.get(keyDe)}): ${it.de}`);
    seenEs.set(keyEs, it.id);
    seenDe.set(keyDe, it.id);
  });

  // Dialog
  const lines = u.dialogue?.lines ?? [];
  if (!isStr(u.dialogue?.setting_de)) err(w, "dialogue.setting_de fehlt");
  if (lines.length < 5 || lines.length > 10) err(w, `dialogue: ${lines.length} Zeilen, erlaubt sind 5 bis 10`);
  if (lines.filter((l) => l.learner).length < 2) err(w, "dialogue braucht mindestens 2 Zeilen der Lernenden");
  lines.forEach((l, i) => {
    const wl = `${w} dialogue[${i}]`;
    if (!isStr(l.speaker) || !isStr(l.es) || !isStr(l.de)) return err(wl, "speaker, es oder de fehlt");
    if (typeof l.learner !== "boolean") err(wl, "learner muss true oder false sein");
    if (l.learner !== (l.speaker === "Tú")) err(wl, "learner ist genau dann true, wenn speaker Tú ist");
    checkPunctuation(wl, l.es);
    const ph = (s) => (s.match(/\{[^}]*\}/g) ?? []).sort().join();
    if (ph(l.es) !== ph(l.de)) err(wl, "Platzhalter in es und de stimmen nicht überein");
    if ((l.es.match(/\{[^}]*\}/g) ?? []).some((p) => p !== "{name}")) err(wl, "einziger erlaubter Platzhalter ist {name}");
    if (i > 0 && lines[i - 1].speaker === l.speaker) err(wl, "zwei Zeilen desselben Sprechers hintereinander");
  });

  // Lückensätze
  if (!Array.isArray(u.cloze) || u.cloze.length < 4) err(w, "cloze braucht mindestens 4 Sätze");
  (u.cloze ?? []).forEach((c) => {
    const wc = `${w} ${c.id}`;
    uniqueId(wc, c.id);
    if (!isStr(c.es) || !isStr(c.de) || !isStr(c.answer)) return err(wc, "es, de oder answer fehlt");
    if ((c.es.match(/___/g) ?? []).length !== 1) err(wc, "es braucht genau eine Lücke ___");
    if (!Array.isArray(c.options) || c.options.length < 2 || c.options.length > 4) err(wc, "2 bis 4 options nötig");
    else {
      if (!c.options.includes(c.answer)) err(wc, "answer steht nicht in options");
      if (new Set(c.options).size !== c.options.length) err(wc, "options enthalten Dubletten");
    }
    checkPunctuation(wc, c.es.replace("___", c.answer));
  });

  // Satzbau
  if (!Array.isArray(u.build) || u.build.length < 3) err(w, "build braucht mindestens 3 Sätze");
  (u.build ?? []).forEach((b) => {
    const wb = `${w} ${b.id}`;
    uniqueId(wb, b.id);
    if (!Array.isArray(b.tokens) || b.tokens.length < 3 || b.tokens.length > 8) err(wb, "3 bis 8 tokens nötig");
    else {
      if (b.tokens.some((t) => !isStr(t) || /\s/.test(t))) err(wb, "tokens dürfen weder leer sein noch Leerzeichen enthalten");
      checkPunctuation(wb, b.tokens.join(" "));
    }
    if (!isStr(b.de)) err(wb, "de fehlt");
  });

  // Mission
  const m = u.mission ?? {};
  uniqueId(`${w} mission`, m.id);
  if (!isStr(m.title_de) || !isStr(m.task_de)) err(w, "mission.title_de oder task_de fehlt");
  if (!Array.isArray(m.say) || m.say.length < 2) err(w, "mission.say braucht mindestens 2 Sätze");
  (m.say ?? []).forEach((s, i) => checkPunctuation(`${w} mission.say[${i}]`, s));
  if (!Array.isArray(m.say_de) || m.say_de.length === 0) err(w, "mission.say_de fehlt oder ist keine Liste");
  else {
    if (m.say_de.length !== (m.say ?? []).length) err(w, `mission.say_de hat ${m.say_de.length} Einträge, say hat ${(m.say ?? []).length}`);
    m.say_de.forEach((s, i) => { if (!isStr(s)) err(w, `mission.say_de[${i}] leer`); });
  }

  (u.tips_de ?? []).forEach((t, i) => { if (!isStr(t)) err(w, `tips_de[${i}] leer`); });
});

// Kurs
if (course) {
  const listed = course.units ?? [];
  const actual = units.map((u) => u.data.id);
  if (JSON.stringify(listed) !== JSON.stringify(actual)) err("course.json", `units ${JSON.stringify(listed)} passt nicht zu den Dateien ${JSON.stringify(actual)}`);
}

// Sprachführer
let phraseCount = 0;
if (phrasebook) {
  const cats = phrasebook.categories ?? [];
  if (cats.length < 1) err("phrasebook.json", "keine Kategorien");
  cats.forEach((c) => {
    uniqueId(`phrasebook ${c.id}`, c.id);
    if (!isStr(c.title_de)) err(`phrasebook ${c.id}`, "title_de fehlt");
    (c.phrases ?? []).forEach((p) => {
      uniqueId(`phrasebook ${p.id}`, p.id);
      phraseCount++;
      if (!isStr(p.es) || !isStr(p.de)) return err(`phrasebook ${p.id}`, "es oder de fehlt");
      checkPunctuation(`phrasebook ${p.id}`, p.es);
      if (p.es.includes("…") !== p.de.includes("…")) err(`phrasebook ${p.id}`, "… muss in es und de gleichermaßen vorkommen");
    });
  });
}

// Nachschlagen
if (reference) {
  const nums = reference.numbers ?? [];
  if (nums.length !== 101) err("reference.json", `numbers: ${nums.length} Einträge, erwartet 101 (0 bis 100)`);
  nums.forEach((n, i) => {
    if (n.n !== i) err("reference.json", `numbers[${i}].n ist ${n.n}`);
    if (!isStr(n.es)) err("reference.json", `numbers[${i}].es fehlt`);
  });
  if (new Set(nums.map((n) => n.es)).size !== nums.length) err("reference.json", "numbers enthält doppelte Zahlwörter");
  if ((reference.weekdays ?? []).length !== 7) err("reference.json", "weekdays braucht 7 Einträge");
}

if (units.length < 1) err("content/units", "keine Einheiten gefunden");
if (warn.length) console.warn(warn.map((w) => `Hinweis: ${w}`).join("\n"));
if (errors.length) {
  console.error(errors.map((e) => `FEHLER ${e}`).join("\n"));
  console.error(`\n${errors.length} Fehler in den Lerninhalten.`);
  process.exit(1);
}
console.log(`Inhalte in Ordnung: ${units.length} Einheiten, ${itemCount} Lernkarten, ${phraseCount} Sprachführer-Sätze, ${ids.size} eindeutige ids.`);
