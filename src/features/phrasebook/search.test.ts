import { describe, expect, it } from "vitest";
import { allPhrases, phrasebook } from "../../core/content";
import { normalizeForSearch, searchPhrasebook } from "./search";

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

  it("leere Suche oder nur Leerzeichen liefert alle 56 Sätze in Kategorien", () => {
    expect(hits("")).toHaveLength(allPhrases.length);
    expect(hits("   ")).toHaveLength(56);
    expect(searchPhrasebook(phrasebook.categories, "")).toHaveLength(phrasebook.categories.length);
  });

  it("behält Titel und Hinweis der Kategorie", () => {
    const [first] = searchPhrasebook(phrasebook.categories, "medico");
    expect(first?.note_de).toContain("112");
  });
});
