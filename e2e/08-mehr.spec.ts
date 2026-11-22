// Punkt 8: Mehr. Name ändern, Ruhemodus, Export und Import, kaputter Import, Spickzettel, Über die App.

import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { createProfile, open, readProgress, STORAGE_KEY, tab, writeProgress } from "./support/app";
import { expect, seed, test } from "./support/fixtures";
import { spoken } from "./support/speech";

async function openMore(page: Page, entry: RegExp): Promise<void> {
  await tab(page, "Mehr");
  await expect(page.getByRole("heading", { level: 1, name: "Mehr" })).toBeVisible();
  await page.getByRole("button", { name: entry }).click();
}

const back = (page: Page) => page.getByRole("button", { name: "Zurück" }).click();

/** Alle Schlüssel des Speichers (der Lernstand und Sicherungen davon). */
async function storageKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(window.localStorage).sort());
}

test("Das Menü von Mehr führt zu den vier Unterseiten, jede hat „Zurück“ @telefon", async ({ page }) => {
  await createProfile(page);
  await tab(page, "Mehr");
  const entries: Array<[RegExp, string]> = [
    [/^Spickzettel/, "Spickzettel"],
    [/^Einstellungen/, "Einstellungen"],
    [/^Fortschritt sichern/, "Fortschritt sichern"],
    [/^Über die App/, "Über die App"],
  ];
  for (const [button, title] of entries) {
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await back(page);
    await expect(page.getByRole("heading", { level: 1, name: "Mehr" })).toBeVisible();
  }
});

