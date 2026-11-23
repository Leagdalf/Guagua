// Die Oberfläche nennt keinen Vornamen des Betreuers: Die Quelltexte von Startseite, Mehr und Sprachführer enthalten ihn nicht.

import { describe, expect, it } from "vitest";

const NAME = ["Flo", "rian"].join("");

const files = import.meta.glob(["../home/**/*.{ts,tsx,css}", "./**/*.{ts,tsx,css}", "../phrasebook/**/*.{ts,tsx,css}"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("Kein Vorname in der Oberfläche", () => {
  it("kein Quelltext in home, more und phrasebook nennt ihn", () => {
    expect(Object.keys(files).length).toBeGreaterThan(20);
    const hits = Object.entries(files)
      .filter(([, text]) => text.includes(NAME))
      .map(([path]) => path);
    expect(hits).toEqual([]);
  });
});
