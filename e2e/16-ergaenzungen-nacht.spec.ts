// Ergänzungen der Nacht zum 23.11.2026 (docs/02-spezifikation.md, 2.4, 2.7, 2.9): Suche im Kurs, Sprungliste, Missionssätze,
// „Sag es laut“, Schreiben mit „Weiß ich nicht“ und „Meine Antwort stimmt auch“, Obergrenze der Schreibaufgaben,
// „Kommen morgen wieder“ und „Oft falsch“, Block „Heute“ nach der Endstation, Abgleich mit dem Plan, Dialog wiederholen,
// Zahlen üben, Rückmeldung, Import mit Vergleich, Sicherung zurückholen, Fehleransicht.
// Nicht neu geschrieben, was 06, 07, 08 und 14 schon prüfen (Missionen abhaken, Sterne, Zeigen, Import als Ganzes, Übersicht).

import type { Page } from "@playwright/test";
import {
  STORAGE_KEY,
  beginPlan,
  createProfile,
  feedback,
  headingText,
  homeButton,
  kindOf,
  open,
  playDialogue,
  playGrammar,
  playNewCards,
  playTasks,
  readProgress,
  solveTask,
  submitWritten,
  tab,
  weiter,
  writeProgress,
} from "./support/app";
import { allItems, course, itemsByDe, unitById } from "./support/content";
import { expect, seed, test } from "./support/fixtures";
import { addDaysTo, allStopsDone, daysBetween, dueCards, shiftProgress, standDay } from "./support/seed";
import { clearSpoken, spoken } from "./support/speech";

const search = (page: Page) => page.getByRole("searchbox", { name: "Suchen" });
const prompt = async (page: Page): Promise<string> => ((await page.locator(".sx-prompt-de").first().textContent()) ?? "").trim();

/** Stand nach Haltestelle 1, alle Karten in Fach 3 und heute fällig (oder nur die Karten, die `only` nennt). */
function reviewStand(unit1: string, only?: (id: string) => boolean): any {
  const progress = JSON.parse(unit1);
  dueCards(progress, standDay(progress), 3, only);
  delete progress.stats.lastReviewDay;
  return progress;
}

async function startReview(page: Page, progress: unknown): Promise<void> {
  await seed(page, JSON.stringify(progress));
  await open(page);
  await homeButton(page, "Mit Wiederholen beginnen");
  await beginPlan(page);
}

