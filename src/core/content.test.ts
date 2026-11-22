import { describe, expect, it } from "vitest";
import { allItems, allPhrases, course, getItem, getUnit, phrasebook, reference, unitOfItem, units } from "./content";

describe("Lerninhalte", () => {
  it("liefert 10 Einheiten in der Reihenfolge des Kurses", () => {
    expect(units).toHaveLength(10);
    expect(units.map((unit) => unit.id)).toEqual(course.units);
    expect(units.map((unit) => unit.stop)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("liefert 154 Lernkarten mit eindeutigen ids", () => {
    expect(allItems).toHaveLength(154);
    expect(new Set(allItems.map((item) => item.id)).size).toBe(154);
  });

  it("kennt nur die drei Kartenarten und gibt jedem Satzmuster ein Beispiel", () => {
    for (const item of allItems) {
      expect(["word", "phrase", "frame"]).toContain(item.kind);
      if (item.kind === "frame") expect(item.example?.es).toBeTruthy();
    }
  });

  it("findet Einheit und Karte über ihre id", () => {
    expect(getUnit("u02")?.title_es).toBe("En el café");
    expect(getItem("u02-i05")?.es).toBe("un agua sin gas");
    expect(unitOfItem("u02-i05")?.id).toBe("u02");
    expect(getUnit("u99")).toBeUndefined();
  });

  it("liefert den Sprachführer mit 61 Sätzen in 9 Kategorien", () => {
    expect(phrasebook.categories).toHaveLength(9);
    expect(allPhrases).toHaveLength(61);
  });

  it("liefert die Zahlen 0 bis 100 und sieben Wochentage", () => {
    expect(reference.numbers).toHaveLength(101);
    expect(reference.numbers[0]).toEqual({ n: 0, es: "cero" });
    expect(reference.weekdays).toHaveLength(7);
  });
});
