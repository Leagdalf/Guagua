import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EXTRA_ROUND_CARDS, FINAL_REVIEW, MAX_WRITE_TASKS_PER_ROUND, REVIEW_ROUND_AFTER_FINAL } from "../../core/config";
import { getUnit, units } from "../../core/content";
import { isRepeat } from "../../core/round";
import type { Box, Progress } from "../../core/types";
import { isWritable } from "../../core/tasks";
import type { SessionState, TaskScreen } from "./machine";
import { SessionScreen } from "./SessionScreen";
import { newDay1, play, playUnit1, Run, U01 } from "./sessionKit";
import type { Clock } from "./sessionKit";

function decode(html: string): string {
  return html.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
}

function html(state: SessionState, progress: Progress): string {
  return decode(
    renderToStaticMarkup(
      <SessionScreen state={state} progress={progress} day="2026-11-24" hasVoice onEvent={() => {}} onSpeak={() => {}} onClose={() => {}} onExit={() => {}} />,
    ),
  );
}

/** Haltestelle 1 geschafft, am nächsten Tag stehen alle 16 Karten in `box` und sind fällig. */
function nextDayWithBox(box: Box): { clock: Clock; progress: Progress } {
  const { clock, run } = playUnit1();
  clock.advance(1);
  const cards = Object.fromEntries(Object.entries(run.progress.cards).map(([id, card]) => [id, { ...card, box, due: "2026-11-24" }]));
  return { clock, progress: { ...run.progress, cards } };
}

/** Bis zur ersten Aufgabe dieser Art spielen (Auswahl wird richtig beantwortet). */
function toFirst(run: Run, kind: "write" | "say"): TaskScreen {
  for (let guard = 0; guard < 60; guard++) {
    const screen = run.task;
    if (screen.task.kind === kind && screen.answer === null) return screen;
    if (screen.answer === null && screen.task.kind === "choice") run.send({ type: "choose", index: screen.task.correctIndex });
    else if (screen.answer === null && screen.task.kind === "write") run.send({ type: "submitText", text: screen.task.solution });
    else if (screen.answer === null && screen.task.kind === "say") {
      run.send({ type: "uncover" });
      run.send({ type: "sat" });
      continue;
    }
    run.send({ type: "next" });
  }
  throw new Error(`Keine Aufgabe ${kind}`);
}

