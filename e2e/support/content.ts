// Lerninhalte aus content/ für die Tests: Sie lösen Aufgaben richtig (oder gezielt falsch), ohne die App zu fragen.

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "./server";

export interface Item {
  id: string;
  es: string;
  de: string;
  kind: "word" | "phrase" | "frame";
  note_de?: string;
  example?: { es: string; de: string };
}
export interface Cloze {
  id: string;
  es: string;
  answer: string;
  options: string[];
  de: string;
}
export interface Build {
  id: string;
  tokens: string[];
  de: string;
}
export interface DialogueLine {
  speaker: string;
  es: string;
  de: string;
  learner: boolean;
}
export interface Unit {
  id: string;
  stop: number;
  title_es: string;
  title_de: string;
  items: Item[];
  grammar: { topic_de: string };
  dialogue: { setting_de: string; lines: DialogueLine[] };
  cloze: Cloze[];
  build: Build[];
  mission: { id: string; title_de: string; task_de: string; say: string[]; say_de?: string[] };
}
export interface Phrase {
  id: string;
  es: string;
  de: string;
}
export interface PhraseCategory {
  id: string;
  title_de: string;
  note_de?: string;
  phrases: Phrase[];
}

const dir = resolve(ROOT, "content", "units");
export const units: Unit[] = readdirSync(dir)
  .filter((file) => /^u\d+\.json$/.test(file))
  .sort()
  .map((file) => JSON.parse(readFileSync(resolve(dir, file), "utf8")) as Unit);

export const phrasebook: { categories: PhraseCategory[] } = JSON.parse(readFileSync(resolve(ROOT, "content", "phrasebook.json"), "utf8"));

export const allItems: Item[] = units.flatMap((unit) => unit.items);

/** Wort so, wie die App es vorliest: bei Satzmustern der Beispielsatz. */
export function spokenTextOf(item: Item): string {
  return item.kind === "frame" && item.example ? item.example.es : item.es;
}

const norm = (text: string): string => text.trim().toLowerCase();

/** Alle Karten, deren Spanisch (Frage bei „Erkennen“) diesen Text hat. */
export function itemsByEs(text: string): Item[] {
  return allItems.filter((item) => norm(item.es) === norm(text) || (item.example && norm(item.example.es) === norm(text)));
}

/** Alle Karten mit diesem Deutsch (Frage bei „Erinnern“ und „Schreiben“). */
export function itemsByDe(text: string): Item[] {
  return allItems.filter((item) => norm(item.de) === norm(text));
}

export function unitById(id: string): Unit {
  const unit = units.find((candidate) => candidate.id === id);
  if (!unit) throw new Error(`Unbekannte Einheit ${id}`);
  return unit;
}

/** Suchtext wie in der App: klein, ohne Akzente, ß als ss. Dient nur der Gegenrechnung in den Tests. */
export const searchNorm = (text: string): string => text.normalize("NFD").replace(/\p{M}+/gu, "").replaceAll("ß", "ss").toLowerCase();

/** Sätze des Sprachführers, in denen jedes Suchwort in Spanisch oder Deutsch vorkommt. */
export function phraseHits(query: string): Phrase[] {
  const words = searchNorm(query).split(/\s+/).filter(Boolean);
  return phrasebook.categories
    .flatMap((category) => category.phrases)
    .filter((phrase) => words.every((word) => `${searchNorm(phrase.es)} ${searchNorm(phrase.de)}`.includes(word)));
}

/** Lernkarten des Kurses, in denen jedes Suchwort in Spanisch, Deutsch oder im Beispielsatz vorkommt (Suche ab zwei Zeichen). */
export function courseHits(query: string): Item[] {
  const words = searchNorm(query).split(/\s+/).filter(Boolean);
  if (!words.some((word) => word.length >= 2)) return [];
  return allItems.filter((item) => {
    const haystack = [item.es, item.de, item.example?.es ?? "", item.example?.de ?? ""].map(searchNorm).join(" ");
    return words.every((word) => haystack.includes(word));
  });
}

/** Pläne aus content/course.json (Abgleich mit dem Plan). */
export const course: { plan: { first_stop_date: string; last_stop_date: string } } = JSON.parse(
  readFileSync(resolve(ROOT, "content", "course.json"), "utf8"),
);
