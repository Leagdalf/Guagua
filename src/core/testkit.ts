// Hilfen für die Tests der Kernlogik. Nicht Teil der App.

import { createProgress } from "./progress";
import type { Clock } from "./time";
import { addDays, toDay } from "./time";
import type { Day, Progress } from "./types";

/** Schiebbare Uhr: mittags am gesetzten lokalen Tag. */
export function makeClock(day: Day = "2026-11-23"): { now: Clock; set(day: Day): void; advance(days: number): void; current(): Day } {
  let current = day;
  const at = (d: Day): Date => {
    const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
    return new Date(y, m - 1, dd, 12, 0, 0);
  };
  return {
    now: () => at(current),
    set(next) {
      current = next;
    },
    advance(days) {
      current = addDays(current, days);
    },
    current: () => toDay(at(current)),
  };
}

export function freshProgress(clock: { now: Clock }, name = "Ana"): Progress {
  const progress = createProgress(name, clock.now);
  if (!progress) throw new Error("Testprofil ungültig");
  return progress;
}