describe("Schreiben: Weiß ich nicht und Meine Antwort stimmt auch", () => {
  it("„Weiß ich nicht“ steht unter dem Feld, zeigt die Lösung und zählt erst mit dem Weitergehen als falsch", () => {
    const { clock, progress } = nextDayWithBox(3);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const screen = toFirst(run, "write");
    const task = screen.task;
    if (task.kind !== "write") throw new Error("Schreiben erwartet");
    const page = html(run.state, run.progress);
    expect(page).toContain("Weiß ich nicht");
    expect(page.indexOf("Weiß ich nicht")).toBeGreaterThan(page.indexOf("<input"));
    expect(page).toContain(">Deine Antwort<");
    run.send({ type: "giveUp" });
    expect(run.task.answer).toMatchObject({ correct: false, solution: task.solution, chosen: null });
    expect(run.progress.cards[task.itemId]?.box).toBe(3);
    const after = html(run.state, run.progress);
    expect(after).toContain("Falsch. Richtig ist:");
    expect(after).not.toContain("Weiß ich nicht");
    // Wer aufgibt, kann nicht widersprechen.
    expect(after).not.toContain("Meine Antwort stimmt auch");
    run.send({ type: "accept" });
    expect(run.task.answer).toMatchObject({ correct: false });
    run.send({ type: "next" });
    expect(run.progress.cards[task.itemId]).toMatchObject({ box: 1, due: "2026-11-25", wrong: 1 });
  });

  it("nach einer falschen Eingabe steht „Meine Antwort stimmt auch“: dann zählt sie als richtig, gewertet mit dem Weitergehen", () => {
    const { clock, progress } = nextDayWithBox(3);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const task = toFirst(run, "write").task;
    if (task.kind !== "write") throw new Error("Schreiben erwartet");
    const points = run.progress.stats.points;
    run.send({ type: "submitText", text: "qqqq" });
    expect(html(run.state, run.progress)).toContain("Meine Antwort stimmt auch");
    expect(run.progress.cards[task.itemId]?.box).toBe(3);
    run.send({ type: "accept" });
    expect(run.task.answer).toMatchObject({ correct: true, chosen: "qqqq" });
    const page = html(run.state, run.progress);
    expect(page).not.toContain("Meine Antwort stimmt auch");
    expect(page).toContain("Richtig.");
    expect(run.progress.cards[task.itemId]?.box).toBe(3);
    run.send({ type: "next" });
    expect(run.progress.cards[task.itemId]).toMatchObject({ box: 4, wrong: 0 });
    expect(run.progress.stats.points).toBe(points + 10);
    expect(run.state.tally.wrongIds).toEqual([]);
  });

  it("bei einer richtigen Eingabe gibt es den Knopf nicht", () => {
    const { clock, progress } = nextDayWithBox(3);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const task = toFirst(run, "write").task;
    if (task.kind !== "write") throw new Error("Schreiben erwartet");
    run.send({ type: "submitText", text: task.solution });
    expect(html(run.state, run.progress)).not.toContain("Meine Antwort stimmt auch");
    run.send({ type: "accept" });
    expect(run.task.answer).toMatchObject({ correct: true });
  });

  it("ein Neuladen vor dem Weitergehen wertet nichts und zeigt die Aufgabe erneut", () => {
    const { clock, progress } = nextDayWithBox(3);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const screen = toFirst(run, "write");
    const task = screen.task;
    if (task.kind !== "write") throw new Error("Schreiben erwartet");
    const before = run.progress;
    run.send({ type: "submitText", text: "qqqq" });
    run.reload({ kind: "day", unitId: null });
    expect(run.progress.cards).toEqual(before.cards);
    expect(run.progress.stats.points).toBe(before.stats.points);
    // Dieselbe Aufgabe steht wieder an, ohne Antwort.
    let again: TaskScreen | null = null;
    for (let guard = 0; guard < 60 && !again; guard++) {
      const s = run.task;
      if (s.task.id === task.id) again = s;
      else {
        if (s.task.kind === "choice") run.send({ type: "choose", index: s.task.correctIndex });
        else if (s.task.kind === "write") run.send({ type: "submitText", text: s.task.solution });
        else {
          run.send({ type: "uncover" });
          run.send({ type: "sat" });
        }
        if (run.state.screen.kind === "task" && run.task.answer !== null) run.send({ type: "next" });
      }
    }
    expect(again?.answer).toBeNull();
  });

  it("Wiedervorlage einer falschen Schreibaufgabe: Feld leer, Karte nur einmal gewertet", () => {
    const { clock, progress } = nextDayWithBox(3);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const first = toFirst(run, "write");
    const task = first.task;
    if (task.kind !== "write") throw new Error("Schreiben erwartet");
    run.send({ type: "submitText", text: "qqqq" });
    run.send({ type: "next" });
    expect(run.progress.cards[task.itemId]).toMatchObject({ box: 1, wrong: 1, right: 1 });
    // Weiter, bis die Wiedervorlage kommt (frühestens nach drei anderen Karten).
    let repeat: TaskScreen | null = null;
    for (let guard = 0; guard < 40 && !repeat; guard++) {
      const s = run.task;
      if (s.task.id === task.id && s.repeat) {
        repeat = s;
        break;
      }
      if (s.answer === null) {
        if (s.task.kind === "choice") run.send({ type: "choose", index: s.task.correctIndex });
        else if (s.task.kind === "write") run.send({ type: "submitText", text: s.task.solution });
        else {
          run.send({ type: "uncover" });
          run.send({ type: "sat" });
          continue;
        }
      }
      run.send({ type: "next" });
    }
    if (!repeat) throw new Error("Keine Wiedervorlage");
    expect(isRepeat(repeat.round!)).toBe(true);
    expect(repeat.answer).toBeNull();
    expect(repeat.seq).toBeGreaterThan(first.seq);
    // Das Feld ist leer: Die Ansicht hält den Text je Aufgabe (seq), eine neue Aufgabe beginnt leer.
    expect(html(run.state, run.progress)).toMatch(/<input[^>]*value=""/);
    expect(html(run.state, run.progress)).toContain("noch einmal");
    const points = run.progress.stats.points;
    run.send({ type: "submitText", text: task.solution });
    run.send({ type: "next" });
    // Die zweite Antwort ändert nichts: Fach 1, einmal falsch, keine Punkte.
    expect(run.progress.cards[task.itemId]).toMatchObject({ box: 1, wrong: 1, right: 1 });
    expect(run.progress.stats.points).toBe(points);
  });
});

