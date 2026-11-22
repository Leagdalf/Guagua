// Punkt 3: Neuladen behält den Stand (Grammatik, Ende der Abschlussrunde, Mitte der Abschlussrunde).

import type { Page } from "@playwright/test";
import {
  beginPlan,
  boxCounts,
  createProfile,
  feedback,
  headingText,
  homeButton,
  kindOf,
  playDialogue,
  playGrammar,
  playNewCards,
  readProgress,
  solveTask,
  weiter,
} from "./support/app";
import { expect, test } from "./support/fixtures";
import { unitById } from "./support/content";

const unit = unitById("u01");

/** Startet Haltestelle 1 und spielt bis zum Beginn des Schritts `step` (3 = Grammatik, 5 = Abschlussrunde). */
async function playUntil(page: Page, step: 3 | 5): Promise<void> {
  await createProfile(page);
  await homeButton(page, "Haltestelle beginnen");
  await beginPlan(page);
  await playNewCards(page, unit);
  if (step === 3) return;
  await playGrammar(page, unit);
  await playDialogue(page, unit);
}

/** Nach dem Neuladen von der Startseite aus am gespeicherten Schritt weitermachen. */
async function resume(page: Page, step: number): Promise<void> {
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
  await expect(page.getByText(new RegExp(`Weiter bei Schritt ${step} von 6`))).toBeVisible();
  await homeButton(page, "Haltestelle fortsetzen");
  await expect(page.getByRole("button", { name: `Weiter bei Schritt ${step}` })).toBeVisible();
  await page.getByRole("button", { name: `Weiter bei Schritt ${step}` }).click();
}

test("Neuladen auf der Grammatik: die Einheit setzt bei der Grammatik fort", async ({ page }) => {
  await playUntil(page, 3);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Grammatik");
  await page.reload();
  await resume(page, 3);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Grammatik");
  expect(boxCounts(await readProgress(page))[1]).toBe(16);
});

test("Neuladen mitten in den Lückensätzen: die Einheit setzt bei der Grammatik fort, nichts ist doppelt", async ({ page }) => {
  await playUntil(page, 3);
  await page.getByRole("button", { name: "Weiter zu den Lückensätzen" }).click();
  await solveTask(page, true);
  await weiter(page);
  await solveTask(page, true);
  const before = await readProgress(page);
  await page.reload();
  await resume(page, 3);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Grammatik");
  const after = await readProgress(page);
  expect(after.stats.points, "Lückensätze geben keine Punkte, Neuladen ändert nichts").toBe(before.stats.points);
  expect(after.cards).toEqual(before.cards);
  await playGrammar(page, unit);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dialog · anhören");
});

test("Neuladen direkt nach der letzten Antwort der Abschlussrunde: Haltestelle lässt sich abschließen, Haltestelle 2 wird offen", async ({
  page,
}) => {
  await playUntil(page, 5);
  const total = unit.items.length + unit.build.length;
  for (let n = 1; n <= total; n++) {
    await solveTask(page, true);
    if (n < total) await weiter(page);
  }
  // Die letzte Antwort ist gegeben und gezeigt, „Weiter“ fehlt noch.
  await expect(feedback(page)).toBeVisible();
  await expect(page.getByText(`${total} von ${total}`)).toBeVisible();
  await page.reload();

  await resume(page, 5);
  // Alles ist beantwortet: Die Runde ist durch, die Mission folgt.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mission");
  await weiter(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zusammenfassung");
  await expect(page.getByText("Haltestelle 1 ist geschafft.")).toBeVisible();
  await page.getByRole("button", { name: "Zur Linie" }).click();

  const stops = page.locator("ol.line > li");
  await expect(stops.nth(0)).toContainText("abgeschlossen");
  await expect(stops.nth(1)).toContainText("offen");
  const progress = await readProgress(page);
  expect(progress.units.u01.completedAt).toBeTruthy();
  expect(boxCounts(progress)).toEqual({ 1: 0, 2: 16, 3: 0, 4: 0, 5: 0 });
  expect(progress.stats.points, "jede Antwort einmal gezählt").toBe(total * 10 + 20 + 100);
});

test("Neuladen mitten in der Abschlussrunde: Punkte und Fächer werden nicht doppelt gewertet", async ({ page }) => {
  await playUntil(page, 5);
  const total = unit.items.length + unit.build.length;
  const answeredBefore = 8;
  for (let n = 1; n <= answeredBefore; n++) {
    await solveTask(page, true);
    if (n < answeredBefore) await weiter(page);
  }
  const pointsBefore = (await readProgress(page)).stats.points;
  expect(pointsBefore).toBeGreaterThanOrEqual(answeredBefore * 10);
  await page.reload();

  const reloaded = await readProgress(page);
  expect(reloaded.stats.points).toBe(pointsBefore);
  expect(reloaded.units.u01.answered).toHaveLength(answeredBefore);
  await resume(page, 5);

  // Schon beantwortete Aufgaben kommen nicht wieder. Der Zähler macht dort weiter, wo die Runde stand.
  await expect(page.getByText(`${answeredBefore + 1} von ${total}`)).toBeVisible();
  let solved = 0;
  while (kindOf(await headingText(page))) {
    await solveTask(page, true);
    solved++;
    await weiter(page);
  }
  expect(solved).toBe(total - answeredBefore);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mission");
  await weiter(page);
  await page.getByRole("button", { name: "Zur Linie" }).click();
  const progress = await readProgress(page);
  expect(progress.stats.points).toBe(total * 10 + 20 + 100);
  expect(boxCounts(progress)).toEqual({ 1: 0, 2: 16, 3: 0, 4: 0, 5: 0 });
  const right = Object.values<any>(progress.cards).reduce((sum, card) => sum + card.right, 0);
  expect(right, "16 richtige Antworten in den Karten, keine doppelt").toBe(16);
});
