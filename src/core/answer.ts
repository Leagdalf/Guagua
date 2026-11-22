// Antwortprüfung fürs Schreiben (docs/02-spezifikation.md, 2.4).
// Groß- und Kleinschreibung, Leerzeichen am Rand und die Zeichen ¿ ? ¡ ! . , zählen nicht.
// Fehlt nur ein Akzent auf einem Vokal, gilt die Antwort als richtig, die App zeigt die Schreibweise mit Akzent.
// Ein n statt ñ ist falsch.

export type WrittenVerdict = "correct" | "accent" | "wrong";

export interface WrittenCheck {
  verdict: WrittenVerdict;
  /** Wahr bei `correct` und `accent`. */
  correct: boolean;
  /** Die richtige Schreibweise, so wie sie in den Inhalten steht. */
  solution: string;
}

const IGNORED_CHARS = /[¿?¡!.,]/g;
const ACCENT_BASE: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u" };

function normalize(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(IGNORED_CHARS, "").replace(/\s+/g, " ").trim();
}

/** Prüft eine getippte Antwort gegen die Lösung. */
export function checkWritten(input: string, solution: string): WrittenCheck {
  const typed = Array.from(normalize(input));
  const expected = Array.from(normalize(solution));
  const result = (verdict: WrittenVerdict): WrittenCheck => ({ verdict, correct: verdict !== "wrong", solution });

  if (typed.length !== expected.length || typed.length === 0) return result("wrong");

  let accentMissing = false;
  for (let i = 0; i < expected.length; i++) {
    const t = typed[i] as string;
    const e = expected[i] as string;
    if (t === e) continue;
    if (ACCENT_BASE[e] === t) {
      accentMissing = true;
      continue;
    }
    return result("wrong");
  }
  return result(accentMissing ? "accent" : "correct");
}
