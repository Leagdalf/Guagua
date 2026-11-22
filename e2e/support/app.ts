// Wiederkehrende Abläufe: Profil anlegen, Aufgaben richtig oder falsch lösen, eine Haltestelle durchspielen.
// Alles über Rollen und sichtbare Texte, so wie die Lernende die App bedient.

import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { itemsByDe, itemsByEs, spokenTextOf, units, unitById } from "./content";
import type { Unit } from "./content";
import { spoken } from "./speech";

export const NAME = "Lena";
export const STORAGE_KEY = "guagua:v1";

// ---------- Adressen und Speicher ----------

/** Öffnet die App. `query` zum Beispiel `?tage=1`. */
export async function open(page: Page, query = ""): Promise<void> {
  await page.goto(query);
}

export async function readProgress(page: Page): Promise<any> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

export async function writeProgress(page: Page, progress: unknown): Promise<void> {
  await page.evaluate(([key, value]) => window.localStorage.setItem(key as string, value as string), [STORAGE_KEY, JSON.stringify(progress)]);
}

/** Zahl der Karten je Fach aus dem gespeicherten Lernstand. */
export function boxCounts(progress: any): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const card of Object.values<any>(progress.cards)) counts[card.box] = (counts[card.box] ?? 0) + 1;
  return counts;
}

// ---------- Erster Start und Leiste ----------

export async function createProfile(page: Page, name = NAME, query = ""): Promise<void> {
  await open(page, query);
  await page.getByRole("button", { name: "Trotzdem im Browser weitermachen" }).click();
  await page.getByLabel("Dein Name").fill(name);
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("button", { name: "Weiter zur Linie" }).click();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
}

export async function tab(page: Page, label: "Linie" | "Missionen" | "Sprachführer" | "Mehr"): Promise<void> {
  await page.getByRole("navigation", { name: "Bereiche" }).getByRole("button", { name: label }).click();
}

/** Der Hauptknopf der Startseite (er heißt je nach Lage anders). */
export async function homeButton(page: Page, name: string | RegExp): Promise<void> {
  await page.getByRole("button", { name }).click();
}

// ---------- Aufgaben ----------

export type TaskKind = "recognize" | "listen" | "recall" | "cloze" | "write" | "build";

const QUESTION: Array<[RegExp, TaskKind]> = [
  [/Was heißt das\?/, "recognize"],
  [/Was hörst du\?/, "listen"],
  [/Wie heißt das auf Spanisch\?/, "recall"],
  [/Welches Wort fehlt\?/, "cloze"],
  [/Schreib es auf Spanisch/, "write"],
  [/Setze den Satz zusammen/, "build"],
];

export async function headingText(page: Page): Promise<string> {
  return ((await page.getByRole("heading", { level: 1 }).first().textContent()) ?? "").trim();
}

/** Aufgabentyp aus der Beschriftung, `null` wenn gerade keine Aufgabe zu sehen ist. */
export function kindOf(heading: string): TaskKind | null {
  for (const [pattern, kind] of QUESTION) if (pattern.test(heading)) return kind;
  return null;
}

export function feedback(page: Page): Locator {
  return page.getByRole("status").filter({ hasText: /^(Richtig|Falsch)/ });
}