describe("Sag es laut", () => {
  it("nach sechs Schreibaufgaben kommen Wörter und Wendungen als „Sag es laut“, Satzmuster als „Erinnern“", () => {
    const { clock, progress } = nextDayWithBox(4);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const types = run.task.round!.queue.map((task) => task.type);
    expect(types.filter((type) => type === "write")).toHaveLength(MAX_WRITE_TASKS_PER_ROUND);
    expect(types.filter((type) => type === "say").length).toBeGreaterThan(0);
    for (const task of run.task.round!.queue) if (task.type === "say") expect(isWritable(units[0]!.items.find((item) => item.id === task.itemId)!)).toBe(true);
  });

  it("„Aufdecken“ spricht die Lösung im selben Tippen, „Saß“ zählt als richtig und geht gleich weiter", () => {
    const { clock, progress } = nextDayWithBox(4);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const screen = toFirst(run, "say");
    const task = screen.task;
    if (task.kind !== "say") throw new Error("Sag es laut erwartet");
    const before = run.spoken.length;
    let page = html(run.state, run.progress);
    expect(page).toContain("Sag es laut");
    expect(page).toContain(task.prompt);
    expect(page).toContain(">Aufdecken<");
    expect(page).not.toContain(task.solution);
    // Vor dem Aufdecken ist nichts gesprochen und nichts gewertet.
    expect(run.spoken).toHaveLength(before);
    run.send({ type: "sat" });
    expect(run.task.task.id).toBe(task.id);
    const points = run.progress.stats.points;
    const spoken = run.send({ type: "uncover" });
    expect(spoken).toEqual({ text: task.speak });
    expect(run.spoken[run.spoken.length - 1]).toMatchObject({ text: task.speak });
    expect(run.spoken[run.spoken.length - 1]!.after.screen).toMatchObject({ kind: "task", uncovered: true });
    page = html(run.state, run.progress);
    expect(page).toContain(task.solution);
    expect(page).toContain(">Saß<");
    expect(page).toContain(">Noch mal<");
    expect(page).not.toContain(">Aufdecken<");
    expect(page).toMatch(/tabindex="-1"/);
    expect(run.progress.cards[task.itemId]?.box).toBe(4);
    run.send({ type: "sat" });
    expect(run.progress.cards[task.itemId]).toMatchObject({ box: 5, wrong: 0 });
    expect(run.progress.stats.points).toBe(points + 10);
    expect(run.task.task.id).not.toBe(task.id);
  });

  it("„Noch mal“ zählt als falsch: Fach 1, keine Punkte, die Karte kommt in der Runde wieder", () => {
    const { clock, progress } = nextDayWithBox(4);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const task = toFirst(run, "say").task;
    if (task.kind !== "say") throw new Error("Sag es laut erwartet");
    const points = run.progress.stats.points;
    run.send({ type: "uncover" });
    run.send({ type: "again" });
    expect(run.progress.cards[task.itemId]).toMatchObject({ box: 1, due: "2026-11-25", wrong: 1 });
    expect(run.progress.stats.points).toBe(points);
    expect(run.task.round!.queue.some((t) => t.id === task.id)).toBe(true);
    expect(run.state.tally.wrongIds).toContain(task.itemId);
  });

  it("ohne spanische Stimme funktioniert die Aufgabe, nur ohne Ton", () => {
    const { clock, progress } = nextDayWithBox(4);
    const run = new Run(progress, { kind: "day", unitId: null }, clock, false);
    const task = toFirst(run, "say").task;
    if (task.kind !== "say") throw new Error("Sag es laut erwartet");
    const noVoice = decode(
      renderToStaticMarkup(
        <SessionScreen state={run.state} progress={run.progress} day="2026-11-24" hasVoice={false} onEvent={() => {}} onSpeak={() => {}} onClose={() => {}} onExit={() => {}} />,
      ),
    );
    expect(noVoice).toContain(">Aufdecken<");
    run.send({ type: "uncover" });
    run.send({ type: "sat" });
    expect(run.progress.cards[task.itemId]?.box).toBe(5);
  });

  it("ohne Aufdecken zählen „Saß“ und „Noch mal“ nicht", () => {
    const { clock, progress } = nextDayWithBox(4);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const task = toFirst(run, "say").task;
    if (task.kind !== "say") throw new Error("Sag es laut erwartet");
    run.send({ type: "again" });
    run.send({ type: "choose", index: 0 });
    run.send({ type: "next" });
    expect(run.task.task.id).toBe(task.id);
    expect(run.progress.cards[task.itemId]?.box).toBe(4);
  });

  it("im Rollenspiel geht der Fokus nach „Aufdecken“ auf die aufgedeckte Zeile", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "dialogue" });
    const lines = getUnit(U01)!.dialogue.lines;
    for (let i = 1; i < lines.length; i++) run.send({ type: "next" });
    run.send({ type: "next" });
    run.send({ type: "next" });
    const hidden = html(run.state, run.progress);
    expect(hidden).not.toMatch(/<li[^>]*tabindex="-1"/);
    run.send({ type: "uncover" });
    expect(html(run.state, run.progress)).toMatch(/<li[^>]*tabindex="-1"/);
  });
});

