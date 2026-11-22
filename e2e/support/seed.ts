// Vorbereiteter Lernstand: „alle zehn Haltestellen abgeschlossen“. Baut auf dem echten Stand nach Haltestelle 1 auf
// (gleiche Form, besteht die Prüfung beim Laden) und ergänzt Haltestelle 2 bis 10 mit ihren Karten.

import { units } from "./content";

const addDays = (day: string, days: number): string => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * @param unit1 Lernstand nach Haltestelle 1 (JSON-Text, Fixture `unit1`).
 * Karten von Haltestelle 2 bis 10 liegen verteilt in Fach 1 bis 5, nichts ist fällig (alle Karten erst in 30 Tagen),
 * damit die Endstation ohne vorgeschaltete Wiederholrunde beginnt.
 */
export function allStopsDone(unit1: string): any {
  const progress = JSON.parse(unit1);
  const stamp = progress.units.u01.completedAt as string;
  const day = (Object.values(progress.cards)[0] as { lastSeen: string }).lastSeen;
  let counter = 0;
  for (const unit of units) {
    if (unit.id === "u01") continue;
    progress.units[unit.id] = { step: 6, startedAt: stamp, completedAt: stamp };
    for (const item of unit.items) {
      progress.cards[item.id] = { box: (counter++ % 5) + 1, due: addDays(day, 30), right: 1, wrong: 0, lastSeen: day };
    }
  }
  for (const card of Object.values<any>(progress.cards)) card.due = addDays(day, 30);
  // Drei Missionen erledigt, eine übersprungen.
  for (const [index, unit] of units.slice(0, 4).entries()) {
    progress.missions[unit.mission.id] = { state: index < 3 ? "done" : "skipped", at: stamp };
  }
  progress.stats.points += 9 * 220;
  return progress;
}
