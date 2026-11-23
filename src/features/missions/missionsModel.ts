// Liste der Missionen für die Ansicht: Zustand, Text und Ergebnis je Mission. Reine Funktion, kein React.

import { getUnit } from "../../core/content";
import type { Mission, MissionFeeling, Progress } from "../../core/types";
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
  /** Übersetzung je Satz in derselben Reihenfolge, `null` wo sie (noch) fehlt. */
  sayDe: (string | null)[];
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

/** Übersetzungen der Sätze aus `say_de`. Fehlt das Feld oder ein Eintrag, steht dort `null`. */
export function sayTranslations(mission: Pick<Mission, "say" | "say_de">): (string | null)[] {
  return mission.say.map((_, index) => {
    const de = mission.say_de?.[index];
    return typeof de === "string" && de.trim() !== "" ? de : null;
  });
}

/** Aufgedeckte Übersetzungen nach einem Tippen auf den Knopf von Satz `index`: aufdecken oder wieder verdecken. */
export function toggledIndex(revealed: ReadonlySet<number>, index: number): ReadonlySet<number> {
  const next = new Set(revealed);
  if (!next.delete(index)) next.add(index);
  return next;
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
        sayDe: sayTranslations(unit.mission),
        feeling: saved?.feeling ?? null,
        note: saved?.note ?? null,
      },
    ];
  });
}

/** Aufgabe und Sätze zum Mitnehmen stehen bei jeder Mission, die nicht gesperrt ist, auch nach dem Erledigen. */
export function showsTask(state: MissionState): boolean {
  return state !== "locked";
}

/** Offene und übersprungene Missionen lassen sich abhaken. */
export function canComplete(state: MissionState): boolean {
  return state === "open" || state === "skipped";
}
