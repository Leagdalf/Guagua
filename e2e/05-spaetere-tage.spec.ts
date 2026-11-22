// Punkt 5: Spätere Tage. Wiederholungen über simulierte Tage, bis Karten in Fach 3 fällig sind, dann die Schreibaufgabe.

import type { Page } from "@playwright/test";
import {
  beginPlan,
  boxCounts,
  feedback,
  headingText,
  homeButton,
  kindOf,
  open,
  readProgress,
  solveTask,
  submitWritten,
  weiter,
} from "./support/app";
import type { TaskKind } from "./support/app";
import { itemsByDe } from "./support/content";
import { expect, seed, test } from "./support/fixtures";

const ACCENTED = /[áéíóú]/;
const SPECIAL = /[áéíóúñü¿¡]/;
const strip = (text: string): string => text.normalize("NFD").replace(/\p{M}+/gu, "");

/** Tippt Text und nutzt für jedes Sonderzeichen den Zeichenknopf, alles andere über die Tastatur. */
async function typeWithCharButtons(page: Page, text: string): Promise<void> {
  const field = page.getByLabel("Spanisch");
  await field.fill("");
  await field.focus();
  for (const char of text) {
    if (SPECIAL.test(char)) await page.getByRole("button", { name: char, exact: true }).click();
    else await page.keyboard.type(char);
  }
}

async function reviewDay1(page: Page): Promise<void> {
  await open(page, "?tage=1");
  await homeButton(page, "Mit Wiederholen beginnen");
  await beginPlan(page);
  for (let n = 1; n <= 16; n++) {
    await solveTask(page, true);
    await weiter(page);
  }
  await page.getByRole("button", { name: "Schließen" }).click();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
}

