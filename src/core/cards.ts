// Karteikasten (docs/02-spezifikation.md, 5.1 und 5.2).

import { BOX_INTERVAL_DAYS, EXTRA_ROUND_CARDS, MAX_BOX, OFTEN_WRONG, POINTS, REVIEW_ROUND, REVIEW_ROUND_AFTER_FINAL, WRONG_ANSWER } from "./config";
import { allItems, getItem, unitOfItem } from "./content";
import { shuffle } from "./random";
import type { Rng } from "./random";
import { addPoints, updateStreakAfterReview } from "./stats";
import { addDays } from "./time";
import type { Box, CardProgress, Day, Item, Progress } from "./types";

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

/** Höchstzahl der Karten einer Wiederholrunde: 40, nach der Endstation 20 (2.9, Punkt 8). */
export function reviewLimit(progress: Progress): number {
  return progress.finalReview ? REVIEW_ROUND_AFTER_FINAL : REVIEW_ROUND.maxCards;
}

/** Karten der Wiederholrunde: die fälligen, höchstens `limit` (Standard `reviewLimit`). Der Rest bleibt fällig. */
export function reviewRoundIds(progress: Progress, today: Day, limit: number = reviewLimit(progress)): string[] {
  return dueCardIds(progress, today).slice(0, limit);
}

/**
 * Freie Runde „10 Karten extra“: Karten in niedrigen Fächern zuerst, innerhalb eines Fachs zufällig (2.9, Punkt 7).
 * Mit `rng` wählt jeder Aufruf neu. Ohne `rng` (zum Zählen) gilt die feste Reihenfolge nach Fälligkeit und Kurs.
 */
export function extraRoundIds(progress: Progress, _today: Day, count: number = EXTRA_ROUND_CARDS, rng?: Rng): string[] {
  const learned = learnedCards(progress).sort(byBoxThenDue);
  if (!rng) return learned.slice(0, count).map(([id]) => id);
  const picked: string[] = [];
  for (let box = 1; box <= MAX_BOX && picked.length < count; box++) {
    const inBox = learned.filter(([, card]) => card.box === box).map(([id]) => id);
    picked.push(...shuffle(inBox, rng));
  }
  return picked.slice(0, count);
}

/**
 * Karten für „Oft falsch“ im Spickzettel: höchstens `OFTEN_WRONG.maxCards`, jede mindestens `OFTEN_WRONG.minWrong`-mal
 * falsch (erste Antworten). Die mit den meisten Fehlern zuerst, bei Gleichstand das niedrigere Fach, dann Kursreihenfolge.
 */
export function oftenWrongCards(progress: Progress): { item: Item; wrong: number }[] {
  const rows: { item: Item; wrong: number; box: Box }[] = [];
  for (const [id, card] of Object.entries(progress.cards)) {
    const item = getItem(id);
    if (item && card.wrong >= OFTEN_WRONG.minWrong) rows.push({ item, wrong: card.wrong, box: card.box });
  }
  rows.sort((a, b) => b.wrong - a.wrong || a.box - b.box || (itemOrder.get(a.item.id) ?? 0) - (itemOrder.get(b.item.id) ?? 0));
  return rows.slice(0, OFTEN_WRONG.maxCards).map(({ item, wrong }) => ({ item, wrong }));
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
