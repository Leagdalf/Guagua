import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getUnit } from "../../core/content";
import { parseProgress } from "../../core/progress";
import { STORAGE_KEY } from "../../core/config";
import { createProgressStore } from "../../core/store";
import type { ChoiceTask } from "../../core/tasks";
import type { Progress } from "../../core/types";
import { isUnitDone, missionState, stopState } from "../../core/units";
import { mountainBefore, mountainStops, summaryText } from "./machine";
import type { PlanScreen, SessionState, SummaryFacts } from "./machine";
import { SAVE_FAILED_TEXT, SaveFailedNotice } from "./SaveFailedNotice";
import { isLongDetail, SessionScreen } from "./SessionScreen";
import { MemoryStorage, newDay1, play, playUnit1, Run, U01 } from "./sessionKit";
import { sendEvent, startSession } from "./sessionDriver";

// Vitest leert CSS-Importe (auch mit ?raw). Die Quelle lesen wie src/styles/styles.test.ts, ohne Node-Typen.
const sessionCss = (
  globalThis as unknown as { process: { getBuiltinModule(name: string): { readFileSync(path: string, enc: "utf8"): string }; cwd(): string } }
).process
  .getBuiltinModule("node:fs")
  .readFileSync(`${(globalThis as unknown as { process: { cwd(): string } }).process.cwd().replace(/\\/g, "/")}/src/features/session/session.css`, "utf8");
const unit01 = getUnit(U01)!;

function plan(run: Run): PlanScreen {
  if (run.state.screen.kind !== "plan") throw new Error(`Kein Fahrplan, sondern ${run.state.screen.kind}`);
  return run.state.screen;
}

function html(state: SessionState, progress: Progress): string {
  return renderToStaticMarkup(
    <SessionScreen
      state={state}
      progress={progress}
      day="2026-11-24"
      hasVoice
      onEvent={() => {}}
      onSpeak={() => {}}
      onClose={() => {}}
      onExit={() => {}}
    />,
  ).replaceAll("&quot;", '"');
}

/** Spielt bis zur letzten Antwort der Abschlussrunde, ohne „Weiter“ zu tippen. */
function playUntilLastFinalAnswer(run: Run): void {
  play(run, {
    stopWhen: (r) => {
      const screen = r.state.screen;
      return screen.kind === "task" && screen.role === "final" && screen.answer !== null && screen.round !== null && screen.round.queue.length === 0;
    },
  });
}

// ---------- 1. Sackgasse nach der letzten Antwort der Abschlussrunde ----------

