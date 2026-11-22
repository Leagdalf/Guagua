// Gemeinsame Grundlage aller Ablauftests: `test` mit Sprach-Attrappe und Netzwächter.
// Der Wächter merkt sich jede Anfrage der Seite und lässt den Test scheitern, wenn eine Adresse außerhalb von
// localhost:4273 angefragt wurde (docs/02-spezifikation.md, Abschnitt 1: keine Anfragen an Dritte).

import { expect, test as base } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { createProfile, playUnit, STORAGE_KEY } from "./app";
import { ORIGIN } from "./server";
import { SPANISH_VOICES, TWO_VOICES, installSpeech } from "./speech";

export type VoiceSetup = "es" | "two" | "none";

const VOICES = { es: SPANISH_VOICES, two: TWO_VOICES, none: [] };

type Fixtures = {
  /** Welche Stimmen die Attrappe meldet. */
  voices: VoiceSetup;
  /** Öffnet eine zweite, frische Browser-Umgebung (eigener Speicher) mit denselben Einstellungen und derselben Überwachung. */
  freshPage: () => Promise<Page>;
};

function isForeign(url: string): boolean {
  if (/^(data|blob|about):/.test(url)) return false;
  return !url.startsWith(`${ORIGIN}/`) && url !== ORIGIN;
}

function watch(context: BrowserContext, foreign: string[]): void {
  context.on("request", (request) => {
    if (isForeign(request.url())) foreign.push(request.url());
  });
}

type WorkerFixtures = {
  /** Gespeicherter Lernstand nach Haltestelle 1 (JSON-Text), einmal je Worker durch echtes Durchspielen erzeugt. */
  unit1: string;
};

/** Legt den Lernstand in den Speicher, bevor die Seite lädt. Ein vorhandener Stand bleibt (Neuladen überschreibt nichts). */
export async function seed(page: Page, json: string): Promise<void> {
  // Die Fixture `unit1` hat eine andere Seite nach vorn geholt: diese Seite wieder nach vorn.
  await page.bringToFront();
  await page.addInitScript(
    ([key, value]) => {
      try {
        if (window.localStorage.getItem(key as string) === null) window.localStorage.setItem(key as string, value as string);
      } catch {
        // Speicher gesperrt: der Test scheitert dann an seinen eigenen Prüfungen.
      }
    },
    [STORAGE_KEY, json],
  );
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  unit1: [
    async ({ browser }, use, workerInfo) => {
      const { viewport, baseURL, locale, timezoneId } = workerInfo.project.use;
      const context = await browser.newContext({ viewport, baseURL, locale, timezoneId, serviceWorkers: "block" });
      const page = await context.newPage();
      // Eine Seite im Hintergrund bekommt unter Windows keine Animationsbilder; Klicks warteten dann ewig auf „stabil“.
      await page.bringToFront();
      await installSpeech(page, SPANISH_VOICES);
      await createProfile(page);
      await playUnit(page, "u01");
      const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
      await context.close();
      if (raw === null) throw new Error("Haltestelle 1 hat keinen Lernstand hinterlassen");
      await use(raw);
    },
    { scope: "worker", timeout: 120_000 },
  ],

  voices: ["es", { option: true }],

  page: async ({ page, voices }, use) => {
    const foreign: string[] = [];
    watch(page.context(), foreign);
    await installSpeech(page, VOICES[voices]);
    await use(page);
    expect(foreign, "Anfragen an fremde Adressen").toEqual([]);
  },

  freshPage: async ({ browser, voices }, use, testInfo) => {
    const foreign: string[] = [];
    const contexts: BrowserContext[] = [];
    const { viewport, baseURL, locale, timezoneId } = testInfo.project.use;
    await use(async () => {
      const context = await (browser as Browser).newContext({ viewport, baseURL, locale, timezoneId, serviceWorkers: "block" });
      contexts.push(context);
      watch(context, foreign);
      const page = await context.newPage();
      await page.bringToFront();
      await installSpeech(page, VOICES[voices]);
      return page;
    });
    await Promise.all(contexts.map((context) => context.close()));
    expect(foreign, "Anfragen an fremde Adressen").toEqual([]);
  },
});

export { expect };
