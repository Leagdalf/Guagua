import { defineConfig, devices } from "@playwright/test";
import { BASE_URL } from "./e2e/support/server";

// Ablauftests (docs/02-spezifikation.md, Abschnitt 8): WebKit, iPad 820 x 1180 und Telefon 390 x 844.
// Die App wird in `dist-e2e` gebaut und mit `vite preview` auf Port 4273 ausgeliefert (globalSetup).
// Projekte:
//   setup   prüft, dass der Server antwortet
//   ipad    alle Tests, 820 x 1180
//   telefon nur Tests mit dem Tag @telefon, 390 x 844
//   offline läuft zuletzt (Teardown von setup), weil der Test den Vorschau-Server beendet

const webkit = devices["Desktop Safari"];

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  outputDir: "./test-results/artifacts",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 7_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    ...webkit,
    baseURL: BASE_URL,
    locale: "de-DE",
    timezoneId: "Atlantic/Canary",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/setup.project.ts",
      teardown: "offline",
      use: { viewport: { width: 820, height: 1180 } },
    },
    {
      name: "ipad",
      dependencies: ["setup"],
      testIgnore: ["**/offline.spec.ts"],
      use: { viewport: { width: 820, height: 1180 } },
    },
    {
      name: "telefon",
      dependencies: ["setup"],
      grep: /@telefon/,
      testIgnore: ["**/offline.spec.ts"],
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: "offline",
      testMatch: "**/offline.spec.ts",
      fullyParallel: false,
      use: { viewport: { width: 820, height: 1180 }, serviceWorkers: "allow" },
    },
  ],
});
