// Karteikasten (docs/02-spezifikation.md, 5.1 und 5.2).

import { BOX_INTERVAL_DAYS, EXTRA_ROUND_CARDS, MAX_BOX, POINTS, REVIEW_ROUND, WRONG_ANSWER } from "./config";
import { allItems, unitOfItem } from "./content";
import { addPoints, updateStreakAfterReview } from "./stats";
import { addDays } from "./time";
import type { Box, CardProgress, Day, Progress } from "./types";

/** Neue Karte nach Schritt 2: Fach 1, heute fällig. */
export function newCard(today: Day): CardProgress {
  return { box: 1, due: today, right: 0, wrong: 0, lastSeen: today };
}

/** Richtig: ein Fach höher (höchstens 5), fällig heute plus Abstand des neuen Fachs. Falsch: Fach 1, morgen fällig. */
export function gradeCard(card: CardProgress, correct: boolean, today: Day): CardProgress {
  if (correct) {
    const box = Math.min(card.box + 1, MAX_BOX) as Box;
    return { ...card, box, due: addDays(today, BOX_INTERVAL_DAYS[box]), right: card.right + 1, lastSeen: today };
  }
  return {
    ...card,
    box: WRONG_ANSWER.box,
    due: addDays(today, WRONG_ANSWER.dueInDays),
    wrong: card.wrong + 1,
    lastSeen: today,
  };
}

/**
 * Verbucht die erste Antwort auf eine Karte: Fach und Fälligkeit, 10 Punkte bei richtig, Serie.
 * Legt die Karte an, falls sie noch fehlt.
 */
export function recordCardAnswer(progress: Progress, itemId: string, correct: boolean, today: Day): Progress {
  const card = gradeCard(progress.cards[itemId] ?? newCard(today), correct, today);
  let next: Progress = { ...progress, cards: { ...progress.cards, [itemId]: card } };
  if (correct) next = addPoints(next, POINTS.correctAnswer);
  return updateStreakAfterReview(next, today);
}

/**
 * Antwort in der freien Runde („10 Karten extra“): reine Übung. Kein Fach, keine Fälligkeit, keine Punkte.
 * Nur `lastSeen` wird heute, damit die Karte für die Serie zählt (5.3).
 */
export function recordPracticeAnswer(progress: Progress, itemId: string, today: Day): Progress {
  const card = progress.cards[itemId];
  if (!card) return progress;
  const next: Progress = { ...progress, cards: { ...progress.cards, [itemId]: { ...card, lastSeen: today } } };
  return updateStreakAfterReview(next, today);
}

const itemOrder =new Map(allItems.map((item, index) => [item.id, index]));

/** Wiederholt wird nur, was zu einer abgeschlossenen Haltestelle gehört. Neue Karten laufen über die Abschlussrunde. */
function learnedCards(progress: Progress): [string, CardProgress][] {
  return Object.entries(progress.cards).filter(([id]) => {
    const unit = unitOfItem(id);
    return unit !== undefined && progress.units[unit.id]?.completedAt !== undefined;
  });
}

function byBoxThenDue([idA, a]: [string, CardProgress], [idB, b]: [string, CardProgress]): number {
  return (
    a.box - b.box ||
    (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) ||
    (itemOrder.get(idA) ?? 0) - (itemOrder.get(idB) ?? 0)
  );
}

/** Alle fälligen Karten (due <= heute), niedrigstes Fach zuerst, dann ältestes Fälligkeitsdatum, dann Kursreihenfolge. */
export function dueCardIds(progress: Progress, today: Day): string[] {
  return learnedCards(progress)
    .filter(([, card]) => card.due <= today)
    .sort(byBoxThenDue)
    .map(([id]) => id);
}

/** Karten der Wiederholrunde: die fälligen, höchstens `limit` (Standard 40). Der Rest bleibt fällig. */
export function reviewRoundIds(progress: Progress, today: Day, limit: number = REVIEW_ROUND.maxCards): string[] {
  return dueCardIds(progress, today).slice(0, limit);
}

/** Freie Runde „10 Karten extra“: erst die fälligen, dann die übrigen gelernten nach Fach und Fälligkeit. */
export function extraRoundIds(progress: Progress, today: Day, count: number = EXTRA_ROUND_CARDS): string[] {
  const learned = learnedCards(progress);
  const due = learned.filter(([, card]) => card.due <= today).sort(byBoxThenDue);
  const rest = learned.filter(([, card]) => card.due > today).sort(byBoxThenDue);
  return [...due, ...rest].slice(0, count).map(([id]) => id);
}

/** Karten je Fach (alle angelegten Karten). */
export function cardsPerBox(progress: Progress): Record<Box, number> {
  const out: Record<Box, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const card of Object.values(progress.cards)) out[card.box]++;
  return out;
}

/** Wahr, wenn die 6-Minuten-Grenze der Wiederholrunde erreicht ist. Die Oberfläche beendet dann die Runde. */
export function isRoundTimeUp(startedAtMs: number, nowMs: number): boolean {
  return nowMs - startedAtMs >= REVIEW_ROUND.maxMinutes * 60_000;
}
