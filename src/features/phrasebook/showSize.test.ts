import { describe, expect, it } from "vitest";
import { allPhrases } from "../../core/content";
import { SHOW_MAX, SHOW_MAX_LINES, SHOW_MIN, estimateLines, showFontSize } from "./showSize";
import type { ShowLayout } from "./showSize";

const layouts: ShowLayout[] = ["phone", "tablet"];
const byLength = [...allPhrases].sort((a, b) => a.es.length - b.es.length);
const shortest = byLength[0]!;
const longest = byLength[byLength.length - 1]!;

describe("showFontSize", () => {
  it("Mindestgrößen: 48 px am Telefon, 72 px auf dem iPad", () => {
    expect(SHOW_MIN).toEqual({ phone: 48, tablet: 72 });
  });

  it.each(layouts)("liegt für den kürzesten und den längsten Satz in den Grenzen (%s)", (layout) => {
    for (const phrase of [shortest, longest]) {
      const size = showFontSize(phrase.es, layout);
      expect(size, phrase.es).toBeGreaterThanOrEqual(SHOW_MIN[layout]);
      expect(size, phrase.es).toBeLessThanOrEqual(SHOW_MAX[layout]);
    }
  });

  it.each(layouts)("kurze Sätze werden größer als lange, nie umgekehrt (%s)", (layout) => {
    expect(showFontSize(shortest.es, layout)).toBeGreaterThan(showFontSize(longest.es, layout));
    let last = Infinity;
    for (const text of ["a", "a".repeat(14), "a".repeat(20), "a".repeat(30), "a".repeat(40), "a".repeat(80)]) {
      const size = showFontSize(text.replace(/(.{4})/g, "$1 "), layout);
      expect(size).toBeLessThanOrEqual(last);
      last = size;
    }
  });

  it.each(layouts)("jeder Satz des Sprachführers passt geschätzt in höchstens vier Zeilen und liegt in den Grenzen (%s)", (layout) => {
    for (const phrase of allPhrases) {
      const size = showFontSize(phrase.es, layout);
      expect(size, phrase.es).toBeGreaterThanOrEqual(SHOW_MIN[layout]);
      expect(size, phrase.es).toBeLessThanOrEqual(SHOW_MAX[layout]);
      expect(estimateLines(phrase.es, layout, size), phrase.es).toBeLessThanOrEqual(SHOW_MAX_LINES);
    }
  });

  it("ein sehr langes Wort drückt die Größe auf das Minimum, nie darunter", () => {
    expect(showFontSize("Supercalifragilisticoespialidoso", "phone")).toBe(48);
    expect(showFontSize("Supercalifragilisticoespialidoso", "tablet")).toBe(72);
  });
});
