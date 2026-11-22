// Text der Ansicht „Deine Linie“ nach der Endstation (docs/02-spezifikation.md, 2.8): Karten je Fach, erledigte Missionen,
// aktive Tage, gesamte Lernzeit und das Ergebnis der 30 Aufgaben. Reine Funktion, kein React.

import { cardsPerBox } from "../../core/cards";
import { units } from "../../core/content";
import { activeDays, currentStreak, totalActiveMs } from "../../core/stats";
import type { Box, Day, Progress } from "../../core/types";
import { missionStates } from "../../core/units";
import type { SummaryLine } from "./machine";

const BOXES: readonly Box[] = [1, 2, 3, 4, 5];

/** „47 Min.“, „2 Std. 5 Min.“, „unter 1 Min.“ */
export function formatLearnTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "unter 1 Min.";
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`;
}

function cards(n: number): string {
  return n === 1 ? "1 Karte" : `${n} Karten`;
}

export interface FinalLineText {
  headline: string;
  notes: string[];
  lines: SummaryLine[];
}

/** Im Ruhemodus fehlen Punkte und Serie. Ohne Ergebnis (Endstation noch nicht geschafft) fehlt die Zeile dazu. */
export function finalLineText(progress: Progress, day: Day): FinalLineText {
  const perBox = cardsPerBox(progress);
  const missions = missionStates(progress);
  const done = missions.filter((mission) => mission.state === "done").length;
  const lines: SummaryLine[] = BOXES.map((box) => ({ label: `Fach ${box}`, value: cards(perBox[box]) }));
  lines.push({ label: "Missionen erledigt", value: `${done} von ${units.length}` });
  lines.push({ label: "Aktive Tage", value: String(activeDays(progress)) });
  lines.push({ label: "Lernzeit", value: formatLearnTime(totalActiveMs(progress)) });
  const result = progress.finalReview;
  if (result) lines.push({ label: "Endstation", value: `${result.right} von ${result.total} richtig` });
  if (!progress.profile.calm) {
    lines.push({ label: "Punkte", value: String(progress.stats.points) });
    const streak = currentStreak(progress, day);
    if (streak >= 1) lines.push({ label: "Serie", value: `${streak} ${streak === 1 ? "Tag" : "Tage"}` });
  }
  return {
    headline: "Du hast die ganze Linie geschafft.",
    notes: [`${units.length} Haltestellen und die Endstation.`],
    lines,
  };
}
