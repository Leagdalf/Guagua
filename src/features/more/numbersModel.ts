// „Zahlen üben“ im Spickzettel (docs/02-spezifikation.md, 2.9 Punkt 11). Reine Funktionen: Zufall kommt hinein,
// nichts wird gespeichert, nichts gewertet.
//
// Preise folgen dem Muster aus Haltestelle 3 („tres euros con cincuenta“): Euro von 2 bis 99 ohne die Zahlen, die auf 1 enden,
// Cent 0 oder in Zehnerschritten bis 90. So kommen „un euro“, „veintiún euros“ und „treinta y un euros“ nie vor.

import { reference } from "../../core/content";
import type { Rng } from "../../core/random";
import { shuffle } from "../../core/random";

/** Zahl von 0 bis 100. */
export interface NumberTask {
  kind: "number";
  value: number;
}

/** Preis: Euro und Cent (0 oder Zehnerschritte). */
export interface PriceTask {
  kind: "price";
  euros: number;
  cents: number;
}

export type PracticeTask = NumberTask | PriceTask;

export const PRACTICE_TASK_COUNT = 10;
export const NUMBER_MAX = 100;
export const PRICE_EUROS_MIN = 2;
export const PRICE_EUROS_MAX = 99;
/** Cent-Beträge eines Preises: 0 (ganze Euro) und Zehnerschritte bis 90. */
export const PRICE_CENTS: readonly number[] = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

/** Euro, die vorkommen dürfen: 2 bis 99 ohne die Zahlen, die auf 1 enden. */
export function allowedEuros(): number[] {
  const out: number[] = [];
  for (let euros = PRICE_EUROS_MIN; euros <= PRICE_EUROS_MAX; euros++) if (euros % 10 !== 1) out.push(euros);
  return out;
}

export function isAllowedPrice(euros: number, cents: number): boolean {
  return allowedEuros().includes(euros) && PRICE_CENTS.includes(cents);
}

/** Alle möglichen Preise. */
export function allPrices(): PriceTask[] {
  return allowedEuros().flatMap((euros) => PRICE_CENTS.map((cents): PriceTask => ({ kind: "price", euros, cents })));
}

/** Spanisches Zahlwort aus `content/reference.json`. */
export function numberWord(n: number): string {
  const row = reference.numbers.find((entry) => entry.n === n);
  if (!row) throw new Error(`Kein Zahlwort für ${n}`);
  return row.es;
}

/** Was die App spricht, zum Beispiel „cuarenta y dos“ oder „tres euros con cincuenta“. */
export function spokenText(task: PracticeTask): string {
  if (task.kind === "number") return numberWord(task.value);
  const euros = `${numberWord(task.euros)} euros`;
  return task.cents === 0 ? euros : `${euros} con ${numberWord(task.cents)}`;
}

/** Die richtige Antwort in Ziffern: `42` oder `3,50`. */
export function digitsOf(task: PracticeTask): string {
  if (task.kind === "number") return String(task.value);
  return `${task.euros},${String(task.cents).padStart(2, "0")}`;
}

/** Zahl der Preis-Aufgaben unter `count`: rund zwei Fünftel. */
function priceShare(count: number): number {
  return Math.round(count * 0.4);
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))] as T;
}

/**
 * Zehn Aufgaben (oder `count`): rund sechs Zahlen von 0 bis 100, rund vier Preise, gemischt, keine doppelt.
 * Gleicher Zufall, gleiche Aufgaben.
 */
export function makeNumberTasks(rng: Rng, count: number = PRACTICE_TASK_COUNT): PracticeTask[] {
  const priceCount = priceShare(count);
  const numbers = shuffle(
    Array.from({ length: NUMBER_MAX + 1 }, (_, n) => n),
    rng,
  ).slice(0, count - priceCount);
  const tasks: PracticeTask[] = numbers.map((value): NumberTask => ({ kind: "number", value }));
  const seen = new Set<string>();
  const euros = allowedEuros();
  const add = (price: PriceTask): void => {
    const id = `${price.euros},${price.cents}`;
    if (seen.has(id) || seen.size >= priceCount) return;
    seen.add(id);
    tasks.push(price);
  };
  // Ein Zufall, der immer dasselbe liefert, darf nicht hängen: Nach 200 Versuchen füllt die Liste aller Preise auf.
  for (let attempt = 0; attempt < 200 && seen.size < priceCount; attempt++) {
    add({ kind: "price", euros: pick(euros, rng), cents: pick(PRICE_CENTS, rng) });
  }
  for (const price of allPrices()) add(price);
  return shuffle(tasks, rng);
}

/**
 * Tippt die Lernende Ziffern, liest die App sie als Betrag in Cent (Preis) oder als ganze Zahl. Komma und Punkt gelten beide,
 * `3,5` heißt 3,50. Alles andere ergibt `null`.
 */
export function parseTyped(input: string, kind: PracticeTask["kind"]): number | null {
  const text = input.trim().replace(/\s+/g, "").replace(/(€|eur|euro)$/i, "");
  if (kind === "number") return /^\d{1,3}$/.test(text) ? Number(text) : null;
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const cents = match[2] === undefined ? 0 : Number(match[2].padEnd(2, "0"));
  return Number(match[1]) * 100 + cents;
}

/** Der Wert der Aufgabe in derselben Einheit wie `parseTyped`. */
export function expectedValue(task: PracticeTask): number {
  return task.kind === "number" ? task.value : task.euros * 100 + task.cents;
}

export interface PracticeResult {
  /** Entspricht die Eingabe der Zahl? Nur für die Anzeige, es zählt nichts. */
  matches: boolean;
  /** Die Eingabe, wie sie getippt wurde (ohne Leerraum am Rand). */
  typed: string;
  /** Die richtige Antwort in Ziffern. */
  digits: string;
  /** Die richtige Antwort auf Spanisch. */
  spanish: string;
}

export function checkTyped(task: PracticeTask, input: string): PracticeResult {
  return {
    matches: parseTyped(input, task.kind) === expectedValue(task),
    typed: input.trim(),
    digits: digitsOf(task),
    spanish: spokenText(task),
  };
}

/** Satz der Rückmeldung vor der spanischen Zeile. Ohne Wertung. */
export function resultLine(result: PracticeResult): string {
  return result.matches ? `Das war ${result.digits}.` : `Du hast ${result.typed} getippt. Es war ${result.digits}.`;
}

/** Hinweis, wenn der Knopf gesperrt ist. */
export const NEEDS_VOICE_TEXT =
  "Zahlen üben braucht eine spanische Stimme. Du kannst eine laden: iOS-Einstellungen, Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch.";
