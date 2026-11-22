import { describe, expect, it } from "vitest";
import { allItems, allPhrases, phrasebook, unitOfItem } from "../../core/content";
import { itemMatches, normalizeForSearch, searchItems, searchPhrasebook } from "./search";

function hits(query: string): string[] {
  return searchPhrasebook(phrasebook.categories, query).flatMap((c) => c.phrases.map((p) => p.es));
}

describe("Suche im Sprachführer", () => {
  it("normalisiert Akzente, Groß- und Kleinschreibung", () => {
    expect(normalizeForSearch("Médico")).toBe("medico");
    expect(normalizeForSearch("MAÑANA")).toBe("manana");
    expect(normalizeForSearch("Straße Über")).toBe("strasse uber");
  });

  it("„medico“ findet „Necesito un médico.“", () => {
    expect(hits("medico")).toContain("Necesito un médico.");
  });

  it("„WASSER“ findet genau zwei Sätze", () => {
    expect(hits("WASSER")).toEqual(["Otra agua, por favor.", "No hay agua caliente."]);
  });

  it("findet über Spanisch mit Akzent im Suchbegriff", () => {
    expect(hits("MÉDICO")).toContain("Necesito un médico.");
  });

  it("„xyz“ findet nichts", () => {
    expect(hits("xyz")).toEqual([]);
  });

  it("mehrere Wörter müssen alle vorkommen, in beliebiger Reihenfolge", () => {
    expect(hits("caliente agua")).toEqual(["No hay agua caliente."]);
  });

  it("leere Suche oder nur Leerzeichen liefert alle Sätze in Kategorien", () => {
    expect(hits("")).toHaveLength(allPhrases.length);
    expect(hits("   ")).toHaveLength(allPhrases.length);
    expect(searchPhrasebook(phrasebook.categories, "")).toHaveLength(phrasebook.categories.length);
  });

  it("behält Titel und Hinweis der Kategorie", () => {
    const [first] = searchPhrasebook(phrasebook.categories, "medico");
    expect(first?.note_de).toContain("112");
  });
});

describe("Suche über die Lernkarten des Kurses", () => {
  const found = (query: string) => searchItems(allItems, query);

  it("„Rechnung“ findet die Karte „la cuenta, por favor“", () => {
    expect(found("Rechnung").map((item) => item.es)).toContain("la cuenta, por favor");
  });

  it("„farmacia“ findet die Karte aus Haltestelle 5, auch ohne Rücksicht auf Groß- und Kleinschreibung", () => {
    for (const query of ["farmacia", "FARMACIA"]) {
      const fromStop5 = found(query).filter((item) => unitOfItem(item.id)?.stop === 5);
      expect(fromStop5.map((item) => item.es)).toContain("la farmacia");
    }
  });

  it("findet auch Karten aus Haltestellen, die noch gesperrt sind (die Suche kennt keinen Lernstand)", () => {
    const last = allItems[allItems.length - 1]!;
    expect(found(last.es)).toContain(last);
  });

  it("findet Satzmuster über den Beispielsatz, ohne Rücksicht auf Akzente", () => {
    const frame = allItems.find((item) => item.kind === "frame" && item.example)!;
    expect(found(frame.example!.es.toUpperCase())).toContain(frame);
    expect(found(frame.example!.de)).toContain(frame);
    expect(itemMatches({ es: "¿dónde está …?", de: "wo ist …?" }, "DONDE")).toBe(true);
  });

  it("ohne Suchwort kommen keine Karten", () => {
    expect(found("")).toEqual([]);
    expect(found("   ")).toEqual([]);
  });

  it("„xyz“ findet keine Karte", () => {
    expect(found("xyz")).toEqual([]);
  });
});
