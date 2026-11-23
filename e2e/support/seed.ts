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

const dayMs = 86_400_000;

/** Tage zwischen zwei Kalendertagen (JJJJ-MM-TT). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs);
}

export function addDaysTo(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * dayMs).toISOString().slice(0, 10);
}

/** Der Kalendertag, an dem der Lernstand entstand (lastSeen einer Karte). */
export function standDay(progress: any): string {
  return (Object.values(progress.cards)[0] as { lastSeen: string }).lastSeen;
}

/** Verschiebt jedes Datum im Lernstand (Tage und ISO-Zeitpunkte) um `days` Tage. */
export function shiftProgress(progress: any, days: number): any {
  const text = JSON.stringify(progress).replace(/([0-9]{4}-[0-9]{2}-[0-9]{2})(?=[T"])/g, (day) => addDaysTo(day, days));
  return JSON.parse(text);
}

/** Macht die Karten der genannten Haltestellen (alle, wenn leer) zu Karten in `box`, fällig an `day`; alle anderen Karten fällig in 30 Tagen. */
export function dueCards(progress: any, day: string, box: number, onlyIds?: (id: string) => boolean): any {
  for (const [id, card] of Object.entries<any>(progress.cards)) {
    if (!onlyIds || onlyIds(id)) {
      card.box = box;
      card.due = day;
    } else {
      card.due = addDaysTo(day, 30);
    }
  }
  return progress;
}
