// Gemerkte Sätze im Sprachführer: reine Funktionen und der eine Aufruf an den Speicher.

import { toggleFavorite } from "../../core/progress";
import type { ProgressStore } from "../../core/store";
import type { PhraseCategory } from "../../core/types";

export const FAVORITES_CATEGORY_ID = "gemerkt";
export const FAVORITES_TITLE = "Gemerkt";

/**
 * Setzt die Kategorie „Gemerkt“ an den Anfang, sobald mindestens ein Satz gemerkt ist. Die Sätze bleiben zusätzlich in ihrer
 * Kategorie. Reihenfolge wie im Sprachführer. Unbekannte ids werden ignoriert. Ohne gemerkte Sätze kommt die Liste unverändert zurück.
 */
export function withFavorites(categories: readonly PhraseCategory[], favorites: readonly string[]): PhraseCategory[] {
  const marked = new Set(favorites);
  const phrases = categories.flatMap((category) => category.phrases.filter((phrase) => marked.has(phrase.id)));
  if (phrases.length === 0) return [...categories];
  return [{ id: FAVORITES_CATEGORY_ID, title_de: FAVORITES_TITLE, phrases }, ...categories];
}

/** Merkt den Satz oder entfernt ihn wieder. Der Speicher schreibt sofort, es bleibt also nach dem Neuladen erhalten. */
export function toggleFavoriteInStore(store: Pick<ProgressStore, "update">, id: string): void {
  store.update((progress) => toggleFavorite(progress, id));
}