test("Tag 4: Karten in Fach 3 sind fällig und kommen als Schreibaufgabe", async ({ page, unit1 }) => {
  await seed(page, unit1);

  // Tag 2: alle 16 Karten richtig, sie steigen in Fach 3 und sind erst am Tag 4 wieder dran.
  await reviewDay1(page);
  expect(boxCounts(await readProgress(page))[3]).toBe(16);
  await open(page, "?tage=2");
  await expect(page.getByText(/Karten (sind|ist) fällig/)).toHaveCount(0);
  await expect(page.getByText("Erst 16 Karten wiederholen", { exact: false })).toHaveCount(0);

  // Tag 4: 16 Karten in Fach 3 fällig.
  await open(page, "?tage=4");
  await expect(page.getByText(/Erst 16 Karten wiederholen/)).toBeVisible();
  await homeButton(page, "Mit Wiederholen beginnen");
  await beginPlan(page);

  const kinds: TaskKind[] = [];
  let usedChars = false;
  let usedAccent = false;
  let usedWrong = false;
  let usedEnter = false;
  let emptyChecked = false;

  while (kindOf(await headingText(page))) {
    const kind = kindOf(await headingText(page)) as TaskKind;
    kinds.push(kind);
    if (kind !== "write") {
      await solveTask(page, true);
      await weiter(page);
      continue;
    }

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Wiederholen · (noch einmal · )?Schreib es auf Spanisch$/);
    const prompt = ((await page.locator(".sx-prompt-de").first().textContent()) ?? "").trim();
    const solution = itemsByDe(prompt)[0]?.es ?? "";
    expect(solution, `Karte zu „${prompt}“`).not.toBe("");

    // Die Schreibaufgabe zeigt kein Spanisch vor der Antwort. „Prüfen“ ist gesperrt, solange das Feld leer ist.
    await expect(page.getByLabel("Spanisch")).toHaveAttribute("lang", "es");
    if (!emptyChecked) {
      await expect(page.getByRole("button", { name: "Prüfen" })).toBeDisabled();
      emptyChecked = true;
    }

    if (!usedChars && SPECIAL.test(solution)) {
      // Eingabe mit den Zeichenknöpfen: á é í ó ú ñ ü ¿ ¡
      await typeWithCharButtons(page, solution);
      await expect(page.getByLabel("Spanisch")).toHaveValue(solution);
      await page.getByRole("button", { name: "Prüfen" }).click();
      await expect(feedback(page)).toBeVisible();
      await expect(feedback(page)).toContainText("Richtig.");
      await expect(feedback(page)).not.toContainText("Achte auf den Akzent");
      usedChars = true;
    } else if (!usedAccent && ACCENTED.test(solution)) {
      // Akzent fehlt: richtig, mit Hinweis auf die Schreibweise.
      await submitWritten(page, strip(solution));
      await expect(feedback(page)).toContainText("Richtig. Achte auf den Akzent:");
      await expect(feedback(page)).toContainText(solution);
      usedAccent = true;
    } else if (!usedWrong && !SPECIAL.test(solution)) {
      await submitWritten(page, "xyz qwv");
      await expect(feedback(page)).toContainText("Falsch. Richtig ist:");
      await expect(feedback(page)).toContainText(solution);
      await expect(page.getByText("Deine Antwort:")).toBeVisible();
      usedWrong = true;
    } else if (!usedEnter) {
      await page.getByLabel("Spanisch").fill(solution);
      await page.getByLabel("Spanisch").press("Enter");
      await expect(feedback(page)).toContainText("Richtig.");
      usedEnter = true;
    } else {
      await submitWritten(page, solution);
      await expect(feedback(page)).toContainText("Richtig.");
    }
    // Nach der Antwort ist das Feld gesperrt, „Weiter“ führt zur nächsten Aufgabe.
    await expect(page.getByLabel("Spanisch")).toBeDisabled();
    await weiter(page);
  }

  expect(usedChars && usedAccent && usedWrong && usedEnter, "alle Fälle der Schreibaufgabe wurden gespielt").toBe(true);
  // Satzmuster („me llamo …“) bleiben bei „Erinnern“, alle übrigen Karten kommen als Schreiben.
  expect(kinds.filter((kind) => kind === "recall").length).toBeGreaterThanOrEqual(1);
  expect(kinds.filter((kind) => kind === "write").length).toBeGreaterThanOrEqual(15);

  // Fächer: die Karte mit fehlendem Akzent zählt als richtig, die falsche Karte fällt in Fach 1.
  const progress = await readProgress(page);
  const boxes = boxCounts(progress);
  expect(boxes[1]).toBe(1);
  expect(boxes[4]).toBe(15);
});

test("Groß-/Kleinschreibung, Randleerzeichen und ein fehlender Akzent zählen nicht als Fehler @telefon", async ({ page, unit1 }) => {
  // Regeln der Antwortprüfung (Spezifikation 2.4) an einer echten Schreibaufgabe: „  PERDON  “ für „perdón“.
  await seed(page, unit1);
  await reviewDay1(page);
  await open(page, "?tage=4");
  await homeButton(page, "Mit Wiederholen beginnen");
  await beginPlan(page);

  let checked = false;
  while (kindOf(await headingText(page)) && !checked) {
    if (kindOf(await headingText(page)) !== "write") {
      await solveTask(page, true);
      await weiter(page);
      continue;
    }
    const prompt = ((await page.locator(".sx-prompt-de").first().textContent()) ?? "").trim();
    const solution = itemsByDe(prompt)[0]?.es ?? "";
    if (!ACCENTED.test(solution)) {
      await solveTask(page, true);
      await weiter(page);
      continue;
    }
    // Groß- und Kleinschreibung, Randleerzeichen und Satzzeichen zählen nicht.
    await submitWritten(page, `  ${strip(solution).toUpperCase().replace(/[¿?¡!.,]/g, "")}  `);
    await expect(feedback(page)).toContainText("Richtig. Achte auf den Akzent:");
    checked = true;
  }
  expect(checked).toBe(true);
});
