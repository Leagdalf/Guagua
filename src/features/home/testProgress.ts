// Nur für Tests der Ansichten: Fortschritte in den Zuständen aus dem Design-Dokument aufbauen. Nicht Teil der App.

import { freshProgress, makeClock } from "../../core/testkit";
import type { Progress, Step } from "../../core/types";
import { completeStep, finishReviewRound, startUnit } from "../../core/units";
import type { Clock } from "../../core/time";

export function newClock(day = "2026-11-23") {
  return makeClock(day);
}

export function newProgress(clock: { now: Clock }, name = "Ana"): Progress {
  return freshProgress(clock, name);
}

/** Läuft alle Schritte einer Haltestelle durch, bis sie abgeschlossen ist. */
export function completeUnit(progress: Progress, unitId: string, now: Clock): Progress {
  let p = startUnit(progress, unitId, now);
  for (const step of [1, 2, 3, 4, 5] as Step[]) p = completeStep(p, unitId, step, now);
  return p;
}

/** Haltestelle 1 am ersten Tag abgeschlossen, Wiederholrunde des Tages beendet. */
export function afterUnit1(clock = newClock()): { clock: ReturnType<typeof newClock>; progress: Progress } {
  const progress = finishReviewRound(completeUnit(newProgress(clock), "u01", clock.now), clock.current());
  return { clock, progress };
}
