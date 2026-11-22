// Punkte, Serie, Lernzeit (docs/02-spezifikation.md, 5.3 und 5.4). Alles unveränderlich: gibt neue Progress-Objekte zurück.

import { ACTIVE_TIME_IDLE_PAUSE_SECONDS, STREAK_MIN_REVIEWED_CARDS } from "./config";
import { addDays } from "./time";
import type { Day, Progress } from "./types";

export function addPoints(progress: Progress, points: number): Progress {
  if (points === 0) return progress;
  return { ...progress, stats: { ...progress.stats, points: progress.stats.points + points } };
}

/** Karten, die an diesem Tag beantwortet wurden (lastSeen = Tag, mindestens eine Antwort). */
export function reviewedCardsOn(progress: Progress, day: Day): number {
  let count = 0;
  for (const card of Object.values(progress.cards)) {
    if (card.lastSeen === day && card.right + card.wrong > 0) count++;
  }
  return count;
}

/**
 * Zählt den Tag für die Serie. `lastActiveDay` ist der letzte Tag, der für die Serie zählte.
 * Folgt er direkt auf den letzten gezählten Tag, wächst die Serie, sonst beginnt sie bei 1. Ein Tag zählt nur einmal.
 */
export function markStreakDay(progress: Progress, day: Day): Progress {
  const { lastActiveDay, streak } = progress.stats;
  if (lastActiveDay === day) return progress;
  const next = lastActiveDay === addDays(day, -1) ? streak + 1 : 1;
  return { ...progress, stats: { ...progress.stats, streak: next, lastActiveDay: day } };
}

/** Nach jeder Kartenantwort: Hat der Tag jetzt genug wiederholte Karten, zählt er für die Serie. */
export function updateStreakAfterReview(progress: Progress, day: Day): Progress {
  if (reviewedCardsOn(progress, day) >= STREAK_MIN_REVIEWED_CARDS) return markStreakDay(progress, day);
  return progress;
}

/** Serie zum Anzeigen: Riss sie (letzter gezählter Tag früher als gestern), ist sie 0. */
export function currentStreak(progress: Progress, today: Day): number {
  const last = progress.stats.lastActiveDay;
  if (last === null) return 0;
  return last === today || last === addDays(today, -1) ? progress.stats.streak : 0;
}

/**
 * Lernzeit. Bei jeder Eingabe aufrufen. `lastInputMs` ist der Zeitpunkt der vorigen Eingabe (null am Anfang oder nach
 * einer Pause, etwa wenn die App in den Hintergrund ging). Die Zeit seit der vorigen Eingabe zählt höchstens
 * 60 Sekunden, danach pausiert die Uhr. Der Aufrufer merkt sich `nowMs` als neues `lastInputMs`.
 */
export function recordActivity(progress: Progress, lastInputMs: number | null, nowMs: number, day: Day): Progress {
  if (lastInputMs === null || nowMs <= lastInputMs) return progress;
  const added = Math.min(nowMs - lastInputMs, ACTIVE_TIME_IDLE_PAUSE_SECONDS * 1000);
  const before = progress.stats.activeMsByDay[day] ?? 0;
  return {
    ...progress,
    stats: { ...progress.stats, activeMsByDay: { ...progress.stats.activeMsByDay, [day]: before + added } },
  };
}

/** Zahl der Kalendertage mit aktiver Lernzeit. */
export function activeDays(progress: Progress): number {
  return Object.values(progress.stats.activeMsByDay).filter((ms) => ms > 0).length;
}

/** Gesamte Lernzeit in Millisekunden. */
export function totalActiveMs(progress: Progress): number {
  return Object.values(progress.stats.activeMsByDay).reduce((sum, ms) => sum + ms, 0);
}