describe("Sackgasse nach der letzten Antwort der Abschlussrunde", () => {
  it("wird nach dem Neustart über den Weg der App aufgelöst: Fahrplan, Tippen, Haltestelle abgeschlossen und gespeichert", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    playUntilLastFinalAnswer(run);
    // Die letzte Antwort ist gespeichert, die Haltestelle noch nicht abgeschlossen: Die App wird jetzt geschlossen.
    expect(run.progress.units[U01]?.answered).toHaveLength(19);
    expect(isUnitDone(run.progress, U01)).toBe(false);
    expect(stopState(run.progress, U01)).toBe("running");

    run.reload({ kind: "day", unitId: U01 }, 99, false);
    const screen = plan(run);
    expect(screen.button).toBe("Weiter bei Schritt 5");
    expect(screen.rows.filter((row) => row.done).map((row) => row.step)).toEqual([2, 3, 4]);
    expect(isUnitDone(run.progress, U01)).toBe(false);

    run.send({ type: "begin" });
    expect(run.state.screen.kind).toBe("mission");
    // Im Speicher (nicht nur im Zustand): neuer Speicher über demselben Text, wie beim nächsten Start der App.
    const reread = parseProgress(run.storage.getItem(STORAGE_KEY));
    if (reread.status !== "ok") throw new Error("Fortschritt nicht lesbar");
    expect(isUnitDone(reread.progress, U01)).toBe(true);
    expect(reread.progress.units[U01]?.answered).toBeUndefined();
    expect(missionState(reread.progress, unit01.mission.id)).toBe("open");
    expect(stopState(reread.progress, "u02")).toBe("open");
    expect(reread.progress.stats.points).toBe(unit01.items.length * 10 + unit01.build.length * 10 + 20 + 100);

    // Ein neuer Start landet nicht wieder in Schritt 5.
    run.reload({ kind: "day", unitId: U01 }, 7, false);
    expect(plan(run).title.text).toBe("Wiederholen");
    expect(run.state.unitId).toBeNull();
  });

  it("auch ohne Tippen bleibt nichts hängen: der Fahrplan nach dem Neuladen ändert den Speicher nicht", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    playUntilLastFinalAnswer(run);
    const before = run.storage.getItem(STORAGE_KEY);
    run.reload({ kind: "day", unitId: U01 }, 5, false);
    run.reload({ kind: "day", unitId: U01 }, 6, false);
    expect(run.storage.getItem(STORAGE_KEY)).toBe(before);
  });

  it("alles, was die Maschine liefert, steht im Speicher: Zustand des Speichers und gespeicherter Text stimmen nach jedem Ereignis überein", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    const seen: string[] = [];
    play(run, {
      stopWhen: (r) => {
        const stored = parseProgress(r.storage.getItem(STORAGE_KEY));
        if (stored.status !== "ok") throw new Error("Fortschritt nicht lesbar");
        expect(stored.progress).toEqual(r.progress);
        seen.push(r.state.screen.kind);
        return false;
      },
    });
    expect(seen.length).toBeGreaterThan(50);
  });

  it("startSession ändert den Fortschritt nicht und speichert nichts, solange der Fahrplan steht", () => {
    const { clock, progress } = newDay1();
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    const store = createProgressStore({ storage, now: clock.now });
    const snapshot = store.getSnapshot();
    if (snapshot.status !== "ready") throw new Error("Speicher nicht bereit");
    const started = startSession(store, snapshot.progress, { kind: "day", unitId: U01 }, { now: clock.now, rng: () => 0.5, hasSpanishVoice: true });
    started.commit();
    started.commit();
    expect(store.getSnapshot()).toBe(snapshot);
    expect(started.state.screen.kind).toBe("plan");
    // Erst das Tippen beginnt die Haltestelle.
    const sent = sendEvent(store, started.state, { type: "begin" }, { now: clock.now, rng: () => 0.5, hasSpanishVoice: true });
    expect(sent?.speak).toEqual({ text: "hola" });
    const after = store.getSnapshot();
    expect(after.status === "ready" && after.progress.units[U01]?.step).toBe(2);
  });
});

// ---------- 2. Fahrplan ----------

