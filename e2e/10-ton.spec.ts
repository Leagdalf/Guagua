// Punkt 10: Ton. `speechSynthesis` ist durch eine Attrappe ersetzt, die jede Äußerung aufzeichnet.

import { beginPlan, createProfile, headingText, homeButton, kindOf, open, playUnit, solveTask, weiter } from "./support/app";
import { spokenTextOf, unitById } from "./support/content";
import { expect, seed, test } from "./support/fixtures";
import { clearSpoken, spoken } from "./support/speech";

const unit1 = unitById("u01");

test("Der Stimmentest spricht „Hola, {Name}“ mit dem Namen @telefon", async ({ page }) => {
  await page.goto("");
  await page.getByRole("button", { name: "Trotzdem im Browser weitermachen" }).click();
  await page.getByLabel("Dein Name").fill("Marisol");
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await clearSpoken(page);
  await page.getByRole("button", { name: "Stimme testen" }).click();
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  const [utterance] = await spoken(page);
  expect(utterance).toMatchObject({ text: "Hola, Marisol", lang: "es-ES", voice: "fake-es-ES", rate: 0.9, inGesture: true });
});

test("„Weiter“ auf einer neuen Karte spricht die nächste Karte, ohne zweites Tippen @telefon", async ({ page }) => {
  await createProfile(page);
  await homeButton(page, "Haltestelle beginnen");
  await clearSpoken(page);
  await beginPlan(page);

  // „Beginnen“ spricht schon die erste Karte, im selben Tippen.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Neue Karten");
  await expect.poll(async () => (await spoken(page)).map((u) => u.text)).toEqual([spokenTextOf(unit1.items[0]!)]);
  expect((await spoken(page))[0]?.inGesture).toBe(true);

  // Jedes „Weiter“ spricht die nächste Karte. Bei Satzmustern ist es der Beispielsatz, nicht „me llamo …“.
  const block = unit1.items.slice(0, 4);
  for (let i = 1; i < block.length; i++) {
    await clearSpoken(page);
    await weiter(page);
    await expect(page.getByText(`Karte ${i + 1} von 16`, { exact: true })).toBeVisible();
    await expect.poll(async () => (await spoken(page)).map((u) => u.text)).toEqual([spokenTextOf(block[i]!)]);
    expect((await spoken(page))[0]?.inGesture).toBe(true);
  }
  // Das Frame „me llamo …“ im vierten Block: der Beispielsatz wird gesprochen.
  expect(spokenTextOf(unit1.items[12]!)).toBe("Me llamo Ana.");
});

test("„Anhören“ spricht mit Tempo 0,9, „Langsam“ mit Tempo 0,6, jeweils im Klick", async ({ page }) => {
  await createProfile(page);
  await homeButton(page, "Haltestelle beginnen");
  await beginPlan(page);
  await page.getByRole("button", { name: "Langsam" }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.rate).toBe(0.6);
  await page.getByRole("button", { name: "Anhören" }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.rate).toBe(0.9);
  expect((await spoken(page)).every((u) => u.inGesture)).toBe(true);
});

test("Eine Hören-Aufgabe zeigt den spanischen Text nicht an, bis sie beantwortet ist @telefon", async ({ page, unit1: stand }) => {
  await seed(page, stand);
  await open(page, "?tage=1");
  await homeButton(page, "Mit Wiederholen beginnen");
  await clearSpoken(page);
  await beginPlan(page);

  // Karten in Fach 2 kommen als Hörenaufgabe; der Ton beginnt im selben Tippen wie die Aufgabe.
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Was hörst du?");
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  const heard = (await spoken(page))[0]!;
  expect(heard.inGesture).toBe(true);

  // Nirgends steht Spanisch auf dem Bildschirm: kein sichtbares Element mit lang="es", kein Text einer Karte.
  await expect(page.locator('[lang="es"]:visible')).toHaveCount(0);
  const text = ((await page.locator("main").textContent()) ?? "").toLowerCase();
  for (const item of unit1.items.filter((entry) => entry.es.length >= 6)) {
    expect(text, `„${item.es}“ steht nicht auf der Seite`).not.toContain(item.es.toLowerCase());
  }
  expect(text).not.toContain(heard.text.toLowerCase());
  await expect(page.getByRole("button", { name: "Anhören" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Langsam" })).toBeEnabled();

  // Nach der Antwort zeigt die Rückmeldung, was zu hören war.
  await solveTask(page, true);
  await expect(page.getByText("Gehört:")).toBeVisible();
  await expect(page.locator('[lang="es"]:visible').first()).toBeVisible();
});

test.describe("ohne spanische Stimme", () => {
  test.use({ voices: "none" });

  test("Stimmentest und Tonknöpfe sind gesperrt, ein Hinweis erklärt es einmal", async ({ page }) => {
    await page.goto("");
    await page.getByRole("button", { name: "Trotzdem im Browser weitermachen" }).click();
    await page.getByLabel("Dein Name").fill("Lena");
    await page.getByRole("button", { name: "Weiter", exact: true }).click();

    await expect(page.getByRole("button", { name: "Stimme testen" })).toBeDisabled();
    await expect(page.getByText(/Auf diesem Gerät ist keine spanische Stimme da/).first()).toBeVisible();
    await expect(page.getByText(/iOS-Einstellungen, Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch/).first()).toBeVisible();
    // Die App läuft ohne Ton weiter.
    await expect(page.getByRole("button", { name: "Weiter zur Linie" })).toBeEnabled();
    await page.getByRole("button", { name: "Weiter zur Linie" }).click();

    // Auf der Linie steht der Hinweis (einmal je Start) und lässt sich schließen.
    const notice = page.getByRole("status").filter({ hasText: "keine spanische Stimme" });
    await expect(notice).toBeVisible();
    await notice.getByRole("button", { name: "Verstanden" }).click();
    await expect(notice).toHaveCount(0);

    // In der Lerneinheit sind alle Tonknöpfe sichtbar, aber gesperrt; kein Hinweis mehr.
    await homeButton(page, "Haltestelle beginnen");
    await beginPlan(page);
    await expect(page.getByRole("button", { name: "Anhören" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Langsam" })).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: "keine spanische Stimme" })).toHaveCount(0);
    expect(await spoken(page)).toEqual([]);
  });

  test("Die Wiederholrunde bleibt durchspielbar: Hören wird zu Erkennen", async ({ page, unit1: stand }) => {
    await seed(page, stand);
    await open(page, "?tage=1");
    await homeButton(page, "Mit Wiederholen beginnen");
    await beginPlan(page);
    // Fach 2 wäre „Hören“, ohne Stimme kommt „Erkennen“ mit Spanisch auf dem Bildschirm.
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Wiederholen · Was heißt das?");
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("Was hörst du?");
    await page.getByRole("button", { name: "Schließen" }).click();

    await page.getByRole("button", { name: "Mit Wiederholen beginnen" }).click();
    await beginPlan(page);
    while (kindOf(await headingText(page))) {
      await solveTask(page, true);
      await weiter(page);
    }
    expect(await spoken(page)).toEqual([]);
  });

  test("Eine ganze Haltestelle läuft ohne Ton bis zur Zusammenfassung", async ({ page }) => {
    await createProfile(page);
    await playUnit(page, "u01");
    await expect(page.getByText("1 von 10 abgeschlossen")).toBeVisible();
    expect(await spoken(page)).toEqual([]);
  });
});
