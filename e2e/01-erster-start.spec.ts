// Punkt 1: Erster Start (Installationshinweis, Name als Pflicht, Stimmentest, Linie).

import { createProfile, NAME, open, readProgress } from "./support/app";
import { expect, test } from "./support/fixtures";
import { spoken } from "./support/speech";

test("Erster Start führt über Hinweis, Name und Stimmentest zur Linie mit Haltestelle 1 @telefon", async ({ page }) => {
  await open(page);

  // Installationshinweis kommt zuerst, weil der Browser nicht als installierte App läuft.
  await expect(page.getByRole("heading", { name: "Guagua auf den Home-Bildschirm legen" })).toBeVisible();
  await expect(page.getByText("Zum Home-Bildschirm", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Trotzdem im Browser weitermachen" }).click();

  // Name ist Pflicht: ohne Namen ist „Weiter“ gesperrt, mit nur Leerzeichen auch.
  await expect(page.getByRole("heading", { name: "Wie heißt du?" })).toBeVisible();
  const weiter = page.getByRole("button", { name: "Weiter", exact: true });
  await expect(weiter).toBeDisabled();
  await page.getByLabel("Dein Name").fill("   ");
  await expect(weiter).toBeDisabled();
  await page.getByLabel("Dein Name").fill(NAME);
  await expect(weiter).toBeEnabled();
  await weiter.click();

  // Stimmentest spricht „Hola, {Name}“.
  await expect(page.getByRole("heading", { name: "Stimme testen" })).toBeVisible();
  await page.getByRole("button", { name: "Stimme testen" }).click();
  await expect.poll(async () => (await spoken(page)).map((u) => u.text)).toContain(`Hola, ${NAME}`);
  await page.getByRole("button", { name: "Weiter zur Linie" }).click();

  // Die Linie: elf Punkte, Haltestelle 1 ist heute, alle anderen gesperrt.
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
  await expect(page.getByText("0 von 10 abgeschlossen")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "¡Hola!" }).first()).toContainText("heute");
  await expect(page.getByText("Heute · Haltestelle 1")).toBeVisible();
  await expect(page.locator("ol.line > li")).toHaveCount(11);

  const progress = await readProgress(page);
  expect(progress.profile.name).toBe(NAME);
  expect(progress.schema).toBe(1);
});

test("Name mit mehr als 30 Zeichen wird nicht angenommen @telefon", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Trotzdem im Browser weitermachen" }).click();
  await page.getByLabel("Dein Name").fill("A".repeat(31));
  await expect(page.getByRole("button", { name: "Weiter", exact: true })).toBeDisabled();
  await page.getByLabel("Dein Name").fill("A".repeat(30));
  await expect(page.getByRole("button", { name: "Weiter", exact: true })).toBeEnabled();
});

test.describe("mit zwei spanischen Stimmen", () => {
  test.use({ voices: "two" });

  test("beide Stimmen stehen zur Wahl, die Wahl wird gespeichert und gesprochen", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Trotzdem im Browser weitermachen" }).click();
    await page.getByLabel("Dein Name").fill(NAME);
    await page.getByRole("button", { name: "Weiter", exact: true }).click();
    const group = page.getByRole("group", { name: "Stimme" });
    await expect(group.getByRole("button")).toHaveCount(3);
    await expect(group.getByRole("button", { name: /Monica/ })).toBeVisible();
    await group.getByRole("button", { name: /Monica/ }).click();
    await expect.poll(async () => (await readProgress(page)).profile.voiceURI).toBe("fake-es-ES");
    await page.getByRole("button", { name: "Stimme testen" }).click();
    await expect.poll(async () => (await spoken(page)).at(-1)?.voice).toBe("fake-es-ES");
  });
});

test("Profil bleibt nach dem Neuladen, der erste Start erscheint nicht noch einmal", async ({ page }) => {
  await createProfile(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wie heißt du?" })).toHaveCount(0);
});
