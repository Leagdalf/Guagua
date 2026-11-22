// Eingabe bei „Schreiben“: Zeichen an der Schreibmarke einfügen. Reine Funktion, kein React.

/** Zeichen, die eine deutsche Tastatur schlecht erreicht (docs/04-design.md, „Rollenspiel, Schreiben, Zeigen“). */
export const SPECIAL_CHARS = ["á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡"] as const;

/**
 * Fügt `char` an der Schreibmarke ein. Eine Auswahl von `start` bis `end` wird ersetzt. Die Schreibmarke steht danach hinter dem
 * Zeichen. Ungültige Werte (negativ, hinter dem Ende, vertauscht) werden auf den Text begrenzt.
 */
export function insertAtCaret(value: string, start: number, end: number, char: string): { value: string; caret: number } {
  const from = Math.min(Math.max(Math.min(start, end), 0), value.length);
  const to = Math.min(Math.max(Math.max(start, end), 0), value.length);
  return { value: value.slice(0, from) + char + value.slice(to), caret: from + char.length };
}
