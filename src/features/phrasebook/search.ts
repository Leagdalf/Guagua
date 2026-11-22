// Suche im Sprachführer: reine Funktion, ohne Rücksicht auf Akzente und Groß- und Kleinschreibung,
// über Spanisch und Deutsch (docs/02-spezifikation.md, Abschnitt 2.6).

import type { Phrase, PhraseCategory } from "../../core/types";

/** Kleinschreibung, ohne Akzente und Umlaute-Punkte, ß als ss. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replaceAll("ß", "ss")
    .toLowerCase();
}

/** Jedes Wort der Suche muss in Spanisch oder Deutsch des Satzes vorkommen. Leere Suche passt auf alles. */
export function phraseMatches(phrase: Pick<Phrase, "es" | "de">, query: string): boolean {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
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