test("Name ändern bleibt nach dem Neuladen @telefon", async ({ page }) => {
  await createProfile(page, "Lena");
  await openMore(page, /^Einstellungen/);
  const name = page.getByLabel("Name", { exact: true });
  await expect(name).toHaveValue("Lena");
  await name.fill("Mia Sofia");
  await expect.poll(async () => (await readProgress(page)).profile.name).toBe("Mia Sofia");

  // Ein leerer Name wird nicht übernommen, der letzte gültige gilt weiter.
  await name.fill("   ");
  await expect(page.getByText(/Bis dahin gilt: Mia Sofia/)).toBeVisible();
  expect((await readProgress(page)).profile.name).toBe("Mia Sofia");

  await page.reload();
  await openMore(page, /^Einstellungen/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Mia Sofia");
  // Der Stimmentest nennt den neuen Namen.
  await page.getByRole("button", { name: "Stimme testen" }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toBe("Hola, Mia Sofia");
});

test("Ruhemodus blendet Punkte und Serie aus, ohne sie zu verlieren @telefon", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page);
  await openMore(page, /^Über die App/);
  await expect(page.getByText("Punkte", { exact: true })).toBeVisible();
  await expect(page.getByText("Serie", { exact: true })).toBeVisible();
  await expect(page.getByText("310", { exact: true })).toBeVisible();
  await back(page);

  await page.getByRole("button", { name: /^Einstellungen/ }).click();
  const calm = page.getByRole("group", { name: "Ruhemodus" });
  await calm.getByRole("button", { name: "An" }).click();
  await expect(calm.getByRole("button", { name: "An" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await readProgress(page)).profile.calm).toBe(true);
  await back(page);

  await page.getByRole("button", { name: /^Über die App/ }).click();
  await expect(page.getByText("Version", { exact: true })).toBeVisible();
  await expect(page.getByText("Punkte", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Serie", { exact: true })).toHaveCount(0);
  // Die App rechnet im Hintergrund weiter.
  expect((await readProgress(page)).stats.points).toBe(310);

  // Auch nach dem Neuladen bleibt er an, und wieder aus bringt die Zahlen zurück.
  await page.reload();
  await openMore(page, /^Über die App/);
  await expect(page.getByText("Punkte", { exact: true })).toHaveCount(0);
  await back(page);
  await page.getByRole("button", { name: /^Einstellungen/ }).click();
  await page.getByRole("group", { name: "Ruhemodus" }).getByRole("button", { name: "Aus" }).click();
  await back(page);
  await page.getByRole("button", { name: /^Über die App/ }).click();
  await expect(page.getByText("310", { exact: true })).toBeVisible();
});

test("Export als Text und Import in einem frischen Browser-Kontext stellen denselben Stand her, mit Rückfrage", async ({
  page,
  freshPage,
  unit1,
}) => {
  await seed(page, unit1);
  // Zwischenablage als Attrappe: Der Browser ohne Nutzerfreigabe verweigert das Lesen. Die App ruft `writeText` im Klick auf.
  await page.addInitScript(() => {
    let stored = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void (stored = text), readText: async () => stored },
    });
  });
  await open(page);
  const original = await readProgress(page);
  await openMore(page, /^Fortschritt sichern/);

  // Export: in die Zwischenablage kopieren.
  await page.getByRole("button", { name: "In die Zwischenablage kopieren" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Kopiert\./ })).toBeVisible();
  const exported = await page.evaluate(() => navigator.clipboard.readText());
  const file = JSON.parse(exported);
  expect(file.format).toBe("guagua-sicherung");
  expect(file.progress).toEqual(original);

  // Frischer Kontext: leerer Speicher, anderer Name.
  const other = await freshPage();
  await createProfile(other, "Fremd");
  expect(await storageKeys(other)).toEqual([STORAGE_KEY]);
  await openMore(other, /^Fortschritt sichern/);
  await other.getByLabel("Oder Text einfügen").fill(exported);
  await other.getByRole("button", { name: "Text prüfen" }).click();

  // Rückfrage mit dem, was kommt, und mit dem, was ersetzt wird.
  await expect(other.getByRole("heading", { level: 1, name: "Stand importieren?" })).toBeVisible();
  await expect(other.getByText("Das würde importiert:")).toBeVisible();
  const summary = other.locator("dl");
  await expect(summary).toContainText("Lena");
  await expect(summary).toContainText("16");
  await expect(summary).toContainText("1 von 10");
  await expect(summary).toContainText("310");
  await expect(other.getByText(/Dein aktueller Stand von Fremd wird ersetzt/)).toBeVisible();
  // Bis zur Bestätigung ändert sich nichts.
  expect((await readProgress(other)).profile.name).toBe("Fremd");

  // „Abbrechen“ geht zurück, nichts ist geändert.
  await other.getByRole("button", { name: "Abbrechen" }).click();
  await expect(other.getByRole("heading", { level: 1, name: "Fortschritt sichern" })).toBeVisible();
  expect((await readProgress(other)).profile.name).toBe("Fremd");

  await other.getByRole("button", { name: "Text prüfen" }).click();
  await other.getByRole("button", { name: "Jetzt importieren" }).click();
  await expect(other.getByText(/Der Stand von Lena ist importiert/)).toBeVisible();

  expect(await readProgress(other)).toEqual(original);
  // Der alte Stand liegt als Sicherung auf dem Gerät.
  const keys = await storageKeys(other);
  const backup = keys.find((key) => key.startsWith(`${STORAGE_KEY}:backup-`));
  expect(backup, "Sicherung des vorherigen Standes").toBeTruthy();
  const saved = await other.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), backup ?? "");
  expect(saved.profile.name).toBe("Fremd");

  await other.getByRole("button", { name: "Fertig" }).click();
  await tab(other, "Linie");
  await expect(other.getByText("1 von 10 abgeschlossen")).toBeVisible();
  await expect(other.getByText("Mission offen")).toBeVisible();
});

test("Ohne Zwischenablage zeigt die App den Sicherungstext zum Markieren", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  });
  await open(page);
  const original = await readProgress(page);
  await openMore(page, /^Fortschritt sichern/);
  await page.getByRole("button", { name: "In die Zwischenablage kopieren" }).click();
  await expect(page.getByText(/Kopieren geht hier nicht/)).toBeVisible();
  const text = await page.getByLabel("Text der Sicherung").inputValue();
  expect(JSON.parse(text).progress).toEqual(original);
});

test("Export als Datei bekommt einen Namen mit Datum ohne den Namen der Lernenden", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page);
  await openMore(page, /^Fortschritt sichern/);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Als Datei speichern" }).first().click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^guagua-sicherung-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await file.path();
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  expect(parsed.format).toBe("guagua-sicherung");
  expect(parsed.progress.profile.name).toBe("Lena");
});

