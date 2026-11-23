import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FINAL_REVIEW } from "../../core/config";
import { allItems, getUnit } from "../../core/content";
import { pickFinalStationIds, wrongTodayIds } from "../../core/flow";
import { createRng } from "../../core/random";
import type { CardProgress, Progress } from "../../core/types";
import { summaryFacts, summaryText, wrongCardsOf } from "./machine";
import type { SessionState } from "./machine";
import { SessionScreen } from "./SessionScreen";
import { newDay1, play, playUnit1, Run, U01 } from "./sessionKit";

function decode(html: string): string {
  return html.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
}

function html(state: SessionState, progress: Progress, day: string): string {
  return decode(
    renderToStaticMarkup(
      <SessionScreen state={state} progress={progress} day={day} hasVoice onEvent={() => {}} onSpeak={() => {}} onClose={() => {}} onExit={() => {}} />,
    ),
  );
}

describe("Mission am Ende der Haltestelle", () => {
  it("Schritt 6 zeigt für jeden Satz Anhören, Langsam, Zeigen und die aufdeckbare Übersetzung", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "mission" });
    const page = html(run.state, run.progress, "2026-11-23");
    const unit = getUnit(U01)!;
    const n = unit.mission.say.length;
    expect(unit.mission.say_de).toHaveLength(n);
    const count = (text: string): number => page.split(text).length - 1;
    expect(count(">Zeigen<")).toBe(n);
    expect(count("Übersetzung aufdecken")).toBe(n);
    expect(count("Anhören")).toBe(n);
    expect(count("Langsam")).toBe(n);
    for (const sentence of unit.mission.say) expect(page).toContain(sentence);
    expect(page).not.toContain("{name}");
  });
});

function cardsFor(ids: string[], make: (i: number) => CardProgress): Progress["cards"] {
  return Object.fromEntries(ids.map((id, i) => [id, make(i)]));
}

describe("Endstation ohne doppelte Wertung am selben Tag", () => {
  const day = "2026-11-23";
  const ids = allItems.map((item) => item.id);
  const base = newDay1().progress;
  const answeredToday = (): CardProgress => ({ box: 2, due: "2026-11-25", right: 1, wrong: 0, lastSeen: day });
  const older = (i: number): CardProgress => ({ box: ((i % 5) + 1) as CardProgress["box"], due: "2026-12-30", right: 1, wrong: 0, lastSeen: "2026-11-10" });

  it("keine der eben beantworteten Karten, solange genug andere da sind", () => {
    const today = ids.slice(0, 20);
    const progress = { ...base, cards: { ...cardsFor(today, answeredToday), ...cardsFor(ids.slice(20), older) } };
    for (let seed = 1; seed <= 5; seed++) {
      const picked = pickFinalStationIds(progress, createRng(seed), day);
      expect(picked).toHaveLength(FINAL_REVIEW.taskCount);
      expect(picked.filter((id) => today.includes(id))).toEqual([]);
    }
  });

  it("mit zu wenigen anderen werden es trotzdem 30, die heutigen zuletzt", () => {
    const today = ids.slice(0, 25);
    const others = ids.slice(25, 25 + 12);
    const progress = { ...base, cards: { ...cardsFor(today, answeredToday), ...cardsFor(others, older) } };
    const picked = pickFinalStationIds(progress, createRng(3), day);
    expect(picked).toHaveLength(FINAL_REVIEW.taskCount);
    expect(picked.slice(0, others.length).sort()).toEqual([...others].sort());
    expect(picked.slice(others.length).every((id) => today.includes(id))).toBe(true);
  });

  it("ohne Tag bleibt die bisherige Auswahl", () => {
    const progress = { ...base, cards: cardsFor(ids, older) };
    expect(pickFinalStationIds(progress, createRng(2))).toHaveLength(FINAL_REVIEW.taskCount);
  });
});

