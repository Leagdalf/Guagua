// Kalendertage und Uhr. Die Uhr wird überall hineingereicht, nie direkt `new Date()` in der Logik.

import type { Day } from "./types";

/** Austauschbare Uhr. In der App `() => new Date()`, in Tests eine feste oder schiebbare Uhr. */
export type Clock = () => Date;

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** Lokaler Kalendertag eines Zeitpunkts als `JJJJ-MM-TT`. */
export function toDay(date: Date): Day {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

/** Heute laut Uhr. */
export function today(now: Clock): Day {
  return toDay(now());
}

/** Lokaler Kalendertag eines ISO-Zeitpunkts. Bei unlesbarem Text `null`. */
export function dayOfIso(iso: string): Day | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : toDay(date);
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Wahr für einen gültigen Kalendertag `JJJJ-MM-TT`. */
export function isDay(value: unknown): value is Day {
  if (typeof value !== "string") return false;
  const match = DAY_PATTERN.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function parseDay(day: Day): number {
  const match = DAY_PATTERN.exec(day);
  if (!match) throw new Error(`Kein Kalendertag: ${day}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Tag plus n Tage (n darf negativ sein). Rechnet in UTC, damit Zeitumstellungen nichts verschieben. */
export function addDays(day: Day, n: number): Day {
  const date = new Date(parseDay(day) + n * 86_400_000);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

/** Zahl der Tage von `from` bis `to` (positiv, wenn `to` später liegt). */
export function daysBetween(from: Day, to: Day): number {
  return Math.round((parseDay(to) - parseDay(from)) / 86_400_000);
}
