// Punkt 12: Breiten. Auf Startseite, Lerneinheit (Karte, Paare, Satzbau, ...), Missionen, Sprachführer und Mehr gibt es bei
// 390, 820 und 1180 Pixel Breite kein waagerechtes Scrollen, und jeder sichtbare Knopf ist mindestens 44 Pixel hoch.

import { layoutFindings, WIDTHS } from "./support/audit";
import type { Finding } from "./support/audit";
import { expect, test } from "./support/fixtures";
import { walkAllViews } from "./support/walk";

test("Kein waagerechtes Scrollen und alle Knöpfe mindestens 44 px hoch, bei 390, 820 und 1180 px Breite @telefon", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  // Im Projekt „telefon“ steht das Fenster auf 390 px; die Breiten werden in jedem Projekt durchgestellt.
  const findings: Finding[] = [];
  const visited: string[] = [];
  await walkAllViews(page, async (name) => {
    visited.push(name);
    findings.push(...(await layoutFindings(page, name, WIDTHS)));
    // Zurück zur Breite des Projekts, damit der nächste Schritt wie vorgesehen bedient wird.
    const viewport = testInfo.project.use.viewport;
    if (viewport) await page.setViewportSize(viewport);
  });

  expect(visited.length, "Ansichten besucht").toBeGreaterThanOrEqual(30);
  const report = findings.map((finding) => `${finding.where}: ${finding.problem}`);
  // Jeder Befund steht als eigene Zeile in der Fehlermeldung.
  expect(report, report.join("\n")).toEqual([]);
});

test("Die Prüfung erkennt Verstöße (Gegenprobe mit absichtlich schlechter Seite)", async ({ page }) => {
  await page.setContent(
    `<main><button style="height:20px;width:100px">klein</button><div style="width:2000px;height:10px"></div></main>`,
  );
  const findings = await layoutFindings(page, "Gegenprobe", [390]);
  const problems = findings.map((finding) => finding.problem).join("\n");
  expect(problems).toContain("waagerecht scrollbar");
  expect(problems).toContain("Knopf niedriger als 44 px");
});