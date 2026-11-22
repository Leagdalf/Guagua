import { describe, expect, it } from "vitest";
import { checkWritten } from "./answer";

describe("Antwortprüfung beim Schreiben", () => {
  it("„esta“ für „está“ ist richtig mit Akzent-Hinweis", () => {
    const check = checkWritten("esta", "está");
    expect(check.verdict).toBe("accent");
    expect(check.correct).toBe(true);
    expect(check.solution).toBe("está");
  });

  it("„manana“ für „mañana“ ist falsch", () => {
    expect(checkWritten("manana", "mañana")).toMatchObject({ verdict: "wrong", correct: false });
  });

  it("„¿Cuánto cuesta?“ und „cuanto cuesta“ gelten als gleich bis auf den Akzent-Hinweis", () => {
    const check = checkWritten("cuanto cuesta", "¿Cuánto cuesta?");
    expect(check.verdict).toBe("accent");
    expect(check.correct).toBe(true);
    expect(check.solution).toBe("¿Cuánto cuesta?");
    expect(checkWritten("¿Cuánto cuesta?", "¿Cuánto cuesta?").verdict).toBe("correct");
  });

  it("Groß- und Kleinschreibung, Ränder und die Zeichen ¿ ? ¡ ! . , zählen nicht", () => {
    expect(checkWritten("  HOLA, ¿qué tal?  ", "hola qué tal").verdict).toBe("correct");
    expect(checkWritten("¡Buenos días!", "buenos días").verdict).toBe("correct");
  });

  it("ein anderer Buchstabe oder fehlende Wörter sind falsch", () => {
    expect(checkWritten("gracia", "gracias").correct).toBe(false);
    expect(checkWritten("", "hola").correct).toBe(false);
    expect(checkWritten("hola", "hola amigo").correct).toBe(false);
  });

  it("zerlegte Zeichen (n plus Tilde) gelten wie das zusammengesetzte ñ", () => {
    expect(checkWritten("mañana", "mañana").verdict).toBe("correct");
  });
});
