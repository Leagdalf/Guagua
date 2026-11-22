// Ergänzungen zu Punkt 2: Dialog (Anhören und Rollenspiel), Übersicht einer abgeschlossenen Haltestelle,
// zwei Haltestellen an einem Tag, freie Runde „10 Karten extra“.

import { beginPlan, boxCounts, createProfile, feedback, headingText, homeButton, kindOf, open, playNewCards, playGrammar, readProgress, solveTask, weiter } from "./support/app";
import { unitById } from "./support/content";
import { expect, seed, test } from "./support/fixtures";
import { spoken } from "./support/speech";

const unit = unitById("u01");
const lines = unit.dialogue.lines;
const firstLearner = lines.findIndex((line) => line.learner);

test("Dialog: Zeilen erscheinen einzeln und werden gesprochen, die Übersetzung liegt verdeckt, das Rollenspiel verbirgt die eigene Zeile", async ({
  page,
}) => {
  await createProfile(page, "Lena");
  await homeButton(page, "Haltestelle beginnen");
  await beginPlan(page);
  await playNewCards(page, unit);
  await playGrammar(page, unit);

  // Anhören: erst eine Zeile, jedes „Weiter“ zeigt und spricht die nächste.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dialog · anhören");
  await expect(page.getByText(`Zeile 1 von ${lines.length}`, { exact: true })).toBeVisible();
  await expect(page.locator("ol.sx-dialogue > li")).toHaveCount(1);
  await expect(page.getByText(lines[0]!.de)).toHaveCount(0);
  await page.getByRole("button", { name: "Übersetzung zeigen" }).click();
  await expect(page.getByText(lines[0]!.de, { exact: true })).toBeVisible();
  const before = (await spoken(page)).length;
  await weiter(page);
  await expect(page.locator("ol.sx-dialogue > li")).toHaveCount(2);
  await expect.poll(async () => (await spoken(page)).length).toBe(before + 1);
  // Der Name der Lernenden ersetzt {name} in Text und Ton.
  expect((await spoken(page)).at(-1)?.text).toBe(lines[1]!.es.replaceAll("{name}", "Lena"));
  await expect(page.getByText("{name}", { exact: false })).toHaveCount(0);
  for (let i = 2; i < lines.length; i++) await weiter(page);
  await page.getByRole("button", { name: "Rollenspiel beginnen" }).click();

  // Rollenspiel: Zeilen der anderen Person werden gesprochen, bei der eigenen steht nur die deutsche Vorgabe.
  for (let i = 0; i < firstLearner; i++) await page.getByRole("button", { name: "Weiter", exact: true }).click();
  const mine = lines[firstLearner]!;
  const mineEs = mine.es.replaceAll("{name}", "Lena");
  await expect(page.getByText(mine.de.replaceAll("{name}", "Lena"), { exact: true })).toBeVisible();
  await expect(page.getByText(mineEs, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Aufdecken" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Saß" })).toHaveCount(0);

  const spokenBefore = (await spoken(page)).length;
  await page.getByRole("button", { name: "Aufdecken" }).click();
  await expect(page.getByText(mineEs, { exact: true })).toBeVisible();
  await expect.poll(async () => (await spoken(page)).length).toBe(spokenBefore + 1);
  expect((await spoken(page)).at(-1)?.text).toBe(mineEs);
  await expect(page.getByRole("button", { name: "Saß" })).toBeVisible();

  // „Noch mal“ verdeckt die Zeile wieder, aber höchstens einmal je Zeile.
  await page.getByRole("button", { name: "Noch mal" }).click();
  await expect(page.getByText(mineEs, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Aufdecken" }).click();
  await expect(page.getByText(mineEs, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Noch mal" })).toHaveCount(0);
  await page.getByRole("button", { name: "Saß" }).click();

  // Das Rollenspiel ändert keine Karten und gibt keine Punkte, die 20 Punkte kommen einmal mit dem Ende des Schritts.
  let progress = await readProgress(page);
  expect(progress.stats.points).toBe(0);
  expect(progress.units.u01.step).toBe(4);
  for (let i = firstLearner + 1; i < lines.length; i++) {
    if (lines[i]?.learner) {
      await page.getByRole("button", { name: "Aufdecken" }).click();
      await page.getByRole("button", { name: "Saß" }).click();
    } else {
      await page.getByRole("button", { name: i === lines.length - 1 ? "Zur Abschlussrunde" : "Weiter", exact: true }).click();
    }
  }
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Abschlussrunde");
  progress = await readProgress(page);
  expect(progress.stats.points).toBe(20);
  expect(progress.units.u01.step).toBe(5);
  expect(boxCounts(progress)).toEqual({ 1: 16, 2: 0, 3: 0, 4: 0, 5: 0 });
});

test("Tippen auf eine abgeschlossene Haltestelle öffnet ihre Übersicht mit Karten, Grammatik und Dialog", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page);
  await page.locator("ol.line > li").first().getByRole("button").click();
  await expect(page.getByRole("heading", { level: 1, name: unit.title_es })).toBeVisible();
  for (const section of ["Karten", "Grammatik", "Dialog"]) await expect(page.getByRole("heading", { level: 2, name: section })).toBeVisible();
  for (const item of unit.items) await expect(page.getByText(item.es, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(unit.grammar.topic_de)).toBeVisible();
  // Jede Karte, jedes Beispiel und jede Dialogzeile hat einen Tonknopf.
  const audio = page.getByRole("button", { name: "Anhören" });
  expect(await audio.count()).toBeGreaterThanOrEqual(unit.items.length + lines.length);
  await audio.first().click();
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  await page.getByRole("button", { name: "Zurück zur Linie" }).click();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
});

test("Zwei Haltestellen an einem Tag: Tippen auf die offene Haltestelle 2 beginnt sie sofort", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page);
  await expect(page.getByText("Für heute fertig")).toBeVisible();
  const second = page.locator("ol.line > li").nth(1);
  await expect(second).toContainText("offen");
  await second.getByRole("button").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Heute · Haltestelle 2");
  // Die Karten von Haltestelle 1 sind erst morgen fällig: kein Wiederholen in der Liste.
  const rows = page.getByRole("list", { name: "Schritte" }).getByRole("listitem");
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("Neue Karten");
  await beginPlan(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Neue Karten");
});

test("„10 Karten extra“ ist reine Übung: keine Fächer, keine Punkte", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page);
  const before = await readProgress(page);
  await homeButton(page, "10 Karten extra");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Heute");
  await expect(page.getByText("10 Karten extra", { exact: true }).first()).toBeVisible();
  await beginPlan(page);

  let solved = 0;
  while (kindOf(await headingText(page))) {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Extra");
    await solveTask(page, solved !== 2);
    await expect(feedback(page)).toBeVisible();
    solved++;
    await weiter(page);
  }
  expect(solved).toBeGreaterThanOrEqual(10);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zusammenfassung");
  await expect(page.getByText("Die freie Runde ist zu Ende.")).toBeVisible();
  await expect(page.getByText("Sie ändert keine Fächer und gibt keine Punkte.")).toBeVisible();

  const after = await readProgress(page);
  expect(after.cards).toEqual(before.cards);
  expect(after.stats.points).toBe(before.stats.points);
});
