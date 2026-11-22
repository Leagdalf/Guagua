// Punkt 11: Offline. Nach dem ersten Laden und sobald der Service Worker bereit ist, lädt die App auch dann neu,
// wenn der Vorschau-Server beendet ist, einschließlich der Schriften, und eine Aufgabe lässt sich lösen.
// Der Test beendet den Server selbst und startet ihn am Ende wieder. Das Projekt „offline“ läuft zuletzt (siehe playwright.config.ts).

import type { Page } from "@playwright/test";
import { beginPlan, createProfile, homeButton, readProgress, weiter } from "./support/app";
import { unitById } from "./support/content";
import { expect, test } from "./support/fixtures";
import { isUp, startServer, stopServer } from "./support/server";

const unit = unitById("u01");

/** Schriften, die geladen sind (Familie und Schnitt), aus `document.fonts`. */
async function loadedFonts(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return Array.from(document.fonts)
      .filter((font) => font.status === "loaded")
      .map((font) => `${font.family.replace(/"/g, "")} ${font.style} ${font.weight}`);
  });
}

test("Die App lädt neu und lässt sich bedienen, auch wenn der Vorschau-Server beendet ist", async ({ page }) => {
  test.setTimeout(150_000);
  const failed: string[] = [];
  page.on("requestfailed", (request) => failed.push(request.url()));

  // Erster Start mit Netz, bis zur Linie.
  await createProfile(page);
  await homeButton(page, "Haltestelle beginnen");
  await expect(page.getByRole("button", { name: "Beginnen" })).toBeVisible();
  await page.getByRole("button", { name: "Schließen" }).click();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();

  // Der Service Worker ist bereit, wenn er aktiv ist und die Seite kontrolliert.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect
    .poll(async () => page.evaluate(() => navigator.serviceWorker.controller !== null), { message: "Service Worker kontrolliert die Seite" })
    .toBe(true);
  // Auch die Schnitte der Schriften sind jetzt geladen (und damit zwischengespeichert).
  const online = await loadedFonts(page);
  expect(online.some((font) => font.includes("Newsreader") && font.includes("italic"))).toBe(true);
  expect(online.some((font) => font.includes("Figtree"))).toBe(true);
  // Alles Vorgehaltene liegt im Cache: Der Service Worker hat die Dateien der App eingesammelt.
  await expect
    .poll(async () => page.evaluate(async () => (await caches.keys()).length), { message: "Cache des Service Workers" })
    .toBeGreaterThan(0);
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const names = await caches.keys();
        let urls: string[] = [];
        for (const name of names) urls = urls.concat((await (await caches.open(name)).keys()).map((request) => request.url));
        return urls.filter((url) => url.endsWith(".woff2")).length;
      }),
    )
    .toBeGreaterThanOrEqual(5);

  await stopServer();
  try {
    expect(await isUp(), "Vorschau-Server ist beendet").toBe(false);
    failed.length = 0;

    await page.reload();
    await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
    await expect(page.getByText("Heute · Haltestelle 1")).toBeVisible();
    const offline = await loadedFonts(page);
    expect(offline.some((font) => font.includes("Newsreader") && font.includes("italic"))).toBe(true);
    expect(offline.some((font) => font.includes("Figtree"))).toBe(true);

    // Eine Aufgabe lässt sich lösen: die ersten vier Karten ansehen und die Paare zuordnen.
    await homeButton(page, "Haltestelle beginnen");
    await beginPlan(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Neue Karten");
    for (let i = 0; i < 4; i++) await weiter(page);
    const left = page.getByRole("group", { name: "Spanisch" });
    const right = page.getByRole("group", { name: "Deutsch" });
    for (const item of unit.items.slice(0, 4)) {
      await left.getByRole("button", { name: item.es, exact: true }).click();
      await right.getByRole("button", { name: item.de, exact: true }).click();
    }
    await weiter(page);
    await expect(page.getByText("Karte 5 von 16", { exact: true })).toBeVisible();

    // Der Lernstand wird offline gespeichert und überlebt ein weiteres Neuladen.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
    expect((await readProgress(page)).units.u01.step).toBe(2);

    // Der Sprachführer ist offline benutzbar.
    await page.getByRole("navigation", { name: "Bereiche" }).getByRole("button", { name: "Sprachführer" }).click();
    await page.getByRole("searchbox", { name: "Suchen" }).fill("medico");
    await expect(page.getByText("Necesito un médico.", { exact: true })).toBeVisible();

    // Keine Anfrage der Seite ist ohne Antwort geblieben (alles kam aus dem Cache des Service Workers).
    expect(failed, "Anfragen, die offline scheiterten").toEqual([]);
  } finally {
    await startServer();
  }
});
