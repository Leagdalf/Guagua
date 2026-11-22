// Zeilen und Abschnitte des Sprachführers: reine Funktionen. Sätze und Lernkarten sehen in der Liste gleich aus,
// nur ein Satzmuster zeigt zusätzlich seinen Beispielsatz (docs/02-spezifikation.md, 2.9 Punkt 1).

import { speakTextOf } from "../../core/tasks";
import type { Example, Item, Phrase, PhraseCategory, Unit } from "../../core/types";
import { FAVORITES_CATEGORY_ID, FAVORITES_TITLE } from "./favorites";
import { itemMatches, phraseMatches, searchItems, searchPhrasebook } from "./search";

export const COURSE_SECTION_ID = "kurs";
export const COURSE_SECTION_TITLE = "Aus dem Kurs";

export interface PhraseRow {
  /** Satz-id oder Karten-id, so wie sie in `favorites` steht. */
  id: string;
  /** Spanisch in der Zeile: der Satz, das Wort oder bei einem Satzmuster das Muster. */
  es: string;
  de: string;
  note_de?: string;
  /** Nur bei Satzmustern: der Beispielsatz, der gesprochen und im Vollbild gezeigt wird. */
  example?: Example;
  /** Text für Anhören und Zeigen. */
  speakText: string;
  /** Satz für das Vollbild (Spanisch groß, Deutsch klein). */
  show: { es: string; de: string };
  /** Nur bei Karten aus dem Kurs: die Haltestelle. */
  origin?: { stop: number; title_es: string };
}

export interface Section {
  id: string;
  title_de: string;
  note_de?: string;
  rows: PhraseRow[];
}

export function phraseRow(phrase: Phrase): PhraseRow {
  return {
    id: phrase.id,
    es: phrase.es,
    de: phrase.de,
    ...(phrase.note_de ? { note_de: phrase.note_de } : {}),
    speakText: phrase.es,
    show: { es: phrase.es, de: phrase.de },
  };
}

export function itemRow(item: Item, unit: Pick<Unit, "stop" | "title_es"> | undefined): PhraseRow {
  const speakText = speakTextOf(item);
  const frame = item.kind === "frame" && item.example ? item.example : undefined;
  return {
    id: item.id,
    es: item.es,
    de: item.de,
    ...(item.note_de ? { note_de: item.note_de } : {}),
    ...(frame ? { example: frame } : {}),
    speakText,
    show: { es: speakText, de: frame ? frame.de : item.de },
    ...(unit ? { origin: { stop: unit.stop, title_es: unit.title_es } } : {}),
  };
}

export interface SectionsInput {
  categories: readonly PhraseCategory[];
  items: readonly Item[];
  unitOfItem: (itemId: string) => Pick<Unit, "stop" | "title_es"> | undefined;
  /** Gemerkte ids (Sätze und Karten). `null`: kein Profil, dann keine Kategorie „Gemerkt“. */
  favorites: readonly string[] | null;
  query: string;
}

export interface SectionsResult {
  /** Gemerkt (falls vorhanden), dann die Kategorien des Sprachführers mit ihren Treffern. */
  sections: Section[];
  /** „Aus dem Kurs“: Karten, die zur Suche passen. `null` ohne Suchwort oder ohne Treffer. */
  course: Section | null;
}

export function buildSections({ categories, items, unitOfItem, favorites, query }: SectionsInput): SectionsResult {
  const sections: Section[] = [];

  if (favorites) {
    const marked = new Set(favorites);
    const phrases = categories.flatMap((category) => category.phrases.filter((p) => marked.has(p.id) && phraseMatches(p, query)));
    const cards = items.filter((item) => marked.has(item.id) && itemMatches(item, query));
    const rows = [...phrases.map(phraseRow), ...cards.map((item) => itemRow(item, unitOfItem(item.id)))];
    if (rows.length > 0) sections.push({ id: FAVORITES_CATEGORY_ID, title_de: FAVORITES_TITLE, rows });
  }

  for (const category of searchPhrasebook(categories, query)) {
    sections.push({
      id: category.id,
      title_de: category.title_de,
      ...(category.note_de ? { note_de: category.note_de } : {}),
      rows: category.phrases.map(phraseRow),
    });
  }

  const hits = searchItems(items, query);
  const course: Section | null =
    hits.length === 0
      ? null
      : { id: COURSE_SECTION_ID, title_de: COURSE_SECTION_TITLE, rows: hits.map((item) => itemRow(item, unitOfItem(item.id))) };

  return { sections, course };
}
