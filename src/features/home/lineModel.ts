// Zustände der Linie und des Bergs aus dem Fortschritt. Beide kommen aus derselben Quelle (`stopStates`),
// damit der Berg immer denselben Stand zeigt wie die Linie. Reine Funktion, kein React.

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
  /** Satz zur Endstation, solange sie offen, aber nicht Teil der App ist. */
  finalNote: string | null;
}

export function lineModel(progress: Progress): LineModel {
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
        selectable: info.state === "done",
      },
    ];
  });

  // Die Endstation gehört nicht zum MVP. Sie zeigt nie „heute“ und kein Marker: offen heißt hier gesperrt gezeichnet
  // plus ein Satz, dass sie folgt.
  const final = finalStationState(progress);
  stops.push({
    id: FINAL_STOP_ID,
    name: "Repaso final",
    topic: "Endstation · 30 gemischte Aufgaben",
    state: final === "done" ? "done" : "locked",
    terminus: true,
  });

  const done = states.filter((info) => info.state === "done").length;
  return {
    stops,
    mountain: states.map((info) => info.state),
    summary: `${done} von ${units.length} abgeschlossen`,
    finalNote: final === "open" ? "Die Endstation ist offen, aber noch nicht in der App. Sie folgt." : null,
  };
}