test("Kaputter Importtext ändert nichts", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page);
  const before = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  const keysBefore = await storageKeys(page);
  await openMore(page, /^Fortschritt sichern/);

  const cases: Array<[string, RegExp]> = [
    ["", /Da steht noch nichts/],
    ['{"format": "guagua-sicherung", "schema": 1, "progress": {', /lässt sich nicht lesen/],
    ["kein json", /lässt sich nicht lesen/],
    ['{"hallo": "welt"}', /keine Sicherung aus Guagua/],
    ['{"format":"guagua-sicherung","schema":2,"progress":{}}', /anderen Version/],
    ['{"format":"guagua-sicherung","schema":1,"progress":{"schema":1,"profile":{"name":""}}}', /keinen gültigen Lernstand/],
  ];
  for (const [text, expected] of cases) {
    await page.getByLabel("Oder Text einfügen").fill(text);
    await page.getByRole("button", { name: "Text prüfen" }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Nicht importiert.");
    await expect(alert).toContainText(expected);
    await expect(page.getByRole("heading", { level: 1, name: "Fortschritt sichern" })).toBeVisible();
  }

  expect(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)).toBe(before);
  expect(await storageKeys(page), "keine Sicherung angelegt, weil nichts importiert wurde").toEqual(keysBefore);
});

test("Der Spickzettel zeigt die Zahlen von 0 bis 100, die Wochentage und die Grammatik begonnener Haltestellen @telefon", async ({
  page,
  unit1,
}) => {
  await seed(page, unit1);
  await open(page);
  await openMore(page, /^Spickzettel/);

  await expect(page.getByRole("heading", { level: 2, name: "Zahlen von 0 bis 100" })).toBeVisible();
  const numbers = page.locator("ul.ref-list--numbers > li");
  await expect(numbers).toHaveCount(101);
  await expect(numbers.first()).toContainText("0");
  await expect(numbers.first()).toContainText("cero");
  await expect(numbers.last()).toContainText("100");
  await expect(numbers.last()).toContainText("cien");

  // Tippen auf eine Zahl spricht sie.
  await numbers.last().getByRole("button").click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toBe("cien");

  await expect(page.getByRole("heading", { level: 2, name: "Wochentage" })).toBeVisible();
  await expect(page.getByText("lunes", { exact: true })).toBeVisible();
  await expect(page.getByText("domingo", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Aussprache" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Grammatik" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3 }).first()).toContainText("Haltestelle 1");
});

test("Der Spickzettel ohne begonnene Haltestelle nennt, wann die Grammatik kommt", async ({ page }) => {
  await createProfile(page);
  await openMore(page, /^Spickzettel/);
  await expect(page.getByText("Sobald du eine Haltestelle beginnst, stehen hier ihre Grammatiktabellen.")).toBeVisible();
  await expect(page.locator("ul.ref-list--numbers > li")).toHaveCount(101);
});

test("Über die App nennt Version, Stand der Inhalte, Lizenzen und den KI-Hinweis", async ({ page, unit1 }) => {
  await seed(page, unit1);
  await open(page);
  await openMore(page, /^Über die App/);
  await expect(page.getByText("Version", { exact: true })).toBeVisible();
  await expect(page.getByText("0.1.0", { exact: true })).toBeVisible();
  await expect(page.getByText("Stand der Inhalte", { exact: true })).toBeVisible();
  await expect(page.getByText("Newsreader (SIL Open Font License 1.1)")).toBeVisible();
  await expect(page.getByText("Code und Lerninhalte sind mit KI-Unterstützung entstanden.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Lernzeit je Tag" })).toBeVisible();
  await expect(page.getByText(/Zielwert: Median zwischen/)).toBeVisible();
});

test("Ein beschädigter Lernstand wird nie stillschweigend überschrieben", async ({ page }) => {
  await createProfile(page);
  await writeProgress(page, { schema: 1, kaputt: true });
  await page.reload();
  // Statt einer leeren App erscheint eine Meldung mit Sicherung oder Neustart.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toHaveCount(0);
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  expect(JSON.parse(raw ?? "{}")).toEqual({ schema: 1, kaputt: true });
});
