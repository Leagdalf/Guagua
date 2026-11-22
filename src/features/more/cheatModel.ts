// Inhalte des Spickzettels (docs/02-spezifikation.md, 2.7). Reine Funktionen, kein React.

import { oftenWrongCards } from "../../core/cards";
import { reference, units } from "../../core/content";
import type { Grammar, Item, Progress, Unit } from "../../core/types";

/** Satz statt einer leeren Liste, solange keine Haltestelle begonnen ist. */
export const NO_GRAMMAR_TEXT = "Sobald du eine Haltestelle beginnst, stehen hier ihre Grammatiktabellen.";

export interface CheatGrammar {
  unitId: string;
  stop: number;
  titleEs: string;
  titleDe: string;
  grammar: Grammar;
}

/** Grammatik der begonnenen Haltestellen in Kursreihenfolge. Begonnen heißt: `progress.units` kennt die Haltestelle. */
export function startedGrammar(progress: Progress, all: readonly Unit[] = units): CheatGrammar[] {
  return all
    .filter((unit) => progress.units[unit.id] !== undefined)
    .map((unit) => ({ unitId: unit.id, stop: unit.stop, titleEs: unit.title_es, titleDe: unit.title_de, grammar: unit.grammar }));
}

/** „Oft falsch“ (Spezifikation 2.9, Punkt 6): die Karten aus `oftenWrongCards` (src/core/cards.ts), höchstens zehn, jede mindestens zweimal falsch. */
export function oftenWrongItems(progress: Progress): Item[] {
  return oftenWrongCards(progress).map((entry) => entry.item);
}

/** Die Zahlen 0 bis 100. */
export function numberRows(): { n: number; es: string }[] {
  return reference.numbers;
}

/** Die sieben Wochentage. */
export function weekdayRows(): { es: string; de: string }[] {
  return reference.weekdays;
}

/** Aussprachehinweise aus Haltestelle 1. */
export function pronunciationTips(all: readonly Unit[] = units): string[] {
  return all[0]?.tips_de ?? [];
}
