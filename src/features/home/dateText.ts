// Datum in Worten für den Kopf der Startseite, zum Beispiel „Dienstag, 24. November“. Reine Funktion.

import type { Day } from "../../core/types";

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"] as const;
const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

/** `2026-11-24` wird zu „Dienstag, 24. November“. Bei ungültigem Tag der Text selbst. */
export function formatDateDe(day: Day): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = WEEKDAYS[date.getUTCDay()];
  const month = MONTHS[date.getUTCMonth()];
  return weekday && month ? `${weekday}, ${d}. ${month}` : day;
}
