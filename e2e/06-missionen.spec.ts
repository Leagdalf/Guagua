// Punkt 6: Missionen. Abhaken mit „Wie lief es?“ und Notiz gibt genau einmal 50 Punkte; Überspringen und Nachholen.

import type { Page } from "@playwright/test";
import { open, readProgress, tab } from "./support/app";
import { unitById } from "./support/content";
import { expect, seed, test } from "./support/fixtures";

const mission = unitById("u01").mission;
const missionItem = (page: Page) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: mission.title_de }) });

async function points(page: Page): Promise<number> {
  return (await readProgress(page)).stats.points;
}

test("Mission abhaken mit Gefühl und Notiz gibt genau einmal 50 Punkte @telefon", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page);
  const start = await points(page);

  await tab(page, "Missionen");
  await expect(page.getByRole("heading", { name: "Missionen" })).toBeVisible();
  // Zehn Missionen: Nr. 1 offen, alle anderen gesperrt.
  await expect(page.locator("ol.mi__list > li")).toHaveCount(10);
  await expect(missionItem(page)).toContainText("Haltestelle 1 · offen");
  await expect(page.locator("ol.mi__list > li").nth(1)).toContainText("gesperrt, wird mit Haltestelle 2 offen");
  await expect(missionItem(page)).toContainText(mission.task_de);
  for (const phrase of mission.say) await expect(missionItem(page).getByText(phrase, { exact: true })).toBeVisible();

  await missionItem(page).getByRole("button", { name: "Abhaken" }).click();
  await expect(page.getByText("Wie lief es? (freiwillig)")).toBeVisible();
  await page.getByRole("button", { name: "ging so" }).click();
  await expect(page.getByRole("button", { name: "ging so" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Notiz (freiwillig)").fill("Der Kellner hat zurückgegrüßt.");
  await page.getByRole("button", { name: "Mission erledigt" }).click();

  await expect(missionItem(page)).toContainText("Haltestelle 1 · erledigt");
  await expect(missionItem(page)).toContainText("Wie lief es: ging so.");
  await expect(missionItem(page)).toContainText("Der Kellner hat zurückgegrüßt.");
  await expect(missionItem(page).getByRole("button", { name: "Abhaken" })).toHaveCount(0);
  expect(await points(page)).toBe(start + 50);
  const saved = (await readProgress(page)).missions[mission.id];
  expect(saved).toMatchObject({ state: "done", feeling: "mittel", note: "Der Kellner hat zurückgegrüßt." });

  // Neuladen und erneut ansehen: nichts wird noch einmal gewertet.
  await page.reload();
  await tab(page, "Missionen");
  await expect(missionItem(page)).toContainText("Haltestelle 1 · erledigt");
  expect(await points(page)).toBe(start + 50);
  // Die Startseite zeigt die erledigte Mission nicht mehr als offen.
  await tab(page, "Linie");
  await expect(page.getByText("Mission offen")).toHaveCount(0);
});

test("Die Mission lässt sich ohne Gefühl und ohne Notiz erledigen", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page);
  const start = await points(page);
  await tab(page, "Missionen");
  await missionItem(page).getByRole("button", { name: "Abhaken" }).click();
  await page.getByRole("button", { name: "Mission erledigt" }).click();
  await expect(missionItem(page)).toContainText("erledigt");
  expect(await points(page)).toBe(start + 50);
  const saved = (await readProgress(page)).missions[mission.id];
  expect(saved.feeling).toBeUndefined();
  expect(saved.note).toBeUndefined();
});

test("Abhaken auf der Startseite öffnet die Mission mit dem Formular", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page);
  await expect(page.getByText("Mission offen")).toBeVisible();
  await page.getByRole("button", { name: "Abhaken" }).click();
  await expect(page.getByRole("heading", { name: "Missionen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mission erledigt" })).toBeVisible();
});

test("Überspringen kostet nichts, Nachholen gibt später die 50 Punkte einmal", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page);
  const start = await points(page);

  await tab(page, "Missionen");
  await missionItem(page).getByRole("button", { name: "Überspringen" }).click();
  await expect(missionItem(page)).toContainText("Haltestelle 1 · übersprungen");
  expect(await points(page)).toBe(start);
  expect((await readProgress(page)).missions[mission.id].state).toBe("skipped");

  // Übersprungen heißt: nicht mehr angeheftet auf der Startseite.
  await tab(page, "Linie");
  await expect(page.getByText("Mission offen")).toHaveCount(0);

  // Nachholen: Aufgabe und Sätze stehen noch da, „Nachholen“ öffnet das Formular.
  await tab(page, "Missionen");
  await expect(missionItem(page)).toContainText(mission.task_de);
  await expect(missionItem(page).getByRole("button", { name: "Überspringen" })).toHaveCount(0);
  await missionItem(page).getByRole("button", { name: "Nachholen" }).click();
  await page.getByRole("button", { name: "leicht" }).click();
  await page.getByRole("button", { name: "Mission erledigt" }).click();
  await expect(missionItem(page)).toContainText("Haltestelle 1 · erledigt");
  await expect(missionItem(page)).toContainText("Wie lief es: leicht.");
  expect(await points(page)).toBe(start + 50);
});

test("Keine Mission sperrt eine Haltestelle: Haltestelle 2 lässt sich mit offener Mission beginnen", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page, "?tage=1");
  await expect(page.getByText("Mission offen")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mit Wiederholen beginnen" })).toBeEnabled();
});