async function openMoreEntry(page: Page, entry: RegExp, title: string): Promise<void> {
  await tab(page, "Mehr");
  await page.getByRole("button", { name: entry }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

// ---------- Sprachführer (2.9, Punkt 1 bis 3) ----------

test("Suche findet eine Lernkarte aus dem Kurs unter „Aus dem Kurs“, mit Stern landet sie in „Gemerkt“", async ({ page }) => {
  await createProfile(page);
  await tab(page, "Sprachführer");
  const item = allItems.find((entry) => entry.es === "una botella de agua");
  expect(item, "Karte in den Inhalten").toBeTruthy();

  // Ein einzelnes Zeichen listet keine Karten des Kurses auf.
  await search(page).fill("b");
  await expect(page.getByRole("region", { name: "Aus dem Kurs" })).toHaveCount(0);

  // Haltestelle 6 ist noch gesperrt, die Karte steht trotzdem da, mit Herkunft.
  await search(page).fill("botella de agua");
  const course = page.getByRole("region", { name: "Aus dem Kurs" });
  const row = course.getByRole("listitem").filter({ hasText: item!.es });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Haltestelle 6");
  await row.getByRole("button", { name: "Anhören" }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toBe(item!.es);
  expect((await spoken(page)).at(-1)?.inGesture).toBe(true);

  await row.getByRole("button", { name: "Merken" }).click();
  await expect.poll(async () => (await readProgress(page)).favorites).toContain(item!.id);

  await search(page).fill("");
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Gemerkt");
  await expect(page.getByRole("region", { name: "Gemerkt" })).toContainText(item!.es);
  // Nach dem Neuladen bleibt sie gemerkt.
  await page.reload();
  await tab(page, "Sprachführer");
  await expect(page.getByRole("region", { name: "Gemerkt" })).toContainText(item!.es);
});

test("Die Sprungliste springt zur Kategorie, die erste Kategorie heißt „Wenn du nichts verstehst“", async ({ page }) => {
  await createProfile(page);
  await tab(page, "Sprachführer");
  const jump = page.getByRole("navigation", { name: "Kategorien" });
  await expect(jump.getByRole("button").first()).toHaveText("Wenn du nichts verstehst");
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Wenn du nichts verstehst");
  const first = page.getByRole("region", { name: "Wenn du nichts verstehst" });
  await expect(first.getByRole("listitem")).toHaveCount(5);

  // Zur letzten Kategorie: Die Überschrift rückt ins Bild und hat den Fokus.
  const buttons = jump.getByRole("button");
  const last = (await buttons.last().textContent())?.trim() ?? "";
  const heading = page.getByRole("heading", { level: 2, name: last, exact: true });
  await expect(heading).not.toBeInViewport();
  await buttons.last().click();
  await expect(heading).toBeInViewport();
  await expect(heading).toBeFocused();

  // Beim Suchen ist die Sprungliste weg.
  await search(page).fill("medico");
  await expect(jump).toHaveCount(0);
});

// ---------- Missionen (2.9, Punkt 4) ----------

test("Missionssatz: Übersetzung aufdecken, Zeigen öffnet das Vollbild, alles bleibt bei erledigter Mission", async ({ unit1, page }) => {
  await seed(page, unit1);
  await open(page);
  await tab(page, "Missionen");
  const mission = unitById("u01").mission;
  const entry = page.locator(`#mission-${mission.id}`);
  const phrases = entry.locator("ul.mp > li");
  await expect(phrases).toHaveCount(mission.say.length);
  const first = phrases.first();
  const de = mission.say_de?.[0] ?? "";
  expect(de, "Übersetzung in den Inhalten").not.toBe("");

  await expect(first.getByText(de, { exact: true })).toHaveCount(0);
  await first.getByRole("button", { name: "Übersetzung aufdecken" }).click();
  await expect(first.getByText(de, { exact: true })).toBeVisible();
  await first.getByRole("button", { name: "Übersetzung verdecken" }).click();
  await expect(first.getByText(de, { exact: true })).toHaveCount(0);

  await first.getByRole("button", { name: "Langsam" }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toBe(mission.say[0]);
  expect((await spoken(page)).at(-1)).toMatchObject({ rate: 0.6, inGesture: true });

  await first.getByRole("button", { name: "Zeigen" }).click();
  const overlay = page.getByRole("dialog", { name: "Satz im Vollbild" });
  await expect(overlay.getByText(mission.say[0]!, { exact: true })).toHaveAttribute("lang", "es");
  await page.getByRole("button", { name: "Schließen" }).click();
  await expect(overlay).toHaveCount(0);

  // Mission erledigen: Aufgabe und Sätze bleiben, Aufdecken und Zeigen auch.
  await entry.getByRole("button", { name: "Abhaken" }).click();
  await entry.getByRole("button", { name: "Mission erledigt" }).click();
  await expect(entry).toContainText("erledigt");
  await expect(phrases).toHaveCount(mission.say.length);
  await expect(entry).toContainText(mission.task_de);
  await phrases.nth(1).getByRole("button", { name: "Übersetzung aufdecken" }).click();
  await expect(phrases.nth(1).getByText(mission.say_de?.[1] ?? "", { exact: true })).toBeVisible();
  await phrases.nth(1).getByRole("button", { name: "Zeigen" }).click();
  await expect(page.getByRole("dialog", { name: "Satz im Vollbild" })).toBeVisible();
});

test("Missionssätze am Ende der Haltestelle (Schritt 6): Übersetzung aufdecken und Zeigen", async ({ page }) => {
  await createProfile(page);
  const unit = unitById("u01");
  await homeButton(page, "Haltestelle beginnen");
  await beginPlan(page);
  await playNewCards(page, unit);
  await playGrammar(page, unit);
  await playDialogue(page, unit);
  await playTasks(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mission");
  const phrases = page.locator("ul.mp > li");
  await expect(phrases).toHaveCount(unit.mission.say.length);
  const first = phrases.first();
  await first.getByRole("button", { name: "Übersetzung aufdecken" }).click();
  await expect(first.getByText(unit.mission.say_de?.[0] ?? "", { exact: true })).toBeVisible();
  await first.getByRole("button", { name: "Zeigen" }).click();
  await expect(page.getByRole("dialog", { name: "Satz im Vollbild" }).getByText(unit.mission.say[0]!, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Schließen" }).click();
  await first.getByRole("button", { name: "Langsam" }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)).toMatchObject({ text: unit.mission.say[0], rate: 0.6, inGesture: true });
});

// ---------- Aufgaben (2.4, 2.9 Punkt 5) ----------

test("„Sag es laut“: Aufdecken zeigt die Lösung, „Saß“ zählt richtig, „Noch mal“ falsch", async ({ unit1, page }) => {
  const stand = reviewStand(unit1);
  await startReview(page, stand);
  const today = standDay(stand);

  // Die ersten sechs Karten sind Schreibaufgaben, danach kommt „Sag es laut“.
  for (let n = 1; n <= 6; n++) {
    await expect.poll(async () => kindOf(await headingText(page))).toBe("write");
    await solveTask(page, true);
    await weiter(page);
  }
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sag es laut");

  const item1 = itemsByDe(await prompt(page))[0]!;
  await expect(page.getByRole("button", { name: "Saß" })).toHaveCount(0);
  await expect(page.getByText(item1.es, { exact: true })).toHaveCount(0);
  await clearSpoken(page);
  await page.getByRole("button", { name: "Aufdecken" }).click();
  const solution = page.locator("#sx-say-solution");
  await expect(solution).toHaveText(item1.es);
  await expect(solution).toHaveAttribute("lang", "es");
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toBe(item1.es);
  expect((await spoken(page)).at(-1)?.inGesture).toBe(true);
  await expect(page.getByRole("button", { name: "Noch mal" })).toBeVisible();

  const before = await readProgress(page);
  await page.getByRole("button", { name: "Saß" }).click();
  await expect.poll(async () => (await readProgress(page)).cards[item1.id].box).toBe(4);
  let after = await readProgress(page);
  expect(after.cards[item1.id]).toMatchObject({ right: before.cards[item1.id].right + 1, wrong: before.cards[item1.id].wrong, due: addDaysTo(today, 6) });
  expect(after.stats.points).toBe(before.stats.points + 10);

  // Die nächste Karte: „Noch mal“.
  await expect.poll(async () => kindOf(await headingText(page))).toBe("say");
  const item2 = itemsByDe(await prompt(page))[0]!;
  const before2 = await readProgress(page);
  await page.getByRole("button", { name: "Aufdecken" }).click();
  await page.getByRole("button", { name: "Noch mal" }).click();
  await expect.poll(async () => (await readProgress(page)).cards[item2.id].box).toBe(1);
  after = await readProgress(page);
  expect(after.cards[item2.id]).toMatchObject({ wrong: before2.cards[item2.id].wrong + 1, due: addDaysTo(today, 1) });
  expect(after.stats.points).toBe(before2.stats.points);
});

test("Schreiben: „Weiß ich nicht“ zählt falsch, „Meine Antwort stimmt auch“ zählt richtig, gewertet wird erst mit „Weiter“", async ({ unit1, page }) => {
  const stand = reviewStand(unit1);
  await startReview(page, stand);
  const today = standDay(stand);

  // „Weiß ich nicht“: Lösung steht da, kein Widerspruch möglich, falsch.
  const item1 = itemsByDe(await prompt(page))[0]!;
  await page.getByRole("button", { name: "Weiß ich nicht" }).click();
  await expect(feedback(page)).toContainText("Falsch. Richtig ist:");
  await expect(feedback(page)).toContainText(item1.es);
  await expect(page.getByRole("button", { name: "Meine Antwort stimmt auch" })).toHaveCount(0);
  expect((await readProgress(page)).cards[item1.id].box).toBe(3);
  await weiter(page);
  await expect.poll(async () => (await readProgress(page)).cards[item1.id].box).toBe(1);
  expect((await readProgress(page)).cards[item1.id]).toMatchObject({ wrong: 1, due: addDaysTo(today, 1) });

  // Falsche Eingabe, dann widersprechen: zählt als richtig.
  await expect.poll(async () => kindOf(await headingText(page))).toBe("write");
  const item2 = itemsByDe(await prompt(page))[0]!;
  const rightBefore = (await readProgress(page)).cards[item2.id].right;
  await submitWritten(page, "xyz qwv");
  await expect(feedback(page)).toContainText("Falsch. Richtig ist:");
  await page.getByRole("button", { name: "Meine Antwort stimmt auch" }).click();
  await expect(feedback(page)).toContainText("Richtig.");
  await expect(page.getByRole("button", { name: "Meine Antwort stimmt auch" })).toHaveCount(0);
  expect((await readProgress(page)).cards[item2.id].box, "vor „Weiter“ noch nicht gewertet").toBe(3);
  await weiter(page);
  await expect.poll(async () => (await readProgress(page)).cards[item2.id].box).toBe(4);
  expect((await readProgress(page)).cards[item2.id].right).toBe(rightBefore + 1);
});

test("Eine Runde mit vielen Karten ab Fach 3 hat höchstens sechs Schreibaufgaben, der Rest kommt als „Sag es laut“ oder „Erinnern“", async ({
  unit1,
  page,
}) => {
  // 32 Aufgaben mit je ein bis zwei Tippen: länger als die übliche Grenze von 90 Sekunden.
  test.setTimeout(180_000);
  const stand = allStopsDone(unit1);
  const only = (id: string): boolean => id.startsWith("u01-") || id.startsWith("u02-");
  dueCards(stand, standDay(stand), 3, only);
  const due = Object.keys(stand.cards).filter(only).length;
  expect(due).toBeGreaterThan(6);
  await startReview(page, stand);

  // Nach der Wiederholrunde beginnt hier die Endstation (alle zehn Haltestellen sind geschafft): nur die Aufgaben der Wiederholrunde zählen.
  const solved = await playTasks(page, { max: 60, stopAfter: due });
  expect(solved).toHaveLength(due);
  const count = (kind: string) => solved.filter((task) => task.kind === kind).length;
  expect(count("write")).toBe(6);
  expect(count("say")).toBeGreaterThanOrEqual(1);
  expect(count("recall")).toBeGreaterThanOrEqual(1);
  expect(count("write") + count("say") + count("recall")).toBe(due);
});

// ---------- Zusammenfassung und Spickzettel (Punkt 6) ----------

test("Die Zusammenfassung nennt die falsche Karte unter „Kommen morgen wieder“, der Spickzettel zeigt sie unter „Oft falsch“", async ({ unit1, page }) => {
  const hola = allItems.find((entry) => entry.id === "u01-i01")!;
  const stand = reviewStand(unit1, (id) => ["u01-i01", "u01-i02", "u01-i03"].includes(id));
  stand.cards["u01-i01"].wrong = 1;
  await seed(page, JSON.stringify(stand));
  await open(page);

  // Mit einem Fehler steht sie noch nicht unter „Oft falsch“ (mindestens zwei).
  await openMoreEntry(page, /^Spickzettel/, "Spickzettel");
  await expect(page.getByRole("heading", { level: 2, name: "Oft falsch" })).toHaveCount(0);
  await page.getByRole("button", { name: "Zurück" }).click();
  await tab(page, "Linie");

  await homeButton(page, "Mit Wiederholen beginnen");
  await beginPlan(page);
  await playTasks(page, { wrongAt: [1] });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zusammenfassung");
  await expect(page.getByRole("heading", { level: 2, name: "Kommen morgen wieder" })).toBeVisible();
  const list = page.getByRole("list", { name: "Karten, die morgen wiederkommen" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText(hola.es);
  await expect(list).toContainText(hola.de);
  await clearSpoken(page);
  await list.getByRole("button", { name: "Anhören" }).click();
  await expect.poll(async () => (await spoken(page)).at(-1)?.text).toBe(hola.es);

  await page.getByRole("button", { name: "Zur Linie" }).click();
  await openMoreEntry(page, /^Spickzettel/, "Spickzettel");
  const often = page.getByRole("region", { name: "Oft falsch" });
  await expect(often).toBeVisible();
  await expect(often).toContainText(hola.es);
});

// ---------- Nach der Endstation (Punkt 8) ----------

function afterStation(unit1: string): any {
  const progress = allStopsDone(unit1);
  progress.finalReview = { at: new Date().toISOString(), right: 30, total: 30 };
  return progress;
}

test("Nach der Endstation nennt der Block „Heute“ die nächste Wiederholung mit Tag und Zahl der Karten", async ({ unit1, page }) => {
  const stand = afterStation(unit1);
  await seed(page, JSON.stringify(stand));
  await open(page);
  await expect(page.getByText("Linie geschafft", { exact: true })).toBeVisible();
  await expect(page.getByText("30 von 30 richtig an der Endstation.")).toBeVisible();
  const cards = Object.keys(stand.cards).length;
  await expect(page.getByText(new RegExp(`Nächste Wiederholung: .+, ${cards} Karten\\.`))).toBeVisible();
});

test("Nach der Endstation hat die Wiederholrunde höchstens 20 Karten, danach sagt der Block, wie viele warten", async ({ unit1, page }) => {
  test.setTimeout(150_000);
  const stand = afterStation(unit1);
  const ids = Object.keys(stand.cards).slice(0, 30);
  dueCards(stand, standDay(stand), 1, (id) => ids.includes(id));
  await seed(page, JSON.stringify(stand));
  await open(page);
  await expect(page.getByText("30 Karten sind fällig. Heute kommen 20 dran.")).toBeVisible();
  await homeButton(page, "Mit Wiederholen beginnen");
  await beginPlan(page);
  await expect(page.getByText("1 von 20", { exact: true })).toBeVisible();
  const solved = await playTasks(page, { max: 40 });
  expect(solved).toHaveLength(20);
  await page.getByRole("button", { name: "Zur Linie" }).click();
  await expect(page.getByText(/10 Karten warten, morgen kommen die nächsten\./)).toBeVisible();
});

// ---------- Abgleich mit dem Plan (Punkt 9) ----------

/** Stand nach Haltestelle 1, so verschoben, dass die Haltestelle am Tag `daysLeft` Tage vor dem letzten Plantag geschafft wurde. */
async function atPlanDay(page: Page, unit1: string, daysLeft: number): Promise<void> {
  const day = addDaysTo(course.plan.last_stop_date, -daysLeft);
  const stand = shiftProgress(JSON.parse(unit1), daysBetween(standDay(JSON.parse(unit1)), day));
  // Feste Uhr der Seite: Mittag des Plantags, unabhängig vom Tag, an dem der Test läuft.
  await page.clock.setFixedTime(new Date(`${day}T12:00:00Z`));
  await seed(page, JSON.stringify(stand));
  await open(page);
  await expect(page.getByText("Für heute fertig")).toBeVisible();
}

test("Abgleich mit dem Plan: Satz und „Noch eine Haltestelle“ erscheinen, wenn mehr Haltestellen offen sind als Tage ab morgen bleiben", async ({
  unit1,
  page,
}) => {
  await atPlanDay(page, unit1, 5);
  // 9 Haltestellen offen, 5 Tage von morgen bis zum letzten Plantag.
  await expect(page.getByText("Bis zum 2. Dezember sind es noch 9 Haltestellen in 5 Tagen.")).toBeVisible();
  await page.getByRole("button", { name: "Noch eine Haltestelle" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Heute · Haltestelle 2");
});

test("Abgleich mit dem Plan: Liegt der Kurs im Plan, steht dort kein Satz und kein Knopf", async ({ unit1, page }) => {
  // 9 offene Haltestellen, 9 Tage ab morgen: genau im Plan.
  await atPlanDay(page, unit1, 9);
  await expect(page.getByText(/Bis zum .* sind es noch/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Noch eine Haltestelle" })).toHaveCount(0);
});

// ---------- Dialog wiederholen (Punkt 10) ----------

test("„Dialog noch einmal spielen“ ändert weder Punkte noch Fächer", async ({ unit1, page }) => {
  await seed(page, unit1);
  await open(page);
  const before = await readProgress(page);
  await page.locator("ol.line > li").first().getByRole("button").click();
  await page.getByRole("button", { name: "Dialog noch einmal spielen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Noch einmal · Haltestelle 1");
  await page.getByRole("button", { name: "Beginnen" }).click();

  const lines = unitById("u01").dialogue.lines;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dialog · anhören");
  for (let i = 1; i < lines.length; i++) await weiter(page);
  await page.getByRole("button", { name: "Rollenspiel beginnen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dialog · Rollenspiel");
  for (const line of lines) {
    if (line.learner) {
      await page.getByRole("button", { name: "Aufdecken" }).click();
      await page.getByRole("button", { name: "Saß" }).click();
    } else {
      await page.getByRole("button", { name: /^(Weiter|Zur Abschlussrunde)$/ }).click();
    }
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zusammenfassung");
  const after = await readProgress(page);
  expect(after.cards).toEqual(before.cards);
  expect(after.stats.points).toBe(before.stats.points);
  expect(after.stats.streak).toBe(before.stats.streak);
  expect(after.units).toEqual(before.units);
  expect(after.missions).toEqual(before.missions);
});

// ---------- Zahlen üben (Punkt 11) ----------

test("„Zahlen üben“ stellt zehn Höraufgaben mit Stimme, ohne Wertung und ohne Eintrag im Lernstand", async ({ unit1, page }) => {
  await seed(page, unit1);
  await open(page);
  const before = await readProgress(page);
  await openMoreEntry(page, /^Spickzettel/, "Spickzettel");
  await clearSpoken(page);
  await page.getByRole("button", { name: "Zahlen üben" }).click();
  await expect(page.getByText("Aufgabe 1 von 10", { exact: true })).toBeVisible();
  // Der Ton der ersten Zahl startet im Tippen, die Ziffer steht nirgends.
  await expect.poll(async () => (await spoken(page)).length).toBe(1);
  expect((await spoken(page)).at(-1)?.inGesture).toBe(true);

  for (let n = 1; n <= 10; n++) {
    await expect(page.getByText(`Aufgabe ${n} von 10`, { exact: true })).toBeVisible();
    await page.getByLabel("Deine Ziffern").fill("0");
    await page.getByRole("button", { name: "Prüfen" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page.getByRole("button", { name: n === 10 ? "Fertig" : "Weiter" }).click();
  }
  await expect(page.getByText("Die 10 Aufgaben sind durch.")).toBeVisible();
  // Neun Tonausgaben durch „Weiter“ plus die erste im Start.
  expect((await spoken(page)).length).toBe(10);
  expect(await readProgress(page)).toEqual(before);
});

test.describe("ohne spanische Stimme", () => {
  test.use({ voices: "none" });

  test("„Zahlen üben“ wird nicht angeboten", async ({ page }) => {
    await createProfile(page);
    await openMoreEntry(page, /^Spickzettel/, "Spickzettel");
    await expect(page.getByRole("button", { name: "Zahlen üben" })).toBeDisabled();
  });
});

// ---------- Rückmeldung (Punkt 12) ----------

test("Rückmeldung: Eine Notiz anlegen, sie übersteht das Neuladen, Teilen enthält den Namen nicht", async ({ page }) => {
  await page.addInitScript(() => {
    let stored = "";
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void (stored = text), readText: async () => stored },
    });
  });
  await createProfile(page, "Lena");
  await openMoreEntry(page, /^Rückmeldung/, "Rückmeldung");
  await expect(page.getByRole("button", { name: "Notiz speichern" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Teilen", exact: true })).toBeDisabled();

  await page.getByRole("textbox", { name: "Deine Notiz" }).fill("Hat mir gefehlt: mehr Zahlen");
  await page.getByRole("button", { name: "Notiz speichern" }).click();
  await expect(page.getByText("Hat mir gefehlt: mehr Zahlen", { exact: true })).toBeVisible();
  expect((await readProgress(page)).notes).toHaveLength(1);

  await page.reload();
  await openMoreEntry(page, /^Rückmeldung/, "Rückmeldung");
  await expect(page.getByText("Hat mir gefehlt: mehr Zahlen", { exact: true })).toBeVisible();

  // Ohne Teilen-Menü landet der Text in der Zwischenablage, ohne Namen.
  await page.getByRole("button", { name: "Teilen", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /./ }).first()).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("Hat mir gefehlt: mehr Zahlen");
  expect(text).not.toContain("Lena");
});

// ---------- Import und Sicherung (2.7) ----------

const exportText = (progress: unknown): string =>
  JSON.stringify({ format: "guagua-sicherung", schema: 1, exportedAt: new Date().toISOString(), progress });

test("Import: Die Rückfrage vergleicht beide Stände und warnt bei weniger Karten, die letzte Sicherung lässt sich zurückholen", async ({
  unit1,
  page,
}) => {
  await seed(page, unit1);
  await open(page);
  const original = await readProgress(page);

  // Ein Stand mit weniger Karten und weniger Haltestellen.
  const smaller = JSON.parse(unit1);
  smaller.cards = Object.fromEntries(Object.entries<any>(smaller.cards).slice(0, 4));
  delete smaller.units.u01.completedAt;

  await openMoreEntry(page, /^Fortschritt sichern/, "Fortschritt sichern");
  await expect(page.getByText("Es gibt noch keine automatische Sicherung auf diesem Gerät.")).toBeVisible();
  await page.getByLabel("Oder Text einfügen").fill(exportText(smaller));
  await page.getByRole("button", { name: "Text prüfen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Stand importieren?" })).toBeVisible();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("weniger Karten");
  await expect(alert).toContainText("4 statt 16");
  const compare = page.getByRole("table");
  await expect(compare.getByRole("columnheader", { name: "Dein Stand" })).toBeVisible();
  await expect(compare.getByRole("columnheader", { name: "Import" })).toBeVisible();
  await expect(compare.getByRole("row", { name: /Karten/ })).toContainText("16");
  await expect(compare.getByRole("row", { name: /Karten/ })).toContainText("4");

  await page.getByRole("button", { name: "Jetzt importieren" }).click();
  await expect(page.getByText(/ist importiert/)).toBeVisible();
  expect(Object.keys((await readProgress(page)).cards)).toHaveLength(4);

  // Der vorherige Stand liegt als Sicherung bereit und lässt sich zurückholen.
  await page.getByRole("button", { name: "Fertig" }).click();
  await openMoreEntry(page, /^Fortschritt sichern/, "Fortschritt sichern");
  await expect(page.getByText(/Vom .*: 16 Karten, 1 von 10 Haltestellen abgeschlossen\./)).toBeVisible();
  await page.getByRole("button", { name: "Letzte Sicherung zurückholen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sicherung zurückholen?" })).toBeVisible();
  await page.getByRole("button", { name: "Jetzt zurückholen" }).click();
  await expect(page.getByText(/Die Sicherung vom .* ist wieder dein Stand\./)).toBeVisible();
  expect(await readProgress(page)).toEqual(original);
});

test("Ein beschädigter Lernstand: Die Fehleransicht bietet den Import einer Sicherung an", async ({ unit1, page }) => {
  await createProfile(page);
  await writeProgress(page, { schema: 1, kaputt: true });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Dein Lernstand ist nicht lesbar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Neu beginnen" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Sicherung importieren" })).toBeVisible();

  await page.getByLabel("Oder Text einfügen").fill(exportText(JSON.parse(unit1)));
  await page.getByRole("button", { name: "Text prüfen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Stand importieren?" })).toBeVisible();
  // Bis zur Bestätigung bleibt der beschädigte Text unangetastet.
  expect(JSON.parse((await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)) ?? "{}")).toEqual({ schema: 1, kaputt: true });
  await page.getByRole("button", { name: "Jetzt importieren" }).click();
  await expect(page.getByRole("heading", { name: "Deine Linie" })).toBeVisible();
  await expect(page.getByText("1 von 10 abgeschlossen")).toBeVisible();
});