describe("Fahrplan der Einheit", () => {
  it("neue Haltestelle: fünf Schritte, nichts abgehakt, „Beginnen“, kein Ton, Haltestelle noch nicht begonnen", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock, true, 1, false);
    const screen = plan(run);
    expect(screen.label).toBe("Heute · Haltestelle 1");
    expect(screen.title).toEqual({ text: "¡Hola!", spanish: true });
    expect(screen.rows.map((row) => [row.name, row.detail, row.done])).toEqual([
      ["Neue Karten", "16 Karten", false],
      ["Grammatik", "ser in der Einzahl: soy, eres, es", false],
      ["Dialog", "An der Rezeption der Unterkunft", false],
      ["Abschlussrunde", "19 Aufgaben", false],
      ["Mission", "Dreimal grüßen", false],
    ]);
    expect(screen.button).toBe("Beginnen");
    expect(run.spoken).toEqual([]);
    expect(run.progress.units[U01]).toBeUndefined();
    expect(run.state.tally.answered).toBe(0);
  });

  it("Folgetag mit fälligen Karten: Wiederholen steht vorn, „16 Karten“", () => {
    const { clock, run: day1 } = playUnit1();
    clock.advance(1);
    const run = new Run(day1.progress, { kind: "day", unitId: "u02" }, clock, true, 1, false);
    const screen = plan(run);
    expect(screen.rows[0]).toEqual({ step: 1, name: "Wiederholen", detail: "16 Karten", done: false });
    expect(screen.rows).toHaveLength(6);
    expect(screen.label).toBe("Heute · Haltestelle 2");
    expect(screen.title.text).toBe("En el café");
    expect(screen.button).toBe("Beginnen");
  });

  it("läuft die Haltestelle schon, sind die erledigten Schritte abgehakt und der Knopf nennt den Schritt", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "grammar" });
    run.reload({ kind: "day", unitId: U01 }, 3, false);
    const screen = plan(run);
    expect(screen.rows.map((row) => row.done)).toEqual([true, false, false, false, false]);
    expect(screen.button).toBe("Weiter bei Schritt 3");
    expect(html(run.state, run.progress)).toContain("Weiter bei Schritt 3");
  });

  it("nur Wiederholen und freie Runde: eine Zeile, deutsche große Zeile", () => {
    const { clock, run: day1 } = playUnit1();
    clock.advance(1);
    const review = new Run(day1.progress, { kind: "day", unitId: null }, clock, true, 1, false);
    expect(plan(review)).toMatchObject({ label: "Heute", title: { text: "Wiederholen", spanish: false }, button: "Beginnen" });
    expect(plan(review).rows).toEqual([{ step: 1, name: "Wiederholen", detail: "16 Karten", done: false }]);

    const extra = new Run(day1.progress, { kind: "extra" }, clock, true, 1, false);
    expect(plan(extra)).toMatchObject({ title: { text: "10 Karten extra", spanish: false } });
    expect(plan(extra).rows).toHaveLength(1);
    expect(plan(extra).rows[0]?.detail).toBe("10 Karten");
  });

  it("der erste Bildschirm ist immer der Fahrplan, keine Runde ist gebaut, erst „begin“ baut sie", () => {
    const { clock, run: day1 } = playUnit1();
    clock.advance(1);
    for (const request of [{ kind: "day", unitId: "u02" }, { kind: "day", unitId: null }, { kind: "extra" }] as const) {
      const run = new Run(day1.progress, request, clock, true, 1, false);
      expect(run.state.screen.kind).toBe("plan");
      run.send({ type: "next" });
      run.send({ type: "choose", index: 0 });
      expect(run.state.screen.kind).toBe("plan");
      run.send({ type: "begin" });
      expect(run.state.screen.kind).toBe("task");
    }
  });

  it("ohne spanische Stimme wird die Runde erst beim Tippen gebaut: aus „Hören“ wird „Erkennen“", () => {
    const { clock, run: day1 } = playUnit1();
    clock.advance(1);
    const run = new Run(day1.progress, { kind: "day", unitId: "u02" }, clock, false, 1, false);
    const speak = run.send({ type: "begin" });
    expect(run.task.task.type).toBe("recognize");
    expect(speak).toBeNull();
  });

  it("zeichnet Kästchen, Haken, Angaben und den Hauptknopf; der Kopf zeigt nur „Schließen“", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "grammar" });
    run.reload({ kind: "day", unitId: U01 }, 3, false);
    const page = html(run.state, run.progress);
    expect(page).toContain("Heute · Haltestelle 1");
    expect(page).toContain('lang="es"');
    expect(page).toContain("¡Hola!");
    expect(page.match(/sx-plan__box--done/g)).toHaveLength(1);
    expect(page).toContain("16 Karten");
    expect(page).toContain("An der Rezeption der Unterkunft");
    expect(page).toContain("19 Aufgaben");
    expect(page).toContain("Schließen");
    expect(page).not.toContain("Schritt 3 von 6");
  });
});

// ---------- Angabe rechts in einer Zeile ----------

