import { describe, expect, it } from "vitest";
import { createRng } from "../../core/random";
import {
  PRACTICE_TASK_COUNT,
  allPrices,
  allowedEuros,
  checkTyped,
  digitsOf,
  isAllowedPrice,
  makeNumberTasks,
  numberWord,
  parseTyped,
  resultLine,
  spokenText,
} from "./numbersModel";
import type { PriceTask } from "./numbersModel";

// Diese Formen darf die App nie bilden: „un euro“, „veintiún euros“, „treinta y un euros“, „uno“ am Ende eines Euro-Betrags.
const FORBIDDEN = /\buno\b|\bun\b|\bún\b|veintiún|veintiuno|\bun euro\b/i;

describe("Preise: alle möglichen Beträge", () => {
  const prices = allPrices();

  it("Euro von 2 bis 99 ohne die Zahlen auf 1, Cent 0 oder Zehnerschritte bis 90", () => {
    const euros = allowedEuros();
    expect(euros[0]).toBe(2);
    expect(euros.at(-1)).toBe(99);
    expect(euros.every((e) => e % 10 !== 1)).toBe(true);
    expect(euros).not.toContain(1);
    expect(euros).not.toContain(21);
    expect(euros).not.toContain(31);
    expect(euros).not.toContain(91);
    expect(euros).toHaveLength(98 - 9); // 2 bis 99 sind 98 Zahlen, davon enden 9 auf 1 (11 bis 91)
    expect(prices).toHaveLength(euros.length * 10);
  });

  it("kein möglicher Betrag führt zu „un euro“ oder „veintiún euros“, jeder Betrag hat ein Zahlwort", () => {
    for (const price of prices) {
      const text = spokenText(price);
      expect(text, `${price.euros},${price.cents}`).not.toMatch(FORBIDDEN);
      expect(text).toMatch(/ euros( con \S+)?$/);
      expect(text.startsWith(`${numberWord(price.euros)} euros`)).toBe(true);
      // Cent stets in Zehnerschritten: das Zahlwort endet nie auf „uno“.
      if (price.cents > 0) expect(text.endsWith(`con ${numberWord(price.cents)}`)).toBe(true);
    }
  });

  it("das Muster aus Haltestelle 3: tres euros con cincuenta", () => {
    expect(spokenText({ kind: "price", euros: 3, cents: 50 })).toBe("tres euros con cincuenta");
    expect(spokenText({ kind: "price", euros: 12, cents: 0 })).toBe("doce euros");
  });

  it("jede erzeugte Aufgabe liegt in der erlaubten Menge, über viele Zufallsfolgen", () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const task of makeNumberTasks(createRng(seed))) {
        if (task.kind === "price") {
          expect(isAllowedPrice(task.euros, task.cents)).toBe(true);
          expect(spokenText(task)).not.toMatch(FORBIDDEN);
        } else {
          expect(Number.isInteger(task.value) && task.value >= 0 && task.value <= 100).toBe(true);
        }
      }
    }
  });

  it("isAllowedPrice weist die verbotenen Beträge ab", () => {
    expect(isAllowedPrice(1, 0)).toBe(false);
    expect(isAllowedPrice(21, 0)).toBe(false);
    expect(isAllowedPrice(100, 0)).toBe(false);
    expect(isAllowedPrice(5, 5)).toBe(false);
    expect(isAllowedPrice(5, 100)).toBe(false);
    expect(isAllowedPrice(2, 90)).toBe(true);
  });
});

describe("Aufgaben erzeugen", () => {
  it("zehn Aufgaben, Zahlen und Preise gemischt, keine doppelt", () => {
    const tasks = makeNumberTasks(createRng(7));
    expect(tasks).toHaveLength(PRACTICE_TASK_COUNT);
    expect(tasks.filter((t) => t.kind === "price")).toHaveLength(4);
    expect(tasks.filter((t) => t.kind === "number")).toHaveLength(6);
    expect(new Set(tasks.map(digitsOf)).size).toBe(10);
  });

  it("derselbe Zufall ergibt dieselben Aufgaben, anderer Zufall andere", () => {
    expect(makeNumberTasks(createRng(1))).toEqual(makeNumberTasks(createRng(1)));
    expect(makeNumberTasks(createRng(1))).not.toEqual(makeNumberTasks(createRng(2)));
  });

  it("der Wortlaut der Zahlen kommt aus reference.json (0 bis 100)", () => {
    expect(numberWord(0)).toBe("cero");
    expect(numberWord(16)).toBe("dieciséis");
    expect(numberWord(100)).toBe("cien");
    expect(spokenText({ kind: "number", value: 42 })).toBe("cuarenta y dos");
    expect(() => numberWord(101)).toThrow();
  });

  it("ein Zufall, der immer das Ende liefert, hängt nicht und bleibt im Bereich", () => {
    for (const constant of [0, 0.5, 0.999999]) {
      const tasks = makeNumberTasks(() => constant);
      expect(tasks).toHaveLength(10);
      expect(new Set(tasks.map(digitsOf)).size).toBe(10);
    }
  });
});

describe("Eingabe prüfen: Komma und Punkt gelten beide", () => {
  const price = (euros: number, cents: number): PriceTask => ({ kind: "price", euros, cents });

  it("Zahlen: nur ganze Zahlen", () => {
    const task = { kind: "number", value: 42 } as const;
    expect(checkTyped(task, "42").matches).toBe(true);
    expect(checkTyped(task, " 42 ").matches).toBe(true);
    expect(checkTyped(task, "24").matches).toBe(false);
    expect(checkTyped(task, "42,0").matches).toBe(false);
    expect(checkTyped(task, "").matches).toBe(false);
    expect(checkTyped(task, "vierzig").matches).toBe(false);
  });

  it("Preise: 3,50 und 3.50 und 3,5 sind gleich", () => {
    const task = price(3, 50);
    for (const text of ["3,50", "3.50", "3,5", "3.5", "3,50 €", "3,50€"]) expect(checkTyped(task, text).matches, text).toBe(true);
    for (const text of ["350", "3", "3,05", "35,0", "3,500", "4,50", "3,"]) expect(checkTyped(task, text).matches, text).toBe(false);
  });

  it("ganze Euro: 12 und 12,00 und 12.0", () => {
    const task = price(12, 0);
    for (const text of ["12", "12,00", "12.00", "12,0"]) expect(checkTyped(task, text).matches, text).toBe(true);
    expect(checkTyped(task, "12,50").matches).toBe(false);
  });

  it("parseTyped", () => {
    expect(parseTyped("7", "number")).toBe(7);
    expect(parseTyped("7,5", "price")).toBe(750);
    expect(parseTyped("7,05", "price")).toBe(705);
    expect(parseTyped("abc", "price")).toBeNull();
    expect(parseTyped("1234", "number")).toBeNull();
  });

  it("die Rückmeldung nennt die Zahl in Ziffern und auf Spanisch, ohne Wertung", () => {
    const right = checkTyped(price(3, 50), "3.50");
    expect(right.digits).toBe("3,50");
    expect(right.spanish).toBe("tres euros con cincuenta");
    expect(resultLine(right)).toBe("Das war 3,50.");
    const wrong = checkTyped({ kind: "number", value: 42 }, "24");
    expect(resultLine(wrong)).toBe("Du hast 24 getippt. Es war 42.");
    expect(`${resultLine(right)}${resultLine(wrong)}`).not.toMatch(/falsch|richtig|punkt/i);
  });
});
