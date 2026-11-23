// Punkt 4: Zweiter Tag (?tage=1): 16 Karten zum Wiederholen, Haltestelle 2, Wiederholrunde „1 von 16“.

import { beginPlan, boxCounts, feedback, headingText, homeButton, kindOf, open, readProgress, solveTask, weiter } from "./support/app";
import { expect, seed, test } from "./support/fixtures";
import { unitById } from "./support/content";

const unit2 = unitById("u02");

/** Tage zwischen zwei Kalendertagen JJJJ-MM-TT. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

test("Am zweiten Tag zeigt die Startseite 16 Karten zum Wiederholen und Haltestelle 2 @telefon", async ({ unit1, page }) => {
  await seed(page, unit1);
  await open(page, "?tage=1");

  await expect(page.getByText("Tag 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Heute · Haltestelle 2")).toBeVisible();
  await expect(page.getByText(`Erst 16 Karten wiederholen, dann ${unit2.items.length} neue.`)).toBeVisible();
  await expect(page.getByText(unit2.title_es, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mit Wiederholen beginnen" })).toBeVisible();
  // Haltestelle 1 steht abgeschlossen in der Linie, Haltestelle 2 ist „heute“.
  const stops = page.locator("ol.line > li");
  await expect(stops.nth(0)).toContainText("abgeschlossen");
  await expect(stops.nth(1)).toContainText("heute");
});

test("Die Einheit am zweiten Tag beginnt mit der Wiederholrunde „1 von 16“, danach liegen die Karten in Fach 3 @telefon", async ({
  unit1,
  page,
}) => {
  await seed(page, unit1);
  await open(page, "?tage=1");
  await homeButton(page, "Mit Wiederholen beginnen");

  // Fahrplan: Wiederholen steht oben in der Liste, dann die Schritte von Haltestelle 2.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Heute · Haltestelle 2");
  const rows = page.getByRole("list", { name: "Schritte" }).getByRole("listitem");
  await expect(rows).toHaveCount(6);
  await expect(rows.nth(0)).toContainText("Wiederholen");
  await expect(rows.nth(0)).toContainText("16 Karten");
  await beginPlan(page);

  // Karten aus Fach 2 kommen als Hörenaufgabe. Der Zähler beginnt bei 1 von 16.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wiederholen · Was hörst du?");
  await expect(page.getByText("1 von 16", { exact: true })).toBeVisible();

  for (let n = 1; n <= 16; n++) {
    await expect(page.getByText(`${n} von 16`, { exact: true })).toBeVisible();
    await solveTask(page, true);
    await weiter(page);
  }
  // Nach der Runde geht es bei Haltestelle 2 mit den neuen Karten weiter.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Neue Karten");
  expect(kindOf(await headingText(page))).toBeNull();

  const progress = await readProgress(page);
  expect(boxCounts(progress)).toEqual({ 1: 0, 2: 0, 3: 16, 4: 0, 5: 0 });
  const dates = Object.values<any>(progress.cards).map((card) => daysBetween(card.lastSeen, card.due));
  expect(new Set(dates)).toEqual(new Set([3]));
  // Der Fahrplan hat Wiederholen als erledigt behandelt: Haltestelle 2 läuft bei Schritt 2.
  expect(progress.units.u02.step).toBe(2);
  expect(progress.stats.lastReviewDay).toBeTruthy();
  await expect(feedback(page)).toHaveCount(0);
});

test("Nach der Wiederholrunde steht auf der Startseite „weiter bei Schritt 2“ und keine neue Wiederholung", async ({ unit1, page }) => {
  await seed(page, unit1);
  await open(page, "?tage=1");
  await homeButton(page, "Mit Wiederholen beginnen");
  await beginPlan(page);
  for (let n = 1; n <= 16; n++) {
    await solveTask(page, true);
    await weiter(page);
  }
  await page.getByRole("button", { name: "Schließen" }).click();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
  await expect(page.getByText("Weiter bei Schritt 2 von 6: Neue Karten.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Haltestelle fortsetzen" })).toBeVisible();
});