describe("Fahrplan: Angabe rechts in einer Zeile, rechtsbündig, nur lange Angaben brechen um", () => {
  const rule = (selector: string): string => {
    const match = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`).exec(sessionCss);
    if (!match) throw new Error(`Regel ${selector} fehlt`);
    return match[1] ?? "";
  };

  it("kurze Angaben („16 Karten“, „15 Karten“, „18 Aufgaben“) tragen keine Umbruchklasse, lange schon", () => {
    expect(isLongDetail("16 Karten")).toBe(false);
    expect(isLongDetail("15 Karten")).toBe(false);
    expect(isLongDetail("18 Aufgaben")).toBe(false);
    expect(isLongDetail("Dreimal grüßen")).toBe(false);
    expect(isLongDetail("ser in der Einzahl: soy, eres, es")).toBe(true);
    expect(isLongDetail("An der Rezeption der Unterkunft")).toBe(true);

    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock, true, 1, false);
    const page = html(run.state, run.progress);
    expect(page).toContain('<span class="sx-plan__detail">16 Karten</span>');
    expect(page).toContain('<span class="sx-plan__detail">19 Aufgaben</span>');
    expect(page).toContain('<span class="sx-plan__detail sx-plan__detail--long">An der Rezeption der Unterkunft</span>');
    expect(page).toContain('<span class="sx-plan__detail sx-plan__detail--long">ser in der Einzahl: soy, eres, es</span>');
  });

  it("die Regeln: Angabe ohne Umbruch, rechtsbündig; die lange darf umbrechen, höchstens zwei Drittel; der Name bricht nie um", () => {
    const base = rule(".sx-plan__detail");
    expect(base).toMatch(/white-space:\s*nowrap/);
    expect(base).toMatch(/text-align:\s*right/);
    expect(base).toMatch(/margin-left:\s*auto/);
    expect(base).not.toMatch(/max-width/);
    const long = rule(".sx-plan__detail--long");
    expect(long).toMatch(/white-space:\s*normal/);
    expect(long).toMatch(/max-width:\s*66\.66/);
    expect(rule(".sx-plan__name")).toMatch(/white-space:\s*nowrap/);
    expect(rule(".sx-plan__row")).toMatch(/display:\s*flex/);
  });
});

// ---------- 4. Zähler nach dem Neuladen ----------

describe("Zähler in der Abschlussrunde nach dem Neuladen", () => {
  it("zählt über die ganze Runde: „6 von 19“, nicht neu ab 1", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.role === "final" && r.state.screen.answer === null && r.state.screen.round?.completed === 5 });
    run.reload({ kind: "day", unitId: U01 });
    const page = html(run.state, run.progress);
    expect(page).toContain("6 von 19");
    // Nach der Antwort zählt sie weiter, nach einem Fehler und der Wiedervorlage bleibt der Zähler beim Stand.
    const task = run.task.task as ChoiceTask;
    run.send({ type: "choose", index: task.correctIndex });
    expect(html(run.state, run.progress)).toContain("6 von 19");
    run.send({ type: "next" });
    expect(html(run.state, run.progress)).toContain("7 von 19");
  });
});

// ---------- 5. Zusammenfassungen ----------

const facts = (patch: Partial<SummaryFacts>): SummaryFacts => ({
  kind: "review",
  stop: null,
  newCards: 0,
  reviewed: 0,
  right: 0,
  answered: 0,
  pointsGained: 0,
  streak: 0,
  ...patch,
});

describe("Zusammenfassungen ohne Haltestelle", () => {
  const opts = { calm: false, missionTitle: null, doneStops: 1 };

  it("Wiederholrunde: wiederholte Karten, richtige, Punkte; keine Zeile mit +0 oder 0 Tagen, kein „geschafft“", () => {
    const text = summaryText(facts({ reviewed: 16, answered: 16, right: 12, pointsGained: 120, streak: 2 }), opts);
    expect(text.lines).toEqual([
      { label: "Wiederholte Karten", value: "16" },
      { label: "Richtige Antworten", value: "12 von 16" },
      { label: "Punkte", value: "+120" },
      { label: "Serie", value: "2 Tage" },
    ]);
    expect(text.headline).not.toContain("geschafft");

    const none = summaryText(facts({ reviewed: 16, answered: 16, right: 0, pointsGained: 0, streak: 0 }), opts);
    expect(none.lines.map((line) => line.label)).toEqual(["Wiederholte Karten", "Richtige Antworten"]);
    expect(JSON.stringify(none)).not.toMatch(/\+0|0 Tage/);
  });

  it("Ruhemodus: weder Punkte noch Serie", () => {
    const text = summaryText(facts({ reviewed: 16, answered: 16, right: 16, pointsGained: 160, streak: 3 }), { ...opts, calm: true });
    expect(text.lines.map((line) => line.label)).toEqual(["Wiederholte Karten", "Richtige Antworten"]);
  });

  it("freie Runde: geübte Karten, richtige, nie Punkte; Serie nur ab einem Tag", () => {
    const text = summaryText(facts({ kind: "extra", reviewed: 10, answered: 10, right: 9, pointsGained: 0, streak: 1 }), opts);
    expect(text.lines).toEqual([
      { label: "Geübte Karten", value: "10" },
      { label: "Richtige Antworten", value: "9 von 10" },
      { label: "Serie", value: "1 Tag" },
    ]);
    expect(text.headline).not.toContain("geschafft");
    expect(summaryText(facts({ kind: "extra", reviewed: 10, answered: 10, right: 9 }), opts).lines).toHaveLength(2);
  });

  it("Haltestelle: „geschafft“ bleibt, mit Mission und Stand", () => {
    const text = summaryText(facts({ kind: "unit", stop: 3, newCards: 15, answered: 18, right: 18, pointsGained: 280, streak: 1 }), {
      calm: false,
      missionTitle: "Preis erfragen",
      doneStops: 3,
    });
    expect(text.headline).toBe("Haltestelle 3 ist geschafft.");
    expect(text.notes).toEqual(["3 von 10 Haltestellen abgeschlossen.", "Deine Mission ist offen: Preis erfragen"]);
  });

  it("nach der Wiederholrunde und der freien Runde steht in der Ansicht weder „+0“ noch „0 Tage“", () => {
    const { clock, run: day1 } = playUnit1();
    clock.advance(1);
    const review = new Run(day1.progress, { kind: "day", unitId: null }, clock);
    play(review, { wrongInReview: 16 });
    const reviewPage = html(review.state, review.progress);
    expect(reviewPage).toContain("Wiederholte Karten");
    expect(reviewPage).not.toMatch(/\+0|0 Tage|geschafft/);

    const extra = new Run(review.progress, { kind: "extra" }, clock);
    play(extra);
    const extraPage = html(extra.state, extra.progress);
    expect(extraPage).toContain("Geübte Karten");
    expect(extraPage).not.toMatch(/\+0|0 Tage|geschafft|Punkte<\/dt>/);
  });
});

// ---------- 6. Berg am Ende einer Haltestelle ----------

describe("Berg in der Zusammenfassung", () => {
  it("der alte Stand zeigt die Haltestelle als „läuft“ und die nächste als gesperrt, der neue „abgeschlossen“ und „offen“", () => {
    const { run } = playUnit1();
    const after = mountainStops(run.progress);
    expect(after.slice(0, 3)).toEqual(["done", "open", "locked"]);
    expect(mountainBefore(after, U01).slice(0, 3)).toEqual(["running", "locked", "locked"]);
  });

  it("ohne Bewegung (Server-Render, Ruhemodus) steht gleich der neue Stand", () => {
    const { run } = playUnit1();
    expect(html(run.state, run.progress)).toMatch(/data-state="done"/);
    const calm: Progress = { ...run.progress, profile: { ...run.progress.profile, calm: true } };
    expect(html(run.state, calm)).toMatch(/data-state="done"/);
  });
});

// ---------- 8. Speichern scheitert ----------

describe("Hinweis bei gescheitertem Speichern", () => {
  it("der Speicher meldet saveFailed, die Lerneinheit zeigt den Hinweis im Wortlaut der App", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    expect(renderToStaticMarkup(<SaveFailedNotice saveFailed={false} />)).toBe("");
    run.storage.failing = true;
    run.extraMs += 5_000; // Lernzeit gutgeschrieben: der Fortschritt ändert sich und muss gespeichert werden
    run.send({ type: "next" });
    const snapshot = run.store.getSnapshot();
    const failed = snapshot.status === "ready" && snapshot.saveFailed;
    expect(failed).toBe(true);
    const page = renderToStaticMarkup(<SaveFailedNotice saveFailed={failed} />);
    expect(page).toContain("Dein Lernstand lässt sich auf diesem Gerät nicht speichern. Er geht verloren, wenn du die App schließt.");
    expect(SAVE_FAILED_TEXT).toBe("Dein Lernstand lässt sich auf diesem Gerät nicht speichern. Er geht verloren, wenn du die App schließt.");
    expect(page).toContain('role="status"');
  });
});