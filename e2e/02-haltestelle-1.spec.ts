// Punkt 2: Haltestelle 1 komplett, vom Fahrplan bis zur Zusammenfassung, mit einer falschen Antwort in der Abschlussrunde.

import {
  beginPlan,
  boxCounts,
  createProfile,
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

test("Haltestelle 1 vom Fahrplan bis zur Zusammenfassung @telefon", async ({ page }) => {
  await createProfile(page);

  // Startseite: Block „Heute“ und Hauptknopf.
  await expect(page.getByText("Heute · Haltestelle 1")).toBeVisible();
  await expect(page.getByText(`${unit.title_de}. 16 neue Karten.`)).toBeVisible();
  await homeButton(page, "Haltestelle beginnen");

  // Fahrplan der Einheit: erst das Tippen auf „Beginnen“ baut die erste Aufgabe.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Heute · Haltestelle 1");
  const rows = page.getByRole("list", { name: "Schritte" }).getByRole("listitem");
  await expect(rows).toHaveCount(5); // am ersten Tag kein Wiederholen
  await expect(rows.nth(0)).toContainText("Neue Karten");
  await expect(rows.nth(0)).toContainText("16 Karten");
  await expect(rows.nth(1)).toContainText("Grammatik");
  await expect(rows.nth(1)).toContainText(unit.grammar.topic_de);
  await expect(rows.nth(2)).toContainText("Dialog");
  await expect(rows.nth(2)).toContainText(unit.dialogue.setting_de);
  await expect(rows.nth(3)).toContainText("19 Aufgaben");
  await expect(rows.nth(4)).toContainText(unit.mission.title_de);
  await expect(page.getByText(unit.title_es, { exact: true }).first()).toBeVisible();
  expect(await readProgress(page).then((p) => Object.keys(p.units).length), "vor „Beginnen“ gilt die Haltestelle nicht als begonnen").toBe(0);
  await beginPlan(page);

  // Schritt 2: neue Karten und Paare. Nach den Paaren liegen die Karten in Fach 1.
  await playNewCards(page, unit);
  await expect.poll(async () => boxCounts(await readProgress(page))[1]).toBe(16);

  // Schritt 3 und 4.
  await playGrammar(page, unit);
  await playDialogue(page, unit);

  // Schritt 5: erste Aufgabe falsch. Die Rückmeldung nennt die Lösung, die Karte kommt später noch einmal.
  const seen: string[] = [];
  let wrongPrompt = "";
  let repeatAt = -1;
  for (let n = 1; n <= 40; n++) {
    const heading = await headingText(page);
    if (!kindOf(heading)) break;
    if (n === 1) {
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Abschlussrunde");
      await expect(page.getByText("1 von 19")).toBeVisible();
      const solved = await solveTask(page, false);
      wrongPrompt = solved.prompt;
      await expect(page.getByText("Falsch. Richtig ist:")).toBeVisible();
      await expect(page.getByText("deine Antwort")).toBeVisible();
      await expect(page.getByText("richtig", { exact: true })).toBeVisible();
      seen.push(wrongPrompt);
    } else {
      const solved = await solveTask(page, true);
      seen.push(solved.prompt);
      if (/noch einmal/.test(heading) && repeatAt < 0) {
        repeatAt = n;
        expect(solved.prompt).toBe(wrongPrompt);
      }
    }
    await weiter(page);
  }
  expect(repeatAt, "falsch beantwortete Karte kommt in derselben Runde wieder").toBeGreaterThan(0);
  expect(repeatAt - 1, "frühestens nach drei anderen Karten").toBeGreaterThanOrEqual(4);

  // Schritt 6 und Zusammenfassung.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mission");
  await weiter(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zusammenfassung");
  await expect(page.getByText("Haltestelle 1 ist geschafft.")).toBeVisible();
  await expect(page.getByText("1 von 10 Haltestellen abgeschlossen.")).toBeVisible();
  await expect(page.getByText("Neue Karten", { exact: true })).toBeVisible();
  await expect(page.getByText("Serie", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zur Linie" }).click();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();

  // Gespeicherter Lernstand: Haltestelle abgeschlossen. Die falsch beantwortete Karte bleibt in Fach 1 und ist morgen fällig
  // (Spezifikation 5.1: falsch heißt zurück in Fach 1; die Wiedervorlage in derselben Runde ändert das Fach nicht).
  const progress = await readProgress(page);
  expect(progress.units.u01.completedAt).toBeTruthy();
  expect(boxCounts(progress)).toEqual({ 1: 1, 2: 15, 3: 0, 4: 0, 5: 0 });
  const wrongCard = Object.values<any>(progress.cards).find((card) => card.box === 1);
  expect(wrongCard.wrong).toBe(1);
  expect(wrongCard.due > wrongCard.lastSeen).toBe(true);
});

test("Nach Haltestelle 1 steht die Linie auf abgeschlossen, Haltestelle 2 offen, die Mission offen, der Lernstand stimmt", async ({ page }) => {
  await createProfile(page);
  await homeButton(page, "Haltestelle beginnen");
  await beginPlan(page);
  await playNewCards(page, unit);
  await playGrammar(page, unit);
  await playDialogue(page, unit);
  for (let n = 1; n <= 40; n++) {
    if (!kindOf(await headingText(page))) break;
    await solveTask(page, true);
    await weiter(page);
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mission");
  await weiter(page);
  await page.getByRole("button", { name: "Zur Linie" }).click();

  const stops = page.locator("ol.line > li");
  await expect(stops.nth(0)).toContainText("abgeschlossen");
  await expect(stops.nth(1)).toContainText("offen");
  await expect(stops.nth(2)).toContainText("gesperrt");
  await expect(page.getByText("1 von 10 abgeschlossen")).toBeVisible();
  await expect(page.getByText("Mission offen")).toBeVisible();
  await expect(page.getByText(unit.mission.title_de).first()).toBeVisible();

  const progress = await readProgress(page);
  expect(boxCounts(progress)).toEqual({ 1: 0, 2: 16, 3: 0, 4: 0, 5: 0 });
  expect(progress.units.u01.completedAt).toBeTruthy();
  expect(progress.units.u01.answered).toBeUndefined();
  // 19 richtige Antworten à 10 (16 Karten, 3 Satzbau), 20 für den Dialog, 100 für die Haltestelle.
  expect(progress.stats.points).toBe(19 * 10 + 20 + 100);
  expect(progress.stats.streak).toBe(1);

  await page.getByRole("navigation", { name: "Bereiche" }).getByRole("button", { name: "Missionen" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Haltestelle 1 · offen" })).toBeVisible();
});
