#!/usr/bin/env node
// Rechnet durch, wie viele Wiederholungen pro Tag anfallen, wenn täglich eine Haltestelle dazukommt.
// Aufruf: node tools/simulate-reviews.mjs
// Grundlage der Zahlen in docs/02-spezifikation.md, Abschnitt 5.2. Regeln wie dort beschrieben:
// richtig = ein Fach höher, falsch = Fach 1 und morgen fällig, niedrigstes Fach zuerst.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "units");
const sizes = readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")).items.length);

const INTERVAL = { 1: 0, 2: 1, 3: 3, 4: 6, 5: 12 };

function simulate(cap, wrongEvery) {
  const cards = [];
  const days = [];
  let answers = 0;
  const isWrong = () => wrongEvery > 0 && ++answers % wrongEvery === 0;
  for (let day = 1; day <= sizes.length + 1; day++) {
    const due = cards.filter((c) => c.due <= day).sort((a, b) => a.box - b.box || a.due - b.due);
    const todo = due.slice(0, cap);
    for (const c of todo) {
      if (isWrong()) { c.box = 1; c.due = day + 1; }
      else { c.box = Math.min(c.box + 1, 5); c.due = day + INTERVAL[c.box]; }
    }
    const fresh = sizes[day - 1] ?? 0; // Abschlussrunde der neuen Haltestelle
    for (let i = 0; i < fresh; i++) cards.push(isWrong() ? { box: 1, due: day + 1 } : { box: 2, due: day + 1 });
    days.push({ tag: day, neu: fresh, wiederholt: todo.length, rueckstand: due.length - todo.length });
  }
  return days;
}

for (const cap of [30, 40]) {
  for (const wrongEvery of [0, 5]) {
    console.log(`\nGrenze ${cap} Karten, ${wrongEvery ? "jede 5. Antwort falsch" : "alle Antworten richtig"}`);
    console.table(simulate(cap, wrongEvery));
  }
}
