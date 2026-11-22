// Schriftgröße im Vollbild „Zeigen“ (docs/04-design.md, Zeile „Spanisch im Vollbild Zeigen“): so groß, wie der Satz in
// vier Zeilen passt, aber nicht unter 48 px am Telefon und 72 px auf dem iPad. Reine Funktion ohne Browser.

export type ShowLayout = "phone" | "tablet";

export const SHOW_MIN: Record<ShowLayout, number> = { phone: 48, tablet: 72 };
export const SHOW_MAX: Record<ShowLayout, number> = { phone: 88, tablet: 132 };
export const SHOW_MAX_LINES = 4;

/** Stufen: bis zu dieser Länge des Satzes (in Zeichen) gilt diese Größe, wenn auch das längste Wort hineinpasst. */
const STEPS: readonly { upTo: number; size: Record<ShowLayout, number> }[] = [
  { upTo: 14, size: { phone: 88, tablet: 132 } },
  { upTo: 24, size: { phone: 68, tablet: 104 } },
  { upTo: 34, size: { phone: 56, tablet: 88 } },
  { upTo: Infinity, size: { phone: 48, tablet: 72 } },
];

/** Schätzung der Breite eines Zeichens in Newsreader kursiv, in Vielfachen der Schriftgröße (eher großzügig). */
export const CHAR_WIDTH_EM = 0.5;

/** Schmalste Textbreite, mit der gerechnet wird: Telefon 390 px minus 2 mal 28 px Rand, abgerundet. iPad hochkant 820 minus 2 mal 48. */
export const TEXT_WIDTH: Record<ShowLayout, number> = { phone: 300, tablet: 640 };

function longestWord(text: string): number {
  return Math.max(1, ...text.split(/\s+/).map((word) => Array.from(word).length));
}

/** Größe in px für diesen Satz und dieses Raster. Immer zwischen `SHOW_MIN` und `SHOW_MAX`. */
export function showFontSize(text: string, layout: ShowLayout): number {
  const length = Array.from(text.trim()).length;
  const step = STEPS.find((entry) => length <= entry.upTo)!;
  // Ein langes Wort darf nie breiter sein als die Zeile.
  const byWord = Math.floor(TEXT_WIDTH[layout] / (longestWord(text) * CHAR_WIDTH_EM));
  return Math.max(SHOW_MIN[layout], Math.min(step.size[layout], byWord));
}

/** Geschätzte Zeilenzahl bei dieser Größe (gieriger Umbruch an Leerzeichen). Für Tests und Entwurf. */
export function estimateLines(text: string, layout: ShowLayout, size: number): number {
  const perLine = Math.max(1, Math.floor(TEXT_WIDTH[layout] / (size * CHAR_WIDTH_EM)));
  let lines = 1;
  let used = 0;
  for (const word of text.trim().split(/\s+/)) {
    const w = Array.from(word).length;
    if (used === 0) used = w;
    else if (used + 1 + w <= perLine) used += 1 + w;
    else {
      lines++;
      used = w;
    }
  }
  return lines;
}
