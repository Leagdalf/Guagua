// Aufgaben erzeugen und auswerten (docs/02-spezifikation.md, 2.4).
// Aufgabentypen heißen wie `TaskType` in types.ts. Alles reine Funktionen, Zufall wird hineingereicht.

import { checkWritten } from "./answer";
import {
  CHOICE_OPTION_COUNT,
  MAX_WRITE_TASKS_PER_ROUND,
  NEW_CARDS_BLOCK_SIZE,
  REVIEW_TASK_BY_BOX,
  SAY_TASK_ENABLED,
  WRITE_EXCLUDED_ITEM_IDS,
  WRITE_TASK_ENABLED,
} from "./config";
import { allItems, getItem, getUnit, units } from "./content";
import { shuffle } from "./random";
import type { Rng } from "./random";
import type { Box, Example, Item, TaskType } from "./types";

/** Umgebung der Aufgabenerzeugung. */
export interface TaskEnv {
  /** Gibt es eine spanische Stimme? Ohne wird aus „listen“ „recognize“. */
  hasSpanishVoice: boolean;
  /** Ist „Schreiben“ freigeschaltet? Standard: `WRITE_TASK_ENABLED` aus config.ts. */
  writeEnabled?: boolean;
  /** Ist „Sag es laut“ freigeschaltet? Standard: `SAY_TASK_ENABLED` aus config.ts. */
  sayEnabled?: boolean;
}

export type ChoiceTaskType = "recognize" | "listen" | "recall" | "cloze";

/** Auswahlaufgabe: Erkennen, Hören, Erinnern, Lücke. */
export interface ChoiceTask {
  kind: "choice";
  /** Eindeutig je Karte und Typ, zum Beispiel `recognize:u01-i03`. */
  id: string;
  type: ChoiceTaskType;
  /** Karte, deren Fach die Antwort ändert. `null` bei Lücken. */
  itemId: string | null;
  /** Fragetext. `null` bei „listen“: nur Ton. */
  prompt: string | null;
  promptLang: "es" | "de";
  /** Spanischer Text für den Tonknopf (bei Satzmustern der Beispielsatz, bei Lücken der ganze Satz). */
  speak: string;
  /** Beispielsatz bei Satzmustern, so wie er während der Frage gezeigt wird. Bei „listen“ fehlt er (der Ton ist der Beispielsatz). */
  exampleHint?: { text: string; lang: "es" | "de" };
  /** Deutsche Übersetzung des Lückensatzes. */
  hint?: string;
  options: string[];
  correctIndex: number;
  /** Lösung als Text für die Rückmeldung (bei Lücken der ganze Satz). */
  solution: string;
  note?: string;
  /** Voller Beispielsatz für die Rückmeldung. */
  example?: Example;
}

/** Schreiben: Deutsch lesen, Spanisch tippen. Nie für Satzmuster. */
export interface WriteTask {
  kind: "write";
  id: string;
  type: "write";
  itemId: string;
  prompt: string;
  promptLang: "de";
  speak: string;
  solution: string;
  note?: string;
}

/**
 * „Sag es laut“: Deutsch lesen, laut sagen, aufdecken, die Lösung hören, dann „Saß“ (richtig) oder „Noch mal“ (falsch).
 * Nie für Satzmuster und nie für Karten der Ausschlussliste.
 */
export interface SayTask {
  kind: "say";
  id: string;
  type: "say";
  itemId: string;
  prompt: string;
  promptLang: "de";
  /** Spanischer Text der Lösung: wird beim Aufdecken gesprochen. */
  speak: string;
  solution: string;
  note?: string;
}

/** Satzbau: Bausteine in die richtige Reihenfolge tippen. */
export interface BuildTask {
  kind: "build";
  id: string;
  type: "build";
  itemId: null;
  /** Deutscher Satz. */
  prompt: string;
  promptLang: "de";
  /** Gemischte Bausteine. Gleiche Bausteine unterscheidet die Oberfläche über den Index. */
  tokens: string[];
  /** Bausteine in richtiger Reihenfolge. */
  answer: string[];
  /** Lösung als Satz. */
  solution: string;
  speak: string;
}

/** Paare: Spanisch und Deutsch zuordnen. Zusammengehörig sind gleiche `itemId`. Ändert keine Fächer. */
export interface PairsTask {
  kind: "pairs";
  id: string;
  type: "pairs";
  /** Karten des Blocks in Kursreihenfolge. */
  pairs: { itemId: string; es: string; de: string }[];
  /** `itemId`s in gemischter Reihenfolge der spanischen Spalte. */
  esOrder: string[];
  /** `itemId`s in gemischter Reihenfolge der deutschen Spalte. */
  deOrder: string[];
}

