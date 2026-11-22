// Suche im Sprachführer: reine Funktionen, ohne Rücksicht auf Akzente und Groß- und Kleinschreibung,
// über Spanisch und Deutsch (docs/02-spezifikation.md, Abschnitte 2.6 und 2.9).

import type { Item, Phrase, PhraseCategory } from "../../core/types";

/** Kleinschreibung, ohne Akzente und Umlaute-Punkte, ß als ss. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replaceAll("ß", "ss")
    .toLowerCase();
}

function wordsOf(query: string): string[] {
  return normalizeForSearch(query).split(/\s+/).filter(Boolean);
}

/** Jedes Wort der Suche muss in Spanisch oder Deutsch des Satzes vorkommen. Leere Suche passt auf alles. */
export function phraseMatches(phrase: Pick<Phrase, "es" | "de">, query: string): boolean {
  const words = wordsOf(query);
  if (words.length === 0) return true;
  const haystack = `${normalizeForSearch(phrase.es)} ${normalizeForSearch(phrase.de)}`;
  return words.every((word) => haystack.includes(word));
}

/** Kategorien mit nur den passenden Sätzen. Kategorien ohne Treffer fallen weg. */
export function searchPhrasebook(categories: readonly PhraseCategory[], query: string): PhraseCategory[] {
  return categories
    .map((category) => ({ ...category, phrases: category.phrases.filter((phrase) => phraseMatches(phrase, query)) }))
    .filter((category) => category.phrases.length > 0);
}

/** Eine Lernkarte passt, wenn jedes Suchwort in Spanisch, Deutsch oder im Beispielsatz (beide Sprachen) vorkommt. Leere Suche passt auf alles. */
export function itemMatches(item: Pick<Item, "es" | "de" | "example">, query: string): boolean {
  const words = wordsOf(query);
  if (words.length === 0) return true;
  const parts = [item.es, item.de, item.example?.es ?? "", item.example?.de ?? ""];
  const haystack = parts.map(normalizeForSearch).join(" ");
  return words.every((word) => haystack.includes(word));
}

/** Passende Lernkarten in der Reihenfolge der Eingabe. Ohne Suchwort kommt nichts zurück: Karten erscheinen nur bei einer Suche. */
export function searchItems<T extends Pick<Item, "es" | "de" | "example">>(items: readonly T[], query: string): T[] {
  if (wordsOf(query).length === 0) return [];
  return items.filter((item) => itemMatches(item, query));
}