describe("Zusammenfassung nach einem Neuladen", () => {
  it("Abschlussrunde: falsche Karten und Zahl der richtigen stimmen, auch wenn mitten in der Runde neu geladen wurde", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.role === "final" });
    const first = run.task.task;
    if (first.kind !== "choice") throw new Error("Erkennen erwartet");
    run.send({ type: "choose", index: (first.correctIndex + 1) % first.options.length });
    play(run, { stopWhen: (r) => (r.progress.units[U01]?.answered?.length ?? 0) === 3 });
    expect(run.progress.units[U01]?.answered).toHaveLength(3);

    run.reload({ kind: "day", unitId: U01 }, 7, true);
    expect(play(run)).toBe(true);
    expect(run.state.screen).toMatchObject({ kind: "summary", summary: "unit" });

    const day = "2026-11-23";
    const unit = getUnit(U01)!;
    const total = unit.items.length + unit.build.length;
    const facts = summaryFacts(run.state, run.progress, day);
    expect(facts.rightKnown).toBe(true);
    expect(facts.answered).toBe(total);
    expect(facts.right).toBe(total - 1);
    const text = summaryText(facts, { calm: false, missionTitle: null, doneStops: 1 });
    expect(text.lines).toContainEqual({ label: "Richtige Antworten", value: `${total - 1} von ${total}` });
    expect(wrongCardsOf(run.state, run.progress, day).map((item) => item.id)).toEqual([first.itemId]);
    expect(html(run.state, run.progress, day)).toContain("Kommen morgen wieder");
  });

  it("Abschlussrunde: ist eine Satzbau-Aufgabe vor dem Neuladen beantwortet, fehlt die Zeile mit den Richtigen statt einer falschen Zahl", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    const unit = getUnit(U01)!;
    play(run, { stopWhen: (r) => (r.progress.units[U01]?.answered?.length ?? 0) === unit.items.length + 1 });
    run.reload({ kind: "day", unitId: U01 }, 7, true);
    expect(play(run)).toBe(true);
    const facts = summaryFacts(run.state, run.progress, "2026-11-23");
    expect(facts.rightKnown).toBe(false);
    const text = summaryText(facts, { calm: false, missionTitle: null, doneStops: 1 });
    expect(text.lines.map((line) => line.label)).not.toContain("Richtige Antworten");
  });

  it("Wiederholrunde: Liste der falschen Karten aus dem Lernstand, Zeile mit den Richtigen entfällt", () => {
    const { clock, run: done } = playUnit1();
    clock.advance(1);
    const day = "2026-11-24";
    const cards = Object.fromEntries(Object.entries(done.progress.cards).map(([id, card]) => [id, { ...card, box: 2 as const, due: day }]));
    const run = new Run({ ...done.progress, cards }, { kind: "day", unitId: null }, clock);
    const seen = (r: Run): number => Object.values(r.progress.cards).filter((card) => card.lastSeen === day).length;
    play(run, { wrongInReview: 2, stopWhen: (r) => seen(r) >= 5 && r.state.screen.kind === "task" && r.state.screen.answer === null });
    const wrongBefore = wrongTodayIds(run.progress, day);
    expect(wrongBefore).toHaveLength(2);

    run.reload({ kind: "day", unitId: null }, 5, true);
    expect(play(run)).toBe(true);
    expect(run.state.screen).toMatchObject({ kind: "summary", summary: "review" });
    expect(run.state.tally.wrongIds).toEqual([]);
    expect(wrongCardsOf(run.state, run.progress, day).map((item) => item.id)).toEqual(wrongBefore);
    const page = html(run.state, run.progress, day);
    expect(page).toContain("Kommen morgen wieder");
    const facts = summaryFacts(run.state, run.progress, day);
    expect(facts.rightKnown).toBe(false);
    expect(page).not.toContain("Richtige Antworten");
  });

  it("ohne Neuladen bleibt die Zeile mit den Richtigen", () => {
    const { run } = playUnit1();
    const facts = summaryFacts(run.state, run.progress, "2026-11-23");
    expect(facts.rightKnown).toBe(true);
    expect(summaryText(facts, { calm: false, missionTitle: null, doneStops: 1 }).lines.map((l) => l.label)).toContain("Richtige Antworten");
  });
});