/** Aufgaben, die in einer Runde (Wiederholen, Abschlussrunde) nacheinander kommen. */
export type RoundTask = ChoiceTask | WriteTask | SayTask | BuildTask;
export type Task = RoundTask | PairsTask;

export interface Feedback {
  correct: boolean;
  /** Bei „accent“: richtig, aber der Akzent fehlte. Dann `accentHint` zeigen. */
  verdict: "correct" | "accent" | "wrong";
  /** Die richtige Schreibweise, wenn nur ein Akzent fehlte. */
  accentHint: string | null;
  solution: string;
  /** Gewählte oder getippte Antwort. */
  chosen: string | null;
  note: string | null;
  example: Example | null;
}

// ---------- Hilfen ----------

/** Text, der bei einer Karte vorgelesen wird: bei Satzmustern der Beispielsatz. */
export function speakTextOf(item: Item): string {
  return item.kind === "frame" && item.example ? item.example.es : item.es;
}

const unitIndexOfItem = new Map<string, number>();
units.forEach((unit, index) => unit.items.forEach((item) => unitIndexOfItem.set(item.id, index)));

const textKey = (text: string): string => text.trim().toLowerCase();

/**
 * Falsche Antworten: aus derselben Einheit, dort möglichst gleiche Kartenart, danach aus den Nachbareinheiten
 * (näher zuerst, gleiche Kartenart zuerst). Keine zwei gleichen Texte, nie der Text der richtigen Antwort.
 */
function pickDistractors(item: Item, field: "es" | "de", rng: Rng, count: number): string[] {
  const home = unitIndexOfItem.get(item.id) ?? 0;
  const groups = new Map<number, Item[]>();
  for (const other of allItems) {
    if (other.id === item.id) continue;
    const distance = Math.abs((unitIndexOfItem.get(other.id) ?? 0) - home);
    // Gleiche Einheit (beide Arten) kommt vor jeder Nachbareinheit.
    const rank = distance === 0 ? (other.kind === item.kind ? 0 : 1) : distance * 2 + (other.kind === item.kind ? 0 : 1);
    const list = groups.get(rank);
    if (list) list.push(other);
    else groups.set(rank, [other]);
  }
  const seen = new Set<string>([textKey(item[field])]);
  const picked: string[] = [];
  for (const rank of [...groups.keys()].sort((a, b) => a - b)) {
    for (const other of shuffle(groups.get(rank) ?? [], rng)) {
      const key = textKey(other[field]);
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(other[field]);
      if (picked.length === count) return picked;
    }
  }
  return picked;
}

// ---------- Aufgaben je Karte ----------

const excludedFromWriting = new Set(WRITE_EXCLUDED_ITEM_IDS);

/** Darf die Karte als „Schreiben“ oder „Sag es laut“ kommen? Nicht Satzmuster und nicht die Karten der Ausschlussliste (2.4). */
export function isWritable(item: Item): boolean {
  return item.kind !== "frame" && !excludedFromWriting.has(item.id);
}

/**
 * Welcher Aufgabentyp beim Wiederholen für eine Karte in diesem Fach kommt (2.4 und 2.9, Punkt 5).
 * Ab Fach 3 gilt für Wörter und Wendungen: „Schreiben“, solange `writesSoFar` unter `MAX_WRITE_TASKS_PER_ROUND` liegt,
 * danach „Sag es laut“ (oder „Erinnern“, wenn `SAY_TASK_ENABLED` aus ist). Satzmuster und Karten der Ausschlussliste: „Erinnern“.
 * `writesSoFar`: Zahl der Schreibaufgaben, die die Runde schon hat.
 */
export function taskTypeForReview(item: Item, box: Box, env: TaskEnv, writesSoFar = 0): TaskType {
  let type: TaskType = REVIEW_TASK_BY_BOX[box];
  if (type === "write") {
    if (!isWritable(item) || !(env.writeEnabled ?? WRITE_TASK_ENABLED)) type = "recall";
    else if (writesSoFar >= MAX_WRITE_TASKS_PER_ROUND) type = env.sayEnabled ?? SAY_TASK_ENABLED ? "say" : "recall";
  }
  if (type === "listen" && !env.hasSpanishVoice) type = "recognize";
  return type;
}

