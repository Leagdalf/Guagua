// Punkt 9: Endstation. Lernstand „alle zehn Haltestellen abgeschlossen“ vorbereitet, 30 Aufgaben bis „Deine Linie“.

import type { Page } from "@playwright/test";
import { beginPlan, headingText, homeButton, kindOf, open, readProgress, solveTask, weiter } from "./support/app";
import { expect, seed, test } from "./support/fixtures";
import { allStopsDone } from "./support/seed";

async function seedAllDone(page: Page, unit1: string): Promise<any> {
  const progress = allStopsDone(unit1);
  await seed(page, JSON.stringify(progress));
  await open(page);
  return progress;
}

test("Nach Haltestelle 10 ist die Endstation offen und zeigt 30 gemischte Aufgaben @telefon", async ({ page, unit1 }) => {
  await seedAllDone(page, unit1);
  await expect(page.getByText("10 von 10 abgeschlossen")).toBeVisible();
  await expect(page.getByText("Heute · Endstation")).toBeVisible();
  await expect(page.getByText("Repaso final", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("30 gemischte Aufgaben über alle Karten.")).toBeVisible();
  const stops = page.locator("ol.line > li");
  await expect(stops).toHaveCount(11);
  for (let i = 0; i < 10; i++) await expect(stops.nth(i)).toContainText("abgeschlossen");
  await homeButton(page, "Endstation beginnen");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Heute · Endstation");
  await expect(page.getByRole("list", { name: "Schritte" }).getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("list", { name: "Schritte" })).toContainText("30 Aufgaben");
});

test("Die Endstation mit 30 Aufgaben führt zur Ansicht „Deine Linie“ @telefon", async ({ page, unit1 }) => {
  const seeded = await seedAllDone(page, unit1);
  await homeButton(page, "Endstation beginnen");
  await beginPlan(page);

  // Wiederholen entfällt, es geht gleich mit der Endstation los. Aufgabentyp nach Fach: Erkennen, Hören, Schreiben/Erinnern.
  const kinds = new Set<string>();
  for (let n = 1; n <= 30; n++) {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Endstation");
    await expect(page.getByText(`${n} von 30`, { exact: true })).toBeVisible();
    kinds.add((await solveTask(page, true)).kind);
    await weiter(page);
  }
  expect(kinds.size, `Aufgabentypen: ${[...kinds].join(", ")}`).toBeGreaterThanOrEqual(3);

  // Ansicht „Deine Linie“.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deine Linie");
  await expect(page.getByText("Du hast die ganze Linie geschafft.")).toBeVisible();
  await expect(page.getByText("10 Haltestellen und die Endstation.")).toBeVisible();
  const list = page.locator("dl.sx-summary");
  for (const label of ["Fach 1", "Fach 2", "Fach 3", "Fach 4", "Fach 5", "Missionen erledigt", "Aktive Tage", "Lernzeit", "Endstation", "Punkte"]) {
    await expect(list.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(list).toContainText("30 von 30 richtig");
  await expect(list).toContainText("3 von 10");
  // Karten je Fach: alle 154 verteilt.
  await expect(list.locator("dd").filter({ hasText: /Karten?$/ })).toHaveCount(5);

  const progress = await readProgress(page);
  expect(progress.finalReview).toMatchObject({ right: 30, total: 30 });
  expect(progress.finalRun).toBeUndefined();
  expect(progress.stats.points).toBe(seeded.stats.points + 300);

  await page.getByRole("button", { name: "Zur Linie" }).click();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
  await expect(page.getByText("Linie geschafft", { exact: true })).toBeVisible();
  await expect(page.getByText("30 von 30 richtig an der Endstation.")).toBeVisible();
  await homeButton(page, "Deine Linie ansehen");
  await expect(page.getByText("Du hast die ganze Linie geschafft.")).toBeVisible();
  await page.getByRole("button", { name: "Zurück zur Linie" }).click();
  await expect(page.getByText("Linie geschafft", { exact: true })).toBeVisible();
});

test("Eine falsche Antwort in der Endstation kommt wieder und zählt im Ergebnis als Fehler", async ({ page, unit1 }) => {
  await seedAllDone(page, unit1);
  await homeButton(page, "Endstation beginnen");
  await beginPlan(page);

  await solveTask(page, false);
  await expect(page.getByText("Falsch. Richtig ist:")).toBeVisible();
  await weiter(page);
  let repeated = false;
  while (kindOf(await headingText(page))) {
    const heading = await headingText(page);
    if (/noch einmal/.test(heading)) repeated = true;
    await solveTask(page, true);
    await weiter(page);
  }
  expect(repeated, "falsch beantwortete Karte kommt in derselben Runde wieder").toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deine Linie");
  await expect(page.locator("dl.sx-summary")).toContainText("29 von 30 richtig");
});

test("Neuladen mitten in der Endstation: dieselben Karten, keine Aufgabe doppelt gewertet", async ({ page, unit1 }) => {
  const seeded = await seedAllDone(page, unit1);
  await homeButton(page, "Endstation beginnen");
  await beginPlan(page);
  for (let n = 1; n <= 10; n++) {
    await solveTask(page, true);
    if (n < 10) await weiter(page);
  }
  const before = await readProgress(page);
  expect(before.finalRun.answered).toHaveLength(10);
  expect(before.stats.points).toBe(seeded.stats.points + 100);
  await page.reload();

  // Die Linie zeigt die Endstation als „läuft“.
  await expect(page.locator("ol.line > li").nth(10)).toContainText("läuft");
  await homeButton(page, "Endstation beginnen");
  await expect(page.getByRole("button", { name: "Weiter bei Aufgabe 11" })).toBeVisible();
  await page.getByRole("button", { name: "Weiter bei Aufgabe 11" }).click();
  await expect(page.getByText("11 von 30", { exact: true })).toBeVisible();
  expect((await readProgress(page)).finalRun.ids).toEqual(before.finalRun.ids);

  let solved = 0;
  while (kindOf(await headingText(page))) {
    await solveTask(page, true);
    solved++;
    await weiter(page);
  }
  expect(solved).toBe(20);
  await expect(page.locator("dl.sx-summary")).toContainText("30 von 30 richtig");
  expect((await readProgress(page)).stats.points).toBe(seeded.stats.points + 300);
});
