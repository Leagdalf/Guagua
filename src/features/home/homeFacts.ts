// Aus Lernstand und Inhalten abgeleitete Angaben für die Startseite: angeheftete Mission, nächste Wiederholung,
// Abgleich mit dem Plan. Reine Funktionen: Der Tag kommt als Parameter, es gibt keine Uhr und keinen Speicher.

import { course, units, unitOfItem } from "../../core/content";
import { dayOfIso, daysBetween } from "../../core/time";
import type { Day, Progress } from "../../core/types";
import { isUnitDone, missionState } from "../../core/units";
import { formatDateDe, formatDayMonthDe, weekdayDe } from "./dateText";

/** Wie lange die Mission der zuletzt abgeschlossenen Haltestelle angeheftet bleibt: bis zum zweiten Tag danach. */
export const PIN_DAYS_AFTER_COMPLETION = 2;

/**
 * Die Mission, die auf der Startseite angeheftet bleibt (Spezifikation 2.9, Punkt 4): die der zuletzt abgeschlossenen
 * Haltestelle, solange sie offen ist und der Abschluss höchstens `PIN_DAYS_AFTER_COMPLETION` Tage zurückliegt
 * (Tag des Abschlusses, Tag danach, übernächster Tag). Ältere offene Missionen stehen nur unter „Missionen“.
 */
export function pinnedMissionId(progress: Progress, day: Day): string | null {
  let latest: { at: string; missionId: string } | null = null;
  for (const unit of units) {
    const at = progress.units[unit.id]?.completedAt;
    if (at === undefined) continue;
    // Bei gleichem Zeitpunkt gewinnt die spätere Haltestelle der Kursreihenfolge.
    if (latest === null || at >= latest.at) latest = { at, missionId: unit.mission.id };
  }
  if (latest === null) return null;
  const completedDay = dayOfIso(latest.at);
  if (completedDay === null || daysBetween(completedDay, day) > PIN_DAYS_AFTER_COMPLETION) return null;
  return missionState(progress, latest.missionId) === "open" ? latest.missionId : null;
}

export interface NextReview {
  day: Day;
  /** Karten, die an diesem Tag fällig werden. */
  count: number;
}

/** Die nächste Fälligkeit nach heute unter den Karten abgeschlossener Haltestellen, mit der Zahl der Karten an diesem Tag. */
export function nextReview(progress: Progress, day: Day): NextReview | null {
  let best: NextReview | null = null;
  for (const [id, card] of Object.entries(progress.cards)) {
    const unit = unitOfItem(id);
    if (!unit || !isUnitDone(progress, unit.id) || card.due <= day) continue;
    if (best === null || card.due < best.day) best = { day: card.due, count: 1 };
    else if (card.due === best.day) best.count += 1;
  }
  return best;
}

/** Wochentag, ab einer Woche Abstand mit Datum, damit der Name eindeutig bleibt. */
function reviewDayText(target: Day, day: Day): string {
  return daysBetween(day, target) <= 6 ? weekdayDe(target) : formatDateDe(target);
}

function cardsText(n: number): string {
  return n === 1 ? "1 Karte" : `${n} Karten`;
}

/** „Nächste Wiederholung: Samstag, 12 Karten.“ */
export function nextReviewSentence(next: NextReview, day: Day): string {
  return `Nächste Wiederholung: ${reviewDayText(next.day, day)}, ${cardsText(next.count)}.`;
}

/** „134 Karten warten, morgen kommen die nächsten.“ */
export function waitingSentence(dueCount: number): string {
  return `${dueCount === 1 ? "1 Karte wartet" : `${dueCount} Karten warten`}, morgen kommen die nächsten.`;
}

/** Die Endstation wurde heute geschafft. */
export function finalDoneToday(progress: Progress, day: Day): boolean {
  return progress.finalReview !== undefined && dayOfIso(progress.finalReview.at) === day;
}

/**
 * Abgleich mit dem Plan (2.9, Punkt 9): Der Satz steht nur, wenn die Haltestelle von heute geschafft ist. Deshalb zählen die
 * Tage von morgen bis `plan.last_stop_date`. Sind mehr Haltestellen offen, als Tage bleiben, kommt der sachliche Satz.
 * Am letzten Plantag steht stattdessen, dass der Plan heute endet und wie viele Haltestellen offen sind.
 * Im Plan oder nach dem Plan: `null`.
 */
export function planSentence(progress: Progress, day: Day, lastStopDate: Day = course.plan.last_stop_date): string | null {
  const open = units.filter((unit) => !isUnitDone(progress, unit.id)).length;
  const daysLeft = daysBetween(day, lastStopDate);
  if (daysLeft < 0 || open === 0) return null;
  if (daysLeft === 0) return `Der Plan endet heute, es ${open === 1 ? "ist noch 1 Haltestelle" : `sind noch ${open} Haltestellen`} offen.`;
  if (open <= daysLeft) return null;
  return `Bis zum ${formatDayMonthDe(lastStopDate)} sind es noch ${open} Haltestellen in ${daysLeft === 1 ? "1 Tag" : `${daysLeft} Tagen`}.`;
}