const normalize = (text: string): string => text.replace(/…/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

export interface SolvedTask {
  kind: TaskKind;
  /** Die Frage (Spanisch beim Erkennen, Deutsch sonst), leer beim Hören. */
  prompt: string;
  correct: boolean;
}

/** Text der Frage in den Aufgaben (spanische oder deutsche Zeile über den Antworten). */
async function promptText(page: Page, kind: TaskKind): Promise<string> {
  const locator = kind === "recognize" || kind === "cloze" ? page.locator("#sx-prompt") : page.locator(".sx-prompt-de");
  return ((await locator.first().textContent()) ?? "").trim();
}

async function optionTexts(page: Page): Promise<{ list: Locator; texts: string[] }> {
  const list = page.getByRole("group", { name: "Antworten" }).getByRole("button");
  await expect(list.first()).toBeVisible();
  const texts = (await list.allTextContents()).map((text) => text.replace(/richtig$|deine Antwort$/, "").trim());
  return { list, texts };
}

/** Index der richtigen Antwort einer Auswahlaufgabe, aus den Lerninhalten. */
async function correctChoiceIndex(page: Page, kind: TaskKind, texts: string[]): Promise<number> {
  const options = texts.map(normalize);
  if (kind === "cloze") {
    const prompt = await promptText(page, kind);
    const cloze = units.flatMap((unit) => unit.cloze).find((entry) => normalize(entry.es) === normalize(prompt));
    if (!cloze) throw new Error(`Lückensatz nicht in den Inhalten: ${prompt}`);
    return options.indexOf(normalize(cloze.answer));
  }
  if (kind === "recognize") {
    const prompt = await promptText(page, kind);
    const answers = itemsByEs(prompt).map((item) => normalize(item.de));
    return options.findIndex((option) => answers.includes(option));
  }
  if (kind === "recall") {
    const prompt = await promptText(page, kind);
    const answers = itemsByDe(prompt).map((item) => normalize(item.es));
    return options.findIndex((option) => answers.includes(option));
  }
  // listen: nur Ton. Anhören tippen und lesen, was die Attrappe aufgezeichnet hat.
  const before = (await spoken(page)).length;
  await page.getByRole("button", { name: "Anhören" }).first().click();
  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(before);
  const heard = normalize((await spoken(page)).at(-1)?.text ?? "");
  const answers = itemsByEs(heard)
    .concat(allBySpoken(heard))
    .map((item) => normalize(item.de));
  return options.findIndex((option) => answers.includes(option));
}

function allBySpoken(heard: string) {
  return units.flatMap((unit) => unit.items).filter((item) => normalize(spokenTextOf(item)) === heard);
}

async function placeTokens(page: Page, tokens: string[]): Promise<void> {
  const words = page.getByRole("group", { name: "Bausteine" });
  for (const token of tokens) await words.getByRole("button", { name: token, exact: true }).first().click();
}

async function solveBuild(page: Page, right: boolean): Promise<void> {
  const prompt = await promptText(page, "build");
  const build = units.flatMap((unit) => unit.build).find((entry) => normalize(entry.de) === normalize(prompt));
  if (!build) throw new Error(`Satzbau nicht in den Inhalten: ${prompt}`);
  const order = right ? build.tokens : [...build.tokens].reverse();
  await placeTokens(page, order);
  await page.getByRole("button", { name: "Prüfen" }).click();
}

/** Tippt Text ins Schreibfeld und prüft. */
export async function submitWritten(page: Page, text: string): Promise<void> {
  await page.getByLabel("Spanisch").fill(text);
  await page.getByRole("button", { name: "Prüfen" }).click();
}

/**
 * Löst die Aufgabe, die gerade zu sehen ist, und wartet auf die Rückmeldung. „Weiter“ tippt sie nicht.
 * `right: false` wählt gezielt eine falsche Antwort.
 */
export async function solveTask(page: Page, right = true): Promise<SolvedTask> {
  // Nach „Weiter“ baut die App die neue Ansicht erst einen Augenblick später auf: auf eine Aufgabe warten.
  await expect.poll(async () => kindOf(await headingText(page)), { message: "Aufgabe erscheint" }).not.toBeNull();
  const kind = kindOf(await headingText(page)) as TaskKind;
  let prompt = "";
  if (kind === "build") {
    prompt = await promptText(page, kind);
    await solveBuild(page, right);
  } else if (kind === "write") {
    prompt = await promptText(page, kind);
    const items = itemsByDe(prompt);
    if (items.length === 0) throw new Error(`Karte nicht in den Inhalten: ${prompt}`);
    await submitWritten(page, right ? (items[0]?.es ?? "") : "xyz qwv");
  } else {
    prompt = kind === "listen" ? "" : await promptText(page, kind);
    const { list, texts } = await optionTexts(page);
    const correct = await correctChoiceIndex(page, kind, texts);
    if (correct < 0) throw new Error(`Richtige Antwort nicht gefunden: ${kind} ${prompt} ${texts.join(" | ")}`);
    const index = right ? correct : texts.findIndex((_, i) => i !== correct);
    await list.nth(index).click();
  }
  await expect(feedback(page)).toBeVisible();
  const text = ((await feedback(page).textContent()) ?? "").trim();
  const correct = text.startsWith("Richtig");
  expect(correct, `Rückmeldung zu ${kind} „${prompt}“: ${text}`).toBe(right);
  return { kind, prompt, correct };
}

/** „Weiter“ tippen. Stand eine Rückmeldung da, wartet die Hilfe, bis die nächste Ansicht sie abgelöst hat. */
export async function weiter(page: Page): Promise<void> {
  const hadFeedback = (await feedback(page).count()) > 0;
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  if (hadFeedback) await expect(feedback(page)).toHaveCount(0);
}

/**
 * Löst Aufgaben nacheinander, bis die Beschriftung keine Aufgabe mehr zeigt.
 * `wrongAt`: Nummern (ab 1) der Aufgaben, die falsch beantwortet werden.
 */
export async function playTasks(page: Page, options: { wrongAt?: number[]; max?: number; stopAfter?: number } = {}): Promise<SolvedTask[]> {
  const solved: SolvedTask[] = [];
  const max = options.max ?? 80;
  for (let n = 1; n <= max; n++) {
    if (!kindOf(await headingText(page))) break;
    solved.push(await solveTask(page, !(options.wrongAt ?? []).includes(n)));
    if (options.stopAfter !== undefined && n >= options.stopAfter) break;
    await weiter(page);
  }
  return solved;
}

// ---------- Einheit ----------

/** Vom Fahrplan: „Beginnen“ oder „Weiter bei Schritt n“. */
export async function beginPlan(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(/^Heute/);
  await page.getByRole("button", { name: /^(Beginnen|Weiter bei )/ }).click();
}

/** Neue Karten: alle Karten ansehen, Paare zuordnen. */
export async function playNewCards(page: Page, unit: Unit): Promise<void> {
  const blocks: Array<typeof unit.items> = [];
  for (let i = 0; i < unit.items.length; i += 4) blocks.push(unit.items.slice(i, i + 4));
  for (const block of blocks) {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Neue Karten");
    for (let i = 0; i < block.length; i++) await weiter(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Ordne zu/);
    const left = page.getByRole("group", { name: "Spanisch" });
    const right = page.getByRole("group", { name: "Deutsch" });
    for (const item of block) {
      await left.getByRole("button", { name: item.es, exact: true }).click();
      await right.getByRole("button", { name: item.de, exact: true }).click();
    }
    await weiter(page);
  }
}

/** Grammatik: Erklärung, dann die Lückensätze. */
export async function playGrammar(page: Page, unit: Unit): Promise<void> {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Grammatik");
  await page.getByRole("button", { name: "Weiter zu den Lückensätzen" }).click();
  for (const _ of unit.cloze) {
    await solveTask(page, true);
    await weiter(page);
  }
}

/** Dialog: anhören, dann das Rollenspiel (eigene Zeilen aufdecken, „Saß“). */
export async function playDialogue(page: Page, unit: Unit): Promise<void> {
  const lines = unit.dialogue.lines;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dialog · anhören");
  for (let i = 1; i < lines.length; i++) await weiter(page);
  await page.getByRole("button", { name: "Rollenspiel beginnen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dialog · Rollenspiel");
  for (let i = 0; i < lines.length; i++) {
    const last = i === lines.length - 1;
    if (lines[i]?.learner) {
      await page.getByRole("button", { name: "Aufdecken" }).click();
      await page.getByRole("button", { name: "Saß" }).click();
    } else {
      await page.getByRole("button", { name: last ? "Zur Abschlussrunde" : "Weiter", exact: true }).click();
    }
  }
}

/** Mission-Seite und Zusammenfassung bis „Zur Linie“. */
export async function playMissionAndSummary(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mission");
  await weiter(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zusammenfassung");
  await page.getByRole("button", { name: "Zur Linie" }).click();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
}

/**
 * Spielt eine Haltestelle von der Startseite aus komplett durch (mit Wiederholrunde, falls fällig).
 * `wrongAt`: Nummern der Aufgaben in der Abschlussrunde, die falsch beantwortet werden.
 */
export async function playUnit(page: Page, unitId: string, options: { wrongAt?: number[] } = {}): Promise<void> {
  const unit = unitById(unitId);
  await page.getByRole("button", { name: /^(Haltestelle beginnen|Haltestelle fortsetzen|Mit Wiederholen beginnen)$/ }).click();
  await beginPlan(page);
  // Wiederholen kommt zuerst, wenn Karten fällig sind.
  if (kindOf(await headingText(page))) await playTasks(page);
  await playNewCards(page, unit);
  await playGrammar(page, unit);
  await playDialogue(page, unit);
  await playTasks(page, { wrongAt: options.wrongAt });
  await playMissionAndSummary(page);
}
