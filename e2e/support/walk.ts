// Geht durch alle Ansichten der App (erster Start, Linie, Lerneinheit mit allen Aufgabenarten, Missionen, Sprachführer, Mehr)
// und ruft an jeder Stelle `visit(name)` auf. Die Prüfungen zu Breiten und Barrierefreiheit hängen sich daran.

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  beginPlan,
  feedback,
  headingText,
  homeButton,
  kindOf,
  open,
  readProgress,
  solveTask,
  tab,
  weiter,
  writeProgress,
} from "./app";
import { unitById } from "./content";

export type Visit = (name: string) => Promise<void>;

const unit = unitById("u01");
const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wartet, bis Einblendungen (150 ms) abgeschlossen sind, damit Maße stabil sind. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined))));
}

export async function walkAllViews(page: Page, visit: Visit): Promise<void> {
  const at: Visit = async (name) => {
    await settle(page);
    await visit(name);
  };

  // Erster Start
  await open(page);
  await expect(page.getByRole("heading", { name: "Guagua auf den Home-Bildschirm legen" })).toBeVisible();
  await at("Erster Start: Installationshinweis");
  await page.getByRole("button", { name: "Trotzdem im Browser weitermachen" }).click();
  await expect(page.getByRole("heading", { name: "Wie heißt du?" })).toBeVisible();
  await at("Erster Start: Name");
  await page.getByLabel("Dein Name").fill("Lena");
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Stimme testen" })).toBeVisible();
  await at("Erster Start: Stimmentest");
  await page.getByRole("button", { name: "Weiter zur Linie" }).click();

  // Startseite
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
  await at("Startseite");

  // Lerneinheit: Fahrplan, Karte, Paare
  await homeButton(page, "Haltestelle beginnen");
  await expect(page.getByRole("button", { name: "Beginnen" })).toBeVisible();
  await at("Lerneinheit: Fahrplan");
  await beginPlan(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Neue Karten");
  await at("Lerneinheit: Karte");
  for (let i = 0; i < 4; i++) await weiter(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Ordne zu/);
  const left = page.getByRole("group", { name: "Spanisch" });
  const right = page.getByRole("group", { name: "Deutsch" });
  const block = unit.items.slice(0, 4);
  await left.getByRole("button", { name: block[0]!.es, exact: true }).click();
  await at("Lerneinheit: Paare, eine Zeile gewählt");
  await right.getByRole("button", { name: block[1]!.de, exact: true }).click();
  await at("Lerneinheit: Paare, falsches Paar");
  // Nach dem falschen Paar trägt jede der beiden Zeilen für Screenreader den Zusatz „falsch“.
  await left.getByRole("button", { name: new RegExp(`^${escapeRe(block[0]!.es)}( falsch)?$`) }).click();
  await right.getByRole("button", { name: new RegExp(`^${escapeRe(block[0]!.de)}( falsch)?$`) }).click();
  await at("Lerneinheit: Paare, ein Paar gefunden");
  for (const item of block.slice(1)) {
    await left.getByRole("button", { name: item.es, exact: true }).click();
    await right.getByRole("button", { name: item.de, exact: true }).click();
  }
  await weiter(page);
  // Restliche Blöcke ohne Prüfung
  for (let b = 1; b < 4; b++) {
    const items = unit.items.slice(b * 4, b * 4 + 4);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Neue Karten");
    if (b === 3) await at("Lerneinheit: Karte, Satzmuster mit Beispiel");
    for (let i = 0; i < items.length; i++) await weiter(page);
    for (const item of items) {
      await left.getByRole("button", { name: item.es, exact: true }).click();
      await right.getByRole("button", { name: item.de, exact: true }).click();
    }
    await weiter(page);
  }

  // Grammatik und Lückensätze
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Grammatik");
  await at("Lerneinheit: Grammatik");
  await page.getByRole("button", { name: "Weiter zu den Lückensätzen" }).click();
  await solveTask(page, false);
  await at("Lerneinheit: Lücke mit falscher Antwort");
  await weiter(page);
  for (let i = 1; i < unit.cloze.length; i++) {
    await solveTask(page, true);
    await weiter(page);
  }

  // Dialog
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dialog · anhören");
  await at("Lerneinheit: Dialog anhören");
  const lines = unit.dialogue.lines;
  for (let i = 1; i < lines.length; i++) await weiter(page);
  await at("Lerneinheit: Dialog, alle Zeilen");
  await page.getByRole("button", { name: "Rollenspiel beginnen" }).click();
  let visitedLearner = false;
  for (let i = 0; i < lines.length; i++) {
    const last = i === lines.length - 1;
    if (lines[i]?.learner) {
      if (!visitedLearner) await at("Lerneinheit: Rollenspiel, eigene Zeile verdeckt");
      await page.getByRole("button", { name: "Aufdecken" }).click();
      if (!visitedLearner) await at("Lerneinheit: Rollenspiel, Lösung aufgedeckt");
      visitedLearner = true;
      await page.getByRole("button", { name: "Saß" }).click();
    } else {
      await page.getByRole("button", { name: last ? "Zur Abschlussrunde" : "Weiter", exact: true }).click();
    }
  }

  // Abschlussrunde: Erkennen (falsch), Erkennen (richtig), Satzbau, Satzbau mit Rückmeldung
  let seenBuild = false;
  let n = 0;
  while (kindOf(await headingText(page))) {
    n++;
    const kind = kindOf(await headingText(page));
    if (n === 1) await at("Lerneinheit: Erkennen");
    if (kind === "build" && !seenBuild) {
      await at("Lerneinheit: Satzbau");
      seenBuild = true;
      await solveTask(page, false);
      await at("Lerneinheit: Satzbau, falsch beantwortet");
    } else {
      await solveTask(page, n !== 1);
      if (n === 1) await at("Lerneinheit: Erkennen, falsch beantwortet");
    }
    await weiter(page);
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mission");
  await at("Lerneinheit: Mission");
  await weiter(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zusammenfassung");
  await at("Lerneinheit: Zusammenfassung");
  await page.getByRole("button", { name: "Zur Linie" }).click();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
  await at("Startseite nach Haltestelle 1");

  // Übersicht einer abgeschlossenen Haltestelle
  await page.locator("ol.line > li").first().getByRole("button").click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await at("Übersicht Haltestelle 1");
  await page.getByRole("button", { name: "Zurück zur Linie" }).click();

  // Missionen
  await tab(page, "Missionen");
  await at("Missionen");
  await page.getByRole("button", { name: "Abhaken" }).first().click();
  await at("Missionen: Formular");

  // Sprachführer
  await tab(page, "Sprachführer");
  await at("Sprachführer");
  await page.getByRole("searchbox", { name: "Suchen" }).fill("xyz");
  await at("Sprachführer: leer");
  await page.getByRole("searchbox", { name: "Suchen" }).fill("medico");
  await page.getByRole("listitem").first().getByRole("button", { name: "Merken" }).click();
  await page.getByRole("searchbox", { name: "Suchen" }).fill("");
  await at("Sprachführer: Gemerkt");
  await page.getByRole("listitem").first().getByRole("button", { name: "Zeigen" }).click();
  await expect(page.getByRole("button", { name: "Schließen" })).toBeFocused();
  await at("Sprachführer: Zeigen");
  await page.getByRole("button", { name: "Schließen" }).click();

  // Mehr
  await tab(page, "Mehr");
  await at("Mehr");
  for (const [entry, name] of [
    [/^Spickzettel/, "Mehr: Spickzettel"],
    [/^Einstellungen/, "Mehr: Einstellungen"],
    [/^Fortschritt sichern/, "Mehr: Fortschritt sichern"],
    [/^Über die App/, "Mehr: Über die App"],
  ] as const) {
    await page.getByRole("button", { name: entry }).click();
    await at(name);
    await page.getByRole("button", { name: "Zurück" }).click();
  }
  // Import-Rückfrage
  await page.getByRole("button", { name: /^Fortschritt sichern/ }).click();
  await page.getByRole("button", { name: "In die Zwischenablage kopieren" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Kopiert|Kopieren geht hier nicht/ })).toBeVisible();
  await at("Mehr: Fortschritt sichern, nach dem Kopieren");
  await page.getByLabel("Oder Text einfügen").fill("kein json");
  await page.getByRole("button", { name: "Text prüfen" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await at("Mehr: Fortschritt sichern, Fehlermeldung");
  const exported = JSON.stringify({ format: "guagua-sicherung", schema: 1, exportedAt: new Date().toISOString(), progress: await readProgress(page) });
  await page.getByLabel("Oder Text einfügen").fill(exported);
  await page.getByRole("button", { name: "Text prüfen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Stand importieren?" })).toBeVisible();
  await at("Mehr: Import-Rückfrage");
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await page.getByRole("button", { name: "Zurück" }).click();

  // Schreiben: alle Karten auf Fach 3 setzen und fällig machen, dann die Wiederholrunde beginnen.
  const progress = await readProgress(page);
  for (const card of Object.values<any>(progress.cards)) {
    card.box = 3;
    card.due = card.lastSeen;
  }
  delete progress.stats.lastReviewDay;
  await writeProgress(page, progress);
  await page.reload();
  await tab(page, "Linie");
  await homeButton(page, "Mit Wiederholen beginnen");
  await beginPlan(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Schreib es auf Spanisch");
  await at("Lerneinheit: Schreiben");
  await page.getByLabel("Spanisch").fill("x");
  await at("Lerneinheit: Schreiben, Text eingegeben");
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(feedback(page)).toBeVisible();
  await at("Lerneinheit: Schreiben, Rückmeldung");
}
