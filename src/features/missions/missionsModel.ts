// Liste der Missionen für die Ansicht: Zustand, Text und Ergebnis je Mission. Reine Funktion, kein React.

import { getUnit } from "../../core/content";
import type { MissionFeeling, Progress } from "../../core/types";
import { missionStates } from "../../core/units";
import type { MissionState } from "../../core/units";

export interface MissionEntry {
  missionId: string;
  stop: number;
  state: MissionState;
  title: string;
  task: string;
  /** Spanische Sätze zum Mitnehmen. */
  say: string[];
  feeling: MissionFeeling | null;
  note: string | null;
}

export const STATE_LABEL: Record<MissionState, string> = {
  locked: "gesperrt",
  open: "offen",
  done: "erledigt",
  skipped: "übersprungen",
};

/** Antworten auf „Wie lief es?“: gespeichert wird `id`, angezeigt `label`. */
export const FEELINGS: ReadonlyArray<{ id: MissionFeeling; label: string }> = [
  { id: "leicht", label: "leicht" },
  { id: "mittel", label: "ging so" },
  { id: "schwer", label: "schwer" },
];

export function feelingLabel(feeling: MissionFeeling): string {
  return FEELINGS.find((entry) => entry.id === feeling)?.label ?? feeling;
}

/** Alle zehn Missionen in Kursreihenfolge. */
export function missionList(progress: Progress): MissionEntry[] {
  return missionStates(progress).flatMap((info) => {
    const unit = getUnit(info.unitId);
    if (!unit) return [];
    const saved = progress.missions[info.missionId];
    return [
      {
        missionId: info.missionId,
        stop: info.stop,
        state: info.state,
        title: unit.mission.title_de,
        task: unit.mission.task_de,
        say: unit.mission.say,
        feeling: saved?.feeling ?? null,
        note: saved?.note ?? null,
      },
    ];
  });
}

/** Offene und übersprungene Missionen zeigen Aufgabe und Sätze zum Mitnehmen. */
export function showsTask(state: MissionState): boolean {
  return state === "open" || state === "skipped";
}
