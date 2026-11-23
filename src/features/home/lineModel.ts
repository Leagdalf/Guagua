// Zustände der Linie und des Bergs aus dem Fortschritt. Beide kommen aus derselben Quelle (`stopStates`),
// damit der Berg immer denselben Stand zeigt wie die Linie. Reine Funktion, kein React.

import { FINAL_REVIEW } from "../../core/config";
import { getUnit, units } from "../../core/content";
import type { Progress } from "../../core/types";
import { finalStationState, stopStates } from "../../core/units";
import type { LineStop, StopState } from "../../ui";

/** id der Endstation in der Linie. */
export const FINAL_STOP_ID = "final";

export interface LineModel {
  /** Zehn Haltestellen und die Endstation. */
  stops: LineStop[];
  /** Zustände der zehn Haltestellen für den Berg. */
  mountain: StopState[];
  /** „1 von 10 abgeschlossen“ */
  summary: string;
}

/**
 * `offeredUnitId`: die Haltestelle des Tages (`todayPlan(...).unitId`). Nur sie heißt „heute“, eine andere offene
 * Haltestelle heißt „offen“. Offene und laufende Haltestellen lassen sich antippen und beginnen.
 */
export type StopTap =
  /** Abgeschlossen: Übersicht der Haltestelle. */
  | { type: "overview"; unitId: string }
  /** Offen oder laufend: die Lerneinheit, auch wenn heute schon eine geschafft ist. */
  | { type: "session"; unitId: string }
  /** Endstation offen oder laufend: die Endstation beginnen. */
  | { type: "final" }
  /** Endstation geschafft: die Ansicht „Deine Linie“. */
  | { type: "final-line" }
  | { type: "none" };

/** Was Tippen auf einen Punkt der Linie bewirkt. Gesperrte Haltestellen und die gesperrte Endstation bewirken nichts. */
export function stopTap(stops: readonly LineStop[], id: string): StopTap {
  const stop = stops.find((candidate) => candidate.id === id);
  if (!stop || stop.state === "locked") return { type: "none" };
  if (stop.terminus) return stop.state === "done" ? { type: "final-line" } : { type: "final" };
  return stop.state === "done" ? { type: "overview", unitId: id } : { type: "session", unitId: id };
}

export function lineModel(progress: Progress, offeredUnitId: string | null = null): LineModel {
  const states = stopStates(progress);
  const stops: LineStop[] = states.flatMap((info) => {
    const unit = getUnit(info.unitId);
    if (!unit) return [];
    return [
      {
        id: unit.id,
        name: unit.title_es,
        topic: unit.title_de,
        state: info.state,
        selectable: info.state !== "locked",
        ...(info.state === "open" ? { statusText: unit.id === offeredUnitId ? "heute" : "offen" } : {}),
      },
    ];
  });

  // Die Endstation: gesperrt vor Haltestelle 10, offen („heute“, mit Marker), läuft (30 Karten gewählt), abgeschlossen.
  // Offen und laufend lassen sich antippen und beginnen, abgeschlossen öffnet „Deine Linie“.
  const final = finalStationState(progress);
  const finalState: StopState = final === "done" ? "done" : final === "open" ? (progress.finalRun ? "running" : "open") : "locked";
  stops.push({
    id: FINAL_STOP_ID,
    name: "Repaso final",
    topic: `Endstation · ${FINAL_REVIEW.taskCount} gemischte Aufgaben`,
    state: finalState,
    terminus: true,
    selectable: final !== "locked",
  });

  const done = states.filter((info) => info.state === "done").length;
  return {
    stops,
    mountain: states.map((info) => info.state),
    summary: `${done} von ${units.length} abgeschlossen`,
  };
}