/**
 * Baut die Aufgabe zu einer Karte. Satzmuster und Karten der Ausschlussliste werden nie zu „write“ oder „say“ (dann „recall“),
 * ohne Stimme wird „listen“ zu „recognize“.
 * Andere Typen als recognize, listen, recall, write, say sind für Karten nicht vorgesehen und führen zu „recognize“.
 */
export function makeItemTask(item: Item, type: TaskType, rng: Rng, env: Pick<TaskEnv, "hasSpanishVoice">): ChoiceTask | WriteTask | SayTask {
  let kind: TaskType = type;
  if ((kind === "write" || kind === "say") && !isWritable(item)) kind = "recall";
  if (kind === "listen" && !env.hasSpanishVoice) kind = "recognize";
  if (kind !== "recognize" && kind !== "listen" && kind !== "recall" && kind !== "write" && kind !== "say") kind = "recognize";
  const speak = speakTextOf(item);
  const note = item.note_de;

  if (kind === "say") {
    return {
      kind: "say",
      id: `say:${item.id}`,
      type: "say",
      itemId: item.id,
      prompt: item.de,
      promptLang: "de",
      speak,
      solution: item.es,
      ...(note ? { note } : {}),
    };
  }

  if (kind === "write") {
    return {
      kind: "write",
      id: `write:${item.id}`,
      type: "write",
      itemId: item.id,
      prompt: item.de,
      promptLang: "de",
      speak,
      solution: item.es,
      ...(note ? { note } : {}),
    };
  }

  // Richtung: recognize und listen fragen Deutsch ab, recall fragt Spanisch ab.
  const answerField = kind === "recall" ? "es" : "de";
  const answer = item[answerField];
  const options = shuffle([answer, ...pickDistractors(item, answerField, rng, CHOICE_OPTION_COUNT - 1)], rng);

  const task: ChoiceTask = {
    kind: "choice",
    id: `${kind}:${item.id}`,
    type: kind,
    itemId: item.id,
    prompt: kind === "listen" ? null : kind === "recall" ? item.de : item.es,
    promptLang: kind === "recall" ? "de" : "es",
    speak,
    options,
    correctIndex: options.indexOf(answer),
    solution: answer,
  };
  if (item.kind === "frame" && item.example && kind !== "listen") {
    task.exampleHint = kind === "recall" ? { text: item.example.de, lang: "de" } : { text: item.example.es, lang: "es" };
  }
  if (item.example) task.example = item.example;
  if (note) task.note = note;
  return task;
}

/** Aufgabe zu einer Karte beim Wiederholen: Typ nach Fach (`writesSoFar` wie bei `taskTypeForReview`). */
export function makeReviewTask(itemId: string, box: Box, rng: Rng, env: TaskEnv, writesSoFar = 0): ChoiceTask | WriteTask | SayTask {
  const item = getItem(itemId);
  if (!item) throw new Error(`Unbekannte Karte ${itemId}`);
  return makeItemTask(item, taskTypeForReview(item, box, env, writesSoFar), rng, env);
}

// ---------- Aufgaben je Einheit ----------

/** Neue Karten in Blöcken zu vier (der letzte Block kann kleiner sein), je Block die Paare-Aufgabe. */
export function buildNewCardBlocks(unitId: string, rng: Rng): { items: Item[]; pairs: PairsTask }[] {
  const unit = getUnit(unitId);
  if (!unit) throw new Error(`Unbekannte Einheit ${unitId}`);
  const blocks: { items: Item[]; pairs: PairsTask }[] = [];
  for (let start = 0; start < unit.items.length; start += NEW_CARDS_BLOCK_SIZE) {
    const items = unit.items.slice(start, start + NEW_CARDS_BLOCK_SIZE);
    const ids = items.map((item) => item.id);
    blocks.push({
      items,
      pairs: {
        kind: "pairs",
        id: `pairs:${unitId}:${start / NEW_CARDS_BLOCK_SIZE + 1}`,
        type: "pairs",
        pairs: items.map((item) => ({ itemId: item.id, es: item.es, de: item.de })),
        esOrder: shuffle(ids, rng),
        deOrder: shuffle(ids, rng),
      },
    });
  }
  return blocks;
}