describe("Kommen morgen wieder", () => {
  it("die Zusammenfassung der Wiederholrunde listet falsch beantwortete Karten mit Spanisch, Deutsch und Ton", () => {
    const { clock, progress } = nextDayWithBox(2);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    expect(play(run, { wrongInReview: 2 })).toBe(true);
    expect(run.state.screen).toMatchObject({ kind: "summary", summary: "review" });
    expect(run.state.tally.wrongIds).toHaveLength(2);
    const page = html(run.state, run.progress);
    expect(page).toContain("Kommen morgen wieder");
    for (const id of run.state.tally.wrongIds) {
      const item = units.flatMap((unit) => unit.items).find((entry) => entry.id === id)!;
      expect(page).toContain(`class="es">${item.es}</span>`);
      expect(page).toContain(item.de);
      expect(run.progress.cards[id]).toMatchObject({ box: 1, due: "2026-11-25" });
    }
    expect(page.match(/Anhören/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("ohne falsche Antworten und in der freien Runde gibt es die Liste nicht", () => {
    const { clock, progress } = nextDayWithBox(2);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    play(run);
    expect(html(run.state, run.progress)).not.toContain("Kommen morgen wieder");
    const extra = new Run(progress, { kind: "extra" }, clock);
    play(extra, { wrongInReview: 0 });
    expect(extra.state.screen).toMatchObject({ kind: "summary", summary: "extra" });
    expect(html(extra.state, extra.progress)).not.toContain("Kommen morgen wieder");
  });

  it("die Abschlussrunde der Haltestelle nennt ihre falschen Karten auch", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    // Die Abschlussrunde: erste Karte falsch beantworten.
    play(run, { stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.role === "final" });
    const task = run.task.task;
    if (task.kind !== "choice") throw new Error("Auswahl erwartet");
    run.send({ type: "choose", index: (task.correctIndex + 1) % task.options.length });
    expect(play(run)).toBe(true);
    expect(run.state.screen).toMatchObject({ kind: "summary", summary: "unit" });
    expect(run.state.tally.wrongIds).toEqual([task.itemId]);
    expect(html(run.state, run.progress)).toContain("Kommen morgen wieder");
  });
});

describe("„10 Karten extra“ wählt bei jedem Start neu", () => {
  it("andere Startwerte, andere Karten; niedrige Fächer zuerst", () => {
    const { clock, progress } = nextDayWithBox(2);
    const ids = (seed: number) => new Run(progress, { kind: "extra" }, clock, true, seed).task.round!.queue.map((task) => task.itemId);
    expect(ids(1)).toHaveLength(EXTRA_ROUND_CARDS);
    expect(ids(1)).toEqual(ids(1));
    expect(new Set([1, 2, 3, 4].map((seed) => ids(seed).join(","))).size).toBeGreaterThan(1);
  });
});

describe("Nach der Endstation", () => {
  it("die Wiederholrunde hat höchstens 20 Karten, der Fahrplan nennt 20", () => {
    const { clock, progress } = nextDayWithBox(2);
    const withFinal: Progress = { ...progress, finalReview: { at: "2026-11-23T10:00:00.000Z", right: 16, total: 16 } };
    // Sechzehn Karten genügen nicht: Mehr Karten fällig machen, indem die Grenze über den Kartenbestand geprüft wird.
    const many: Progress = { ...withFinal, cards: { ...withFinal.cards }, units: { ...withFinal.units } };
    for (const unit of units.slice(1, 4)) {
      for (const item of unit.items) many.cards[item.id] = { box: 2, due: "2026-11-24", right: 1, wrong: 0, lastSeen: "2026-11-23" };
      many.units[unit.id] = { step: 6, startedAt: "2026-11-02T10:00:00.000Z", completedAt: "2026-11-03T10:00:00.000Z" };
    }
    const run = new Run(many, { kind: "day", unitId: null }, clock, true, 1, false);
    expect(run.state.screen).toMatchObject({ kind: "plan", rows: [{ detail: `${REVIEW_ROUND_AFTER_FINAL} Karten` }] });
    run.send({ type: "begin" });
    expect(run.task.round?.total).toBe(REVIEW_ROUND_AFTER_FINAL);
  });
});

describe("Dialog noch einmal spielen", () => {
  /** Alles außer der Lernzeit. */
  function withoutTime(progress: Progress): unknown {
    const { activeMsByDay: _time, ...stats } = progress.stats;
    return { ...progress, stats };
  }

  it("Fahrplan mit einer Zeile, Anhören, Rollenspiel, Schluss: ohne Punkte, nur die Lernzeit ändert sich", () => {
    const { clock, run: done } = playUnit1();
    const before = done.progress;
    const run = new Run(before, { kind: "dialogue", unitId: U01 }, clock, true, 1, false);
    const plan = run.state.screen;
    expect(plan).toMatchObject({ kind: "plan", button: "Beginnen" });
    if (plan.kind !== "plan") throw new Error("Fahrplan erwartet");
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({ step: 4, name: "Dialog", done: false });
    expect(html(run.state, run.progress)).toContain("Noch einmal · Haltestelle 1");
    run.send({ type: "begin" });
    expect(run.state.screen).toMatchObject({ kind: "dialogue", phase: "listen", shown: 1 });
    expect(run.spoken).toHaveLength(1);
    expect(play(run)).toBe(true);
    expect(run.state.screen).toMatchObject({ kind: "summary", summary: "replay" });
    expect(run.state.screen).not.toHaveProperty("blocked", true);
    expect(withoutTime(run.progress)).toEqual(withoutTime(before));
    expect(run.progress.stats.points).toBe(before.stats.points);
    expect(run.progress.units[U01]).toEqual(before.units[U01]);
    const page = html(run.state, run.progress);
    expect(page).toContain("Der Dialog ist durch.");
    expect(page).not.toContain("Punkte");
  });

  it("nur für abgeschlossene Haltestellen: sonst endet die Sitzung sofort mit einem Satz und ändert nichts", () => {
    const { clock, run: done } = playUnit1();
    const before = done.progress;
    const run = new Run(before, { kind: "dialogue", unitId: "u02" }, clock, true, 1, false);
    expect(run.state.screen).toMatchObject({ kind: "summary", summary: "replay", blocked: true });
    expect(html(run.state, run.progress)).toContain("Diese Haltestelle ist noch nicht abgeschlossen.");
    expect(run.progress).toEqual(before);
    const fresh = newDay1();
    const none = new Run(fresh.progress, { kind: "dialogue", unitId: U01 }, fresh.clock, true, 1, false);
    expect(none.state.screen).toMatchObject({ kind: "summary", summary: "replay", blocked: true });
    expect(none.progress.units).toEqual(fresh.progress.units);
  });

  it("ein Neuladen mittendrin ändert den Lernstand nicht", () => {
    const { clock, run: done } = playUnit1();
    const before = done.progress;
    const run = new Run(before, { kind: "dialogue", unitId: U01 }, clock);
    run.send({ type: "next" });
    run.reload({ kind: "dialogue", unitId: U01 }, 5, false);
    expect(run.state.screen).toMatchObject({ kind: "plan" });
    expect(withoutTime(run.progress)).toEqual(withoutTime(before));
  });
});

describe("Endstation: Fahrplan und Zahlen", () => {
  function station(): { clock: Clock; progress: Progress } {
    const { clock, run } = playUnit1();
    const cards = run.progress.cards;
    const units10 = Object.fromEntries(units.map((unit) => [unit.id, { step: 6 as const, startedAt: "2026-11-01T10:00:00.000Z", completedAt: "2026-11-02T10:00:00.000Z" }]));
    const allCards = { ...cards };
    for (const unit of units) {
      for (const item of unit.items) allCards[item.id] ??= { box: 2, due: "2027-01-01", right: 1, wrong: 0, lastSeen: "2026-11-02" };
    }
    return { clock, progress: { ...run.progress, cards: allCards, units: units10, stats: { ...run.progress.stats, lastReviewDay: clock.current() } } };
  }

  it("nach der letzten Antwort sagt der Fahrplan nicht „Weiter bei Aufgabe 31“, sondern führt zur Auswertung", () => {
    const { clock, progress } = station();
    const run = new Run(progress, { kind: "final" }, clock);
    play(run, { stopWhen: (r) => (r.progress.finalRun?.answered.length ?? 0) === FINAL_REVIEW.taskCount });
    expect(run.progress.finalRun?.answered).toHaveLength(FINAL_REVIEW.taskCount);
    run.reload({ kind: "final" }, 3, false);
    const screen = run.state.screen;
    if (screen.kind !== "plan") throw new Error("Fahrplan erwartet");
    expect(screen.button).not.toContain(String(FINAL_REVIEW.taskCount + 1));
    expect(screen.button).toBe("Zur Auswertung");
    run.send({ type: "begin" });
    expect(run.state.screen.kind).toBe("line");
    expect(run.progress.finalReview).toMatchObject({ total: FINAL_REVIEW.taskCount });
  });

  it("mitten in der Endstation heißt der Knopf weiter „Weiter bei Aufgabe n“", () => {
    const { clock, progress } = station();
    const run = new Run(progress, { kind: "final" }, clock);
    play(run, { stopWhen: (r) => (r.progress.finalRun?.answered.length ?? 0) === 5 });
    run.reload({ kind: "final" }, 3, false);
    expect(run.state.screen).toMatchObject({ kind: "plan", button: "Weiter bei Aufgabe 6" });
  });
});

describe("Zahlen kommen aus config.ts", () => {
  const raw = import.meta.glob(["./*.{ts,tsx}", "../../core/*.{ts,tsx}", "!**/*.test.{ts,tsx}"], {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  it("in Texten der Lerneinheit und der Lernlogik steht weder 30 noch 10 fest", () => {
    const hits: string[] = [];
    for (const [file, text] of Object.entries(raw)) {
      if (file.endsWith("config.ts")) continue;
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
      code.split("\n").forEach((line, i) => {
        for (const literal of line.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
          if (/\b(30|10)\b/.test(literal[2] ?? "") && !/^[-\w./]+$/.test(literal[2] ?? "")) hits.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });
});
