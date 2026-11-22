// Uhr der App. Zum Testen lässt sie sich über die Adresse um ganze Tage verschieben: `?tage=1` ist morgen.
// Die Lernlogik in src/core bekommt diese Uhr hineingereicht und kennt die Verschiebung nicht.

import type { Clock } from "../core/time";

const MS_PER_DAY = 86_400_000;

/** Liest die Verschiebung in Tagen aus dem Suchteil der Adresse. Alles Ungültige ergibt 0. */
export function readDayOffset(search: string): number {
  const raw = new URLSearchParams(search).get("tage");
  if (raw === null || raw.trim() === "") return 0;
  const days = Number(raw);
  return Number.isInteger(days) && days >= -30 && days <= 365 ? days : 0;
}

export function createClock(offsetDays: number, base: () => number = Date.now): Clock {
  return () => new Date(base() + offsetDays * MS_PER_DAY);
}