/** Die Lückensätze einer Einheit (Schritt 3), Antworten gemischt. */
export function buildClozeTasks(unitId: string, rng: Rng): ChoiceTask[] {
  const unit = getUnit(unitId);
  if (!unit) throw new Error(`Unbekannte Einheit ${unitId}`);
  return unit.cloze.map((cloze) => {
    const options = shuffle([...new Set(cloze.options)], rng);
    const sentence = cloze.es.replace("___", cloze.answer);
    return {
      kind: "choice",
      id: `cloze:${cloze.id}`,
      type: "cloze",
      itemId: null,
      prompt: cloze.es,
      promptLang: "es",
      speak: sentence,
      hint: cloze.de,
      options,
      correctIndex: options.indexOf(cloze.answer),
      solution: sentence,
    };
  });
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((token, i) => token === b[i]);
}

/** Die Satzbau-Aufgaben einer Einheit (Schritt 5). Die gemischte Reihenfolge ist nie schon die Lösung, sofern es eine andere gibt. */
export function buildBuildTasks(unitId: string, rng: Rng): BuildTask[] {
  const unit = getUnit(unitId);
  if (!unit) throw new Error(`Unbekannte Einheit ${unitId}`);
  return unit.build.map((build) => {
    let tokens = shuffle(build.tokens, rng);
    for (let attempt = 0; attempt < 20 && sameOrder(tokens, build.tokens); attempt++) tokens = shuffle(build.tokens, rng);
    const solution = build.tokens.join(" ");
    return {
      kind: "build",
      id: `build:${build.id}`,
      type: "build",
      itemId: null,
      prompt: build.de,
      promptLang: "de",
      tokens,
      answer: build.tokens.slice(),
      solution,
      speak: solution,
    };
  });
}

/** Abschlussrunde (Schritt 5): jede neue Karte einmal als „Erkennen“, danach die Satzbau-Aufgaben. */
export function buildFinalRoundTasks(unitId: string, rng: Rng, env: Pick<TaskEnv, "hasSpanishVoice">): RoundTask[] {
  const unit = getUnit(unitId);
  if (!unit) throw new Error(`Unbekannte Einheit ${unitId}`);
  const cards = shuffle(unit.items, rng).map((item) => makeItemTask(item, "recognize", rng, env));
  return [...cards, ...buildBuildTasks(unitId, rng)];
}

// ---------- Auswerten ----------

function feedback(
  correct: boolean,
  verdict: Feedback["verdict"],
  solution: string,
  chosen: string | null,
  note: string | undefined,
  example: Example | undefined,
  accentHint: string | null = null,
): Feedback {
  return { correct, verdict, accentHint, solution, chosen, note: note ?? null, example: example ?? null };
}

/** Auswahl bewertet. */
export function evaluateChoice(task: ChoiceTask, index: number): Feedback {
  const correct = index === task.correctIndex;
  return feedback(correct, correct ? "correct" : "wrong", task.solution, task.options[index] ?? null, task.note, task.example);
}

/** Getippte Antwort bewertet. „esta“ für „está“ ist richtig mit `accentHint`, „manana“ für „mañana“ ist falsch. */
export function evaluateWrite(task: WriteTask, text: string): Feedback {
  const check = checkWritten(text, task.solution);
  return feedback(
    check.correct,
    check.verdict,
    task.solution,
    text,
    task.note,
    undefined,
    check.verdict === "accent" ? task.solution : null,
  );
}

/** „Weiß ich nicht“: zeigt die Lösung, zählt als falsch. */
export function giveUpWrite(task: WriteTask): Feedback {
  return feedback(false, "wrong", task.solution, null, task.note, undefined);
}

/** „Meine Antwort stimmt auch“: macht aus einer als falsch erkannten Eingabe eine richtige. Andere Rückmeldungen bleiben, wie sie sind. */
export function acceptWrite(fb: Feedback): Feedback {
  return fb.correct ? fb : { ...fb, correct: true, verdict: "correct" };
}

/** Satzbau bewertet: Die gewählten Bausteine in ihrer Reihenfolge, mit Leerzeichen verbunden, müssen die Lösung ergeben. */
export function evaluateBuild(task: BuildTask, chosen: readonly string[]): Feedback {
  const correct = chosen.join(" ") === task.solution;
  return feedback(correct, correct ? "correct" : "wrong", task.solution, chosen.join(" "), undefined, undefined);
}

/** Paare bewertet: Wahr, wenn spanische und deutsche Kachel zur selben Karte gehören. */
export function isPairMatch(esItemId: string, deItemId: string): boolean {
  return esItemId === deItemId;
}
