// Punkt 13: Barrierefreiheit im Groben. Auf jeder Ansicht genau ein `main`, jeder Knopf hat einen Namen,
// spanischer Text trägt `lang="es"`.

import { a11yFindings } from "./support/audit";
import type { Finding } from "./support/audit";
import { expect, test } from "./support/fixtures";
import { walkAllViews } from "./support/walk";

test("Auf jeder Ansicht: ein main, Knöpfe mit Namen, spanischer Text mit lang=\"es\"", async ({ page }) => {
  test.setTimeout(180_000);
  const findings: Finding[] = [];
  const visited: string[] = [];
  await walkAllViews(page, async (name) => {
    visited.push(name);
    findings.push(...(await a11yFindings(page, name)));
  });
  expect(visited.length, "Ansichten besucht").toBeGreaterThanOrEqual(30);
  const report = findings.map((finding) => `${finding.where}: ${finding.problem}`);
  expect(report, report.join("\n")).toEqual([]);
});

test("Dokument: Sprache de, Seitentitel, Meta-Angaben für Web-Apps und noindex", async ({ page }) => {
  await page.goto("");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page).toHaveTitle("Guagua");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon-180x180\.png$/);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
});

test("Die Prüfung erkennt Verstöße (Gegenprobe mit absichtlich schlechter Seite)", async ({ page }) => {
  await page.setContent(
    `<main><button></button><button>Gut</button><p class="es">hola</p></main><main>zweites</main>`,
  );
  const problems = (await a11yFindings(page, "Gegenprobe")).map((finding) => finding.problem).join("\n");
  expect(problems).toContain("2 main-Bereiche");
  expect(problems).toContain("Element ohne Namen");
  expect(problems).toContain("hat lang=");
});