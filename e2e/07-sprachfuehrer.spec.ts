// Punkt 7: Sprachführer. Suche, Merken, „Zeigen“ im Vollbild, Anhören.

import type { Page } from "@playwright/test";
import { createProfile, readProgress, tab } from "./support/app";
import { phrasebook } from "./support/content";
import { expect, test } from "./support/fixtures";
import { spoken } from "./support/speech";

async function openPhrasebook(page: Page): Promise<void> {
  await createProfile(page);
  await tab(page, "Sprachführer");
  await expect(page.getByRole("heading", { level: 1, name: "Sprachführer" })).toBeVisible();
}

const search = (page: Page) => page.getByRole("searchbox", { name: "Suchen" });
const rows = (page: Page) => page.getByRole("listitem");

test("Suche nach „medico“ findet „Necesito un médico.“, „WASSER“ genau zwei Sätze, „xyz“ den leeren Zustand @telefon", async ({
  page,
}) => {
  await openPhrasebook(page);
  // Ohne Suche stehen alle Kategorien da.
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(phrasebook.categories.length);

  await search(page).fill("medico");
  await expect(page.getByText("Necesito un médico.", { exact: true })).toBeVisible();

  await search(page).fill("WASSER");
  await expect(rows(page)).toHaveCount(2);

  await search(page).fill("xyz");
  await expect(page.getByRole("status").filter({ hasText: "Nichts gefunden für „xyz“." })).toBeVisible();
  await expect(rows(page)).toHaveCount(0);

  // Zurück auf leer: wieder alles.
  await search(page).fill("");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(phrasebook.categories.length);
});

test("Suche ignoriert Akzente und Groß- und Kleinschreibung, auf Spanisch und Deutsch", async ({ page }) => {
  await openPhrasebook(page);
  await search(page).fill("NECESITO UN MEDICO");
  await expect(page.getByText("Necesito un médico.", { exact: true })).toBeVisible();
  await search(page).fill("necesito un médico");
  await expect(page.getByText("Necesito un médico.", { exact: true })).toBeVisible();
  await search(page).fill("Arzt");
  await expect(page.getByText("Necesito un médico.", { exact: true })).toBeVisible();
});

test("Stern merkt einen Satz, „Gemerkt“ erscheint oben und bleibt nach dem Neuladen @telefon", async ({ page }) => {
  await openPhrasebook(page);
  await expect(page.getByRole("heading", { level: 2, name: "Gemerkt" })).toHaveCount(0);
  await search(page).fill("medico");
  const row = rows(page).filter({ hasText: "Necesito un médico." }).first();
  await row.getByRole("button", { name: "Merken" }).click();
  await expect(row.getByRole("button", { name: "Nicht mehr merken" })).toBeVisible();

  await search(page).fill("");
  const headings = page.getByRole("heading", { level: 2 });
  await expect(headings.first()).toHaveText("Gemerkt");
  await expect(page.getByRole("region", { name: "Gemerkt" })).toContainText("Necesito un médico.");
  expect((await readProgress(page)).favorites).toHaveLength(1);

  await page.reload();
  await tab(page, "Sprachführer");
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Gemerkt");
  await expect(page.getByRole("region", { name: "Gemerkt" })).toContainText("Necesito un médico.");

  // Wieder entfernen: die Kategorie verschwindet.
  await page.getByRole("region", { name: "Gemerkt" }).getByRole("button", { name: "Nicht mehr merken" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Gemerkt" })).toHaveCount(0);
  expect((await readProgress(page)).favorites).toHaveLength(0);
});

test("„Zeigen“ öffnet das Vollbild mit großer Schrift, „Schließen“ schließt es @telefon", async ({ page }) => {
  await openPhrasebook(page);
  await search(page).fill("medico");
  const row = rows(page).filter({ hasText: "Necesito un médico." }).first();
  await row.getByRole("button", { name: "Zeigen" }).click();

  const overlay = page.getByRole("dialog", { name: "Satz im Vollbild" });
  await expect(overlay).toBeVisible();
  const es = overlay.getByText("Necesito un médico.", { exact: true });
  await expect(es).toBeVisible();
  await expect(es).toHaveAttribute("lang", "es");
  await expect(overlay.getByText(/Arzt/)).toBeVisible();
  // Schriftgröße: mindestens 48 px auf dem Telefon, 72 px auf dem iPad (docs/04-design.md).
  const width = page.viewportSize()?.width ?? 0;
  const size = await es.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  expect(size).toBeGreaterThanOrEqual(width < 700 ? 48 : 72);
  // Das Vollbild deckt die ganze App ab, auch die untere Leiste.
  const box = await overlay.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(width - 1);
  await expect(page.getByRole("button", { name: "Langsam vorlesen" })).toBeVisible();

  await page.getByRole("button", { name: "Langsam vorlesen" }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toBe("Necesito un médico.");
  const last = (await spoken(page)).at(-1);
  expect(last?.rate).toBe(0.6);
  expect(last?.inGesture).toBe(true);

  await page.getByRole("button", { name: "Schließen" }).click();
  await expect(overlay).toHaveCount(0);
  // Die Suche steht noch da, der Satz auch.
  await expect(search(page)).toHaveValue("medico");
});

test("Escape schließt das Vollbild ebenfalls", async ({ page }) => {
  await openPhrasebook(page);
  await search(page).fill("medico");
  await rows(page).first().getByRole("button", { name: "Zeigen" }).click();
  await expect(page.getByRole("dialog", { name: "Satz im Vollbild" })).toBeVisible();
  // Beim Öffnen geht der Fokus auf „Schließen“; erst danach lauscht das Vollbild auf Escape.
  await expect(page.getByRole("button", { name: "Schließen" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Anhören spricht den spanischen Satz im Klick", async ({ page }) => {
  await openPhrasebook(page);
  await search(page).fill("medico");
  await rows(page).filter({ hasText: "Necesito un médico." }).first().getByRole("button", { name: "Anhören" }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toBe("Necesito un médico.");
  expect((await spoken(page)).at(-1)).toMatchObject({ lang: "es-ES", rate: 0.9, inGesture: true });
});

test("Der Hinweis einer Kategorie steht über der Liste", async ({ page }) => {
  const withNote = phrasebook.categories.find((category) => category.note_de);
  test.skip(!withNote, "keine Kategorie mit Hinweis in den Inhalten");
  await openPhrasebook(page);
  const region = page.getByRole("region", { name: withNote?.title_de ?? "" });
  await expect(region.getByText(withNote?.note_de ?? "")).toBeVisible();
  const noteY = (await region.getByText(withNote?.note_de ?? "").boundingBox())?.y ?? 0;
  const listY = (await region.getByRole("listitem").first().boundingBox())?.y ?? 0;
  expect(noteY).toBeLessThan(listY);
});
