// Stichproben zur Gestaltung (docs/04-design.md) an jeder Ansicht: keine Schatten außer dem Marker, keine Verläufe,
// keine Emojis, keine Schrift unter 13 px, Eingabefelder ab 16 px, Spanisch kursiv in Newsreader, touch-action an Knöpfen.

import { designFindings } from "./support/audit";
import type { Finding } from "./support/audit";
import { expect, test } from "./support/fixtures";
import { walkAllViews } from "./support/walk";

test("Gestaltung: keine Schatten, Verläufe, Emojis, kleine Schrift; Spanisch kursiv in Newsreader @telefon", async ({ page }) => {
  test.setTimeout(180_000);
  const findings: Finding[] = [];
  await walkAllViews(page, async (name) => {
    findings.push(...(await designFindings(page, name)));
  });
  const report = [...new Set(findings.map((finding) => `${finding.where}: ${finding.problem}`))];
  expect(report, report.join("\n")).toEqual([]);
});

test("Die Prüfung erkennt Verstöße (Gegenprobe mit absichtlich schlechter Seite)", async ({ page }) => {
  await page.setContent(
    `<main><p style="box-shadow:0 1px 3px #000">Schatten</p><p style="background-image:linear-gradient(red,blue)">Verlauf</p><p>Super 🎉</p><p style="font-size:11px">klein</p><p class="es">hola</p></main>`,
  );
  const problems = (await designFindings(page, "Gegenprobe")).map((finding) => finding.problem).join("\n");
  for (const part of ["Schatten an", "Verlauf an", "Emoji in", "Schrift unter 13 px", "Spanisch nicht kursiv"]) expect(problems).toContain(part);
});