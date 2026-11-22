// Lädt alle Lerninhalte aus content/ und gibt sie typisiert heraus.
// Die JSON-Dateien werden statisch importiert und landen im Bundle.
// Diese Datei gehört zu AP0. Änderungswünsche an die Hauptsitzung melden.

import courseJson from "../../content/course.json";
import phrasebookJson from "../../content/phrasebook.json";
import referenceJson from "../../content/reference.json";
import u01 from "../../content/units/u01.json";
import u02 from "../../content/units/u02.json";
import u03 from "../../content/units/u03.json";
import u04 from "../../content/units/u04.json";
import u05 from "../../content/units/u05.json";
import u06 from "../../content/units/u06.json";
import u07 from "../../content/units/u07.json";
import u08 from "../../content/units/u08.json";
import u09 from "../../content/units/u09.json";
import u10 from "../../content/units/u10.json";
import type { Course, Item, Phrase, Phrasebook, Reference, Unit } from "./types";

export const course = courseJson as Course;

const loaded = [u01, u02, u03, u04, u05, u06, u07, u08, u09, u10] as Unit[];
const byId = new Map(loaded.map((unit) => [unit.id, unit]));

/** Alle Einheiten in der Reihenfolge aus course.json. */
export const units: Unit[] = course.units.map((id) => {
  const unit = byId.get(id);
  if (!unit) throw new Error(`Einheit ${id} steht in course.json, fehlt aber in content/units`);
  return unit;
});

export const phrasebook = phrasebookJson as Phrasebook;
export const reference = referenceJson as Reference;

/** Alle Lernkarten des Kurses in Kursreihenfolge. */
export const allItems: Item[] = units.flatMap((unit) => unit.items);

/** Alle Sätze des Sprachführers in der Reihenfolge der Kategorien. */
export const allPhrases: Phrase[] = phrasebook.categories.flatMap((category) => category.phrases);

const unitByItemId = new Map<string, Unit>();
for (const unit of units) for (const item of unit.items) unitByItemId.set(item.id, unit);
const itemById = new Map(allItems.map((item) => [item.id, item]));

export function getUnit(unitId: string): Unit | undefined {
  return byId.get(unitId);
}

export function getItem(itemId: string): Item | undefined {
  return itemById.get(itemId);
}

/** Die Einheit, zu der eine Lernkarte gehört. */
export function unitOfItem(itemId: string): Unit | undefined {
  return unitByItemId.get(itemId);
}
