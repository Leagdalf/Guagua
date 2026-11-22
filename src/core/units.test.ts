import { describe, expect, it } from "vitest";
import { dueCardIds } from "./cards";
import { POINTS, REVIEW_ROUND, REVIEW_ROUND_AFTER_FINAL } from "./config";
import { allItems, units } from "./content";
import {
  buildClozeRound,
  buildExtraRound,
  buildFinalRound,
  buildFinalStationRound,
  buildNewCards,
  buildReviewRound,
  finalStationTaskCount,
  finishFinalReview,
  startFinalStation,
} from "./flow";
import { parseProgress, serializeProgress } from "./progress";
import { createRng } from "./random";
import { answerInRound, isRoundDone } from "./round";
import type { RoundState } from "./round";
import { currentStreak, markStreakDay, recordActivity, reviewedCardsOn } from "./stats";
import { freshProgress, makeClock } from "./testkit";
import { today } from "./time";
import {
  completeMission,
  completeStep,
  currentStep,
  dayCounter,
  finalStationState,
  finishReviewRound,
  missionState,
  missionStates,
  openMissionIds,
  reviewPending,
  sessionPlan,
  skipMission,
  startUnit,
  stopState,
  stopStates,
  todayPlan,
} from "./units";
import type { Progress } from "./types";

const env = { hasSpanishVoice: true };
const u1 = units[0]!;
const u2 = units[1]!;

function drain(progress: Progress, round: RoundState, now: () => Date, correct = true): Progress {
  let p = progress;
  let r = round;
  while (!isRoundDone(r)) ({ progress: p, round: r } = answerInRound(p, r, correct, now));
  return p;
}

/** Haltestelle ab Schritt 2 durchspielen, alles richtig. */
function playUnit(progress: Progress, unitId: string, clock: ReturnType<typeof makeClock>, correct = true): Progress {
  let p = startUnit(progress, unitId, clock.now);
  if (currentStep(p, unitId) === 1) p = completeStep(p, unitId, 1, clock.now);
  for (const step of [2, 3, 4] as const) p = completeStep(p, unitId, step, clock.now);
  p = drain(p, buildFinalRound(p, unitId, createRng(1), env), clock.now, correct);
  return completeStep(p, unitId, 5, clock.now);
}

describe("Haltestellen und Schritte", () => {
  it("am Anfang ist nur Haltestelle 1 offen, die Endstation gesperrt", () => {
    const p = freshProgress(makeClock());
    const states = stopStates(p).map((s) => s.state);
    expect(states).toEqual(["open", ...new Array(9).fill("locked")]);
    expect(finalStationState(p)).toBe("locked");
  });

  it("ohne fällige Karten beginnt die Einheit bei Schritt 2, danach läuft sie", () => {
    const clock = makeClock();
    const p = startUnit(freshProgress(clock), u1.id, clock.now);
    expect(p.units[u1.id]).toMatchObject({ step: 2 });
    expect(stopState(p, u1.id)).toBe("running");
    expect(stopStates(p)[0]?.step).toBe(2);
  });

  it("Schritt 2 legt alle Karten in Fach 1 an, heute fällig", () => {
    const clock = makeClock();
    let p = startUnit(freshProgress(clock), u1.id, clock.now);
    p = completeStep(p, u1.id, 2, clock.now);
    expect(Object.keys(p.cards)).toHaveLength(u1.items.length);
    expect(p.cards[u1.items[0]!.id]).toMatchObject({ box: 1, due: "2026-11-23", right: 0, wrong: 0 });
    expect(currentStep(p, u1.id)).toBe(3);
  });

  it("Dialog bringt 20 Punkte genau einmal, ein Schritt außer der Reihe ändert nichts", () => {
    const clock = makeClock();
    let p = startUnit(freshProgress(clock), u1.id, clock.now);
    expect(completeStep(p, u1.id, 4, clock.now)).toBe(p);
    for (const step of [2, 3] as const) p = completeStep(p, u1.id, step, clock.now);
    p = completeStep(p, u1.id, 4, clock.now);
    expect(p.stats.points).toBe(POINTS.dialogueDone);
    expect(completeStep(p, u1.id, 4, clock.now)).toBe(p);
  });

  it("Neuladen mitten in Schritt 3 setzt bei Schritt 3 fort", () => {
    const clock = makeClock();
    let p = startUnit(freshProgress(clock), u1.id, clock.now);
    p = completeStep(p, u1.id, 2, clock.now); // Schritt 2 fertig, Schritt 3 ist offen
    expect(currentStep(p, u1.id)).toBe(3);
    const reloaded = parseProgress(serializeProgress(p));
    expect(reloaded.status).toBe("ok");
    if (reloaded.status !== "ok") return;
    expect(currentStep(reloaded.progress, u1.id)).toBe(3);
    expect(reloaded.progress).toEqual(p);
    // Der zweite Aufruf von Schritt 2 wirkt nach dem Neuladen nicht, Schritt 3 geht weiter zu 4.
    expect(completeStep(reloaded.progress, u1.id, 2, clock.now)).toBe(reloaded.progress);
    expect(currentStep(completeStep(reloaded.progress, u1.id, 3, clock.now), u1.id)).toBe(4);
  });

  it("Abschlussrunde: Haltestelle abgeschlossen, 100 Punkte, nächste offen, Mission offen, Serie 1", () => {
    const clock = makeClock();
    const p = playUnit(freshProgress(clock), u1.id, clock);
    expect(stopState(p, u1.id)).toBe("done");
    expect(stopState(p, u2.id)).toBe("open");
    expect(missionState(p, u1.mission.id)).toBe("open");
    expect(missionState(p, u2.mission.id)).toBe("locked");
    // 16 richtige Antworten und 3 Satzbau-Aufgaben je 10, Dialog 20, Haltestelle 100
    expect(p.stats.points).toBe((u1.items.length + u1.build.length) * 10 + 20 + 100);
    expect(p.stats.streak).toBe(1);
    expect(p.stats.lastActiveDay).toBe("2026-11-23");
    // Karten in Fach 2, fällig morgen
    expect(Object.values(p.cards).every((c) => c.box === 2 && c.due === "2026-11-24")).toBe(true);
    expect(Object.keys(p.cards)).toHaveLength(u1.items.length);
    expect(completeStep(p, u1.id, 5, clock.now)).toBe(p);
  });

  it("falsche Antworten in der Abschlussrunde: Fach 1, morgen fällig, Haltestelle trotzdem abgeschlossen", () => {
    const clock = makeClock();
    const p = playUnit(freshProgress(clock), u1.id, clock, false);
    expect(stopState(p, u1.id)).toBe("done");
    expect(Object.values(p.cards).every((c) => c.box === 1 && c.due === "2026-11-24" && c.wrong === 1)).toBe(true);
  });

  it("Folgetag: Einheit startet mit Wiederholen und zeigt 16 Karten", () => {
    const clock = makeClock();
    let p = playUnit(freshProgress(clock), u1.id, clock);
    clock.advance(1);
    expect(dueCardIds(p, today(clock.now))).toHaveLength(16);
    p = startUnit(p, u2.id, clock.now);
    expect(currentStep(p, u2.id)).toBe(1);
    const round = buildReviewRound(p, today(clock.now), createRng(1), env);
    expect(round.total).toBe(16);
  });

  it("Inhalte der Schritte 2 und 3 liefern Blöcke und Lückensätze", () => {
    expect(buildNewCards(u1.id, createRng(1)).map((b) => b.items.length)).toEqual([4, 4, 4, 4]);
    expect(buildClozeRound(u1.id, createRng(1))).toHaveLength(u1.cloze.length);
  });
});

describe("Startseite", () => {
  it("Block „Heute“: Haltestelle offen, Wiederholungen fällig, nur Mission offen, alles erledigt", () => {
    const clock = makeClock();
    let p = freshProgress(clock);
    expect(todayPlan(p, "2026-11-23")).toMatchObject({ kind: "work", dueCount: 0, unitId: u1.id, unitState: "open", newCardCount: 16 });

    p = playUnit(p, u1.id, clock);
    // Am selben Tag: nichts fällig, Haltestelle des Tages erledigt, Mission offen
    expect(todayPlan(p, "2026-11-23")).toMatchObject({ kind: "missionOnly", openMissionId: u1.mission.id, nextUnitId: u2.id });

    p = completeMission(p, u1.mission.id, clock.now);
    expect(todayPlan(p, "2026-11-23")).toMatchObject({ kind: "allDone", openMissionId: null, nextUnitId: u2.id });

    // Am nächsten Tag: 16 fällig, Haltestelle 2 offen
    expect(todayPlan(p, "2026-11-24")).toMatchObject({ kind: "work", dueCount: 16, reviewCount: 16, unitId: u2.id, unitState: "open", newCardCount: 15 });
  });

  it("Tageszähler zählt ab dem Anlegen des Profils", () => {
    const clock = makeClock("2026-11-23");
    const p = freshProgress(clock);
    expect(dayCounter(p, "2026-11-23")).toBe(1);
    expect(dayCounter(p, "2026-11-25")).toBe(3);
  });

  it("freie Runde „10 Karten extra“ liefert 10 Karten, sobald es gelernte gibt", () => {
    const clock = makeClock();
    const empty = freshProgress(clock);
    expect(buildExtraRound(empty, "2026-11-23", createRng(1), env).total).toBe(0);
    const p = playUnit(empty, u1.id, clock);
    expect(buildExtraRound(p, "2026-11-23", createRng(1), env).total).toBe(10);
  });
});

/** Antwortet nach einer festen Regel je Aufgaben-id, damit zwei Läufe dieselben Antworten geben. */
const correctOf = (id: string): boolean => (id.charCodeAt(id.length - 1) + id.length) % 3 !== 0;

function answerWhile(progress: Progress, round: RoundState, now: () => Date, keepGoing: (r: RoundState) => boolean): { progress: Progress; round: RoundState } {
  let p = progress;
  let r = round;
  while (!isRoundDone(r) && keepGoing(r)) {
    const task = r.queue[0]!;
    ({ progress: p, round: r } = answerInRound(p, r, correctOf(task.id), now));
  }
  return { progress: p, round: r };
}

describe("Neuladen in der Abschlussrunde", () => {
  function atStep5(clock: ReturnType<typeof makeClock>): Progress {
    let p = startUnit(freshProgress(clock), u1.id, clock.now);
    for (const step of [2, 3, 4] as const) p = completeStep(p, u1.id, step, clock.now);
    return p;
  }

  it("halb beantworten, serialisieren, lesen, neu bauen: nur die beantworteten fehlen, am Ende gleiche Fächer und Punkte", () => {
    const clock = makeClock();
    const start = atStep5(clock);
    const full = buildFinalRound(start, u1.id, createRng(1), env);
    const half = Math.floor(full.total / 2);

    // Lauf ohne Neuladen
    const straight = answerWhile(start, full, clock.now, () => true).progress;

    // Lauf mit Neuladen nach der Hälfte
    const first = answerWhile(start, full, clock.now, (r) => r.completed < half);
    const answeredIds = first.progress.units[u1.id]?.answered ?? [];
    expect(answeredIds).toHaveLength(half);
    const parsed = parseProgress(serializeProgress(first.progress));
    expect(parsed.status).toBe("ok");
    if (parsed.status !== "ok") return;
    const rebuilt = buildFinalRound(parsed.progress, u1.id, createRng(99), env);
    const allIds = buildFinalRound(start, u1.id, createRng(1), env).queue.map((t) => t.id);
    expect(rebuilt.queue.map((t) => t.id).sort()).toEqual(allIds.filter((id) => !answeredIds.includes(id)).sort());
    expect(rebuilt.total).toBe(full.total - half);
    const reloaded = answerWhile(parsed.progress, rebuilt, clock.now, () => true).progress;

    expect(reloaded.cards).toEqual(straight.cards);
    expect(reloaded.stats.points).toBe(straight.stats.points);
    expect(reloaded.stats.streak).toBe(straight.stats.streak);
  });

  it("alles beantwortet und neu geladen: die Runde ist leer, mit dem Abschluss verschwindet das Feld", () => {
    const clock = makeClock();
    const start = atStep5(clock);
    let p = answerWhile(start, buildFinalRound(start, u1.id, createRng(1), env), clock.now, () => true).progress;
    expect(p.units[u1.id]?.answered).toHaveLength(u1.items.length + u1.build.length);
    expect(isRoundDone(buildFinalRound(p, u1.id, createRng(1), env))).toBe(true);
    p = completeStep(p, u1.id, 5, clock.now);
    expect(p.units[u1.id]).not.toHaveProperty("answered");
    expect(JSON.stringify(p)).not.toContain("answered");
  });
});

describe("Wiederholen einmal am Tag", () => {
  /** Haltestelle 1 fertig am ersten Tag, Haltestelle 2 bis Schritt 3 begonnen, dann über Nacht. */
  function overnight(): { p: Progress; clock: ReturnType<typeof makeClock> } {
    const clock = makeClock();
    let p = playUnit(freshProgress(clock), u1.id, clock);
    p = startUnit(p, u2.id, clock.now);
    p = completeStep(p, u2.id, 2, clock.now);
    expect(currentStep(p, u2.id)).toBe(3);
    clock.advance(1);
    return { p, clock };
  }

  it("reviewPending: fällig und heute noch nicht beendet", () => {
    const { p } = overnight();
    expect(reviewPending(freshProgress(makeClock()), "2026-11-24")).toBe(false);
    expect(reviewPending(p, "2026-11-23")).toBe(false);
    expect(reviewPending(p, "2026-11-24")).toBe(true);
    const done = finishReviewRound(p, "2026-11-24");
    expect(done.stats.lastReviewDay).toBe("2026-11-24");
    expect(reviewPending(done, "2026-11-24")).toBe(false);
    expect(finishReviewRound(done, "2026-11-24")).toBe(done);
    expect(reviewPending(done, "2026-11-25")).toBe(true);
  });

  it("ein Abbruch mitten in der Runde setzt lastReviewDay nicht", () => {
    const { p, clock } = overnight();
    const round = buildReviewRound(p, "2026-11-24", createRng(1), env);
    const part = answerWhile(p, round, clock.now, (r) => r.completed < 5);
    expect(part.progress.stats.lastReviewDay).toBeUndefined();
    expect(reviewPending(part.progress, "2026-11-24")).toBe(true);
  });

  it("Haltestelle über Nacht bei Schritt 3: erst die Wiederholrunde, dann Schritt 3", () => {
    const { p } = overnight();
    expect(sessionPlan(p, u2.id, "2026-11-24")).toEqual({ review: true, reviewCount: 16, unitId: u2.id, step: 3 });
    const after = finishReviewRound(p, "2026-11-24");
    expect(sessionPlan(after, u2.id, "2026-11-24")).toEqual({ review: false, reviewCount: 0, unitId: u2.id, step: 3 });
  });

  it("gespeicherter Schritt 1 gilt als erledigt, sobald nichts mehr aussteht", () => {
    const { p } = overnight();
    const atOne = startUnit({ ...p, units: { ...p.units, [u2.id]: { step: 1, startedAt: "x" } } }, u2.id, () => new Date(2026, 10, 24, 12));
    expect(sessionPlan(atOne, u2.id, "2026-11-24")).toMatchObject({ review: true, step: 2 });
    const after = finishReviewRound(atOne, "2026-11-24");
    expect(sessionPlan(after, u2.id, "2026-11-24")).toMatchObject({ review: false, step: 2 });
    expect(currentStep(startUnit(after, u2.id, () => new Date(2026, 10, 24, 12)), u2.id)).toBe(2);
  });

  it("ohne offene Haltestelle: Sitzung nur zum Wiederholen", () => {
    const { p } = overnight();
    expect(sessionPlan(p, null, "2026-11-24")).toEqual({ review: true, reviewCount: 16, unitId: null, step: null });
    // gesperrte und abgeschlossene Haltestelle zählen nicht als offen
    expect(sessionPlan(p, units[3]!.id, "2026-11-24")).toMatchObject({ unitId: null, step: null });
    expect(sessionPlan(p, u1.id, "2026-11-24")).toMatchObject({ unitId: null, step: null });
  });

  it("todayPlan: Haltestelle läuft schon, Wiederholen fällig / nichts fällig", () => {
    const { p } = overnight();
    expect(todayPlan(p, "2026-11-24")).toMatchObject({
      kind: "work",
      reviewPending: true,
      reviewCount: 16,
      dueCount: 16,
      unitId: u2.id,
      unitState: "running",
      unitStep: 3,
    });
    expect(todayPlan(p, "2026-11-23")).toMatchObject({ kind: "work", reviewPending: false, reviewCount: 0, unitState: "running", unitStep: 3 });
  });

  it("todayPlan: nur Wiederholen, alle Haltestellen geschafft, nach der Endstation höchstens 20 Karten (vorher 40); nach der Runde nichts mehr", () => {
    const clock = makeClock();
    const base = freshProgress(clock);
    const doneUnits = Object.fromEntries(units.map((u) => [u.id, { step: 6 as const, startedAt: "x", completedAt: "2026-11-20T10:00:00.000Z" }]));
    const cards = Object.fromEntries(allItems.slice(0, 55).map((item) => [item.id, { box: 2 as const, due: "2026-11-22", right: 1, wrong: 0, lastSeen: "2026-11-21" }]));
    const missions = Object.fromEntries(units.map((u) => [u.mission.id, { state: "done" as const, at: "2026-11-20T10:00:00.000Z" }]));
    const finished: Progress = { ...base, units: doneUnits, cards, missions, finalReview: { at: "2026-11-20T10:00:00.000Z", right: 1, total: 1 } };
    expect(todayPlan(finished, "2026-11-23")).toMatchObject({
      kind: "work",
      reviewPending: true,
      reviewCount: REVIEW_ROUND_AFTER_FINAL,
      dueCount: 55,
      unitId: null,
      unitState: null,
      nextUnitId: null,
    });
    // Ohne Ergebnis der Endstation bleibt es bei 40.
    const { finalReview: _result, ...beforeFinal } = finished;
    expect(todayPlan(beforeFinal, "2026-11-23").reviewCount).toBe(REVIEW_ROUND.maxCards);
    const after = todayPlan(finishReviewRound(finished, "2026-11-23"), "2026-11-23");
    expect(after).toMatchObject({ kind: "allDone", reviewPending: false, reviewCount: 0, dueCount: 55 });
  });
});

describe("Freie Runde ist Übung", () => {
  it("ändert kein Fach, gibt keine Punkte, setzt lastSeen und zählt für die Serie; Fälliges bleibt fällig", () => {
    const clock = makeClock();
    const base = playUnit(freshProgress(clock), u1.id, clock);
    clock.advance(1);
    const day = today(clock.now);
    const dueBefore = dueCardIds(base, day);
    expect(dueBefore).toHaveLength(16);

    const round = buildExtraRound(base, day, createRng(1), env);
    expect(round.total).toBe(10);
    const { progress: p } = answerWhile(base, round, clock.now, () => true);

    for (const [id, card] of Object.entries(p.cards)) {
      const before = base.cards[id]!;
      expect({ ...card, lastSeen: before.lastSeen }).toEqual(before);
    }
    expect(p.stats.points).toBe(base.stats.points);
    expect(dueCardIds(p, day)).toEqual(dueBefore);
    expect(reviewedCardsOn(p, day)).toBe(10);
    expect(p.stats.lastActiveDay).toBe(day);
    expect(p.stats.streak).toBe(2);
    expect(p.stats.lastReviewDay).toBeUndefined();
  });
});

describe("Missionen", () => {
  it("Zustände: gesperrt, offen, übersprungen, erledigt", () => {
    const clock = makeClock();
    expect(missionStates(freshProgress(clock)).every((m) => m.state === "locked")).toBe(true);
    let p = playUnit(freshProgress(clock), u1.id, clock);
    expect(openMissionIds(p)).toEqual([u1.mission.id]);
    p = skipMission(p, u1.mission.id, clock.now);
    expect(missionState(p, u1.mission.id)).toBe("skipped");
    expect(openMissionIds(p)).toEqual([]);
    expect(skipMission(p, u2.mission.id, clock.now)).toBe(p); // gesperrt
  });

  it("erledigen vergibt 50 Punkte genau einmal, auch nach Überspringen", () => {
    const clock = makeClock();
    const base = playUnit(freshProgress(clock), u1.id, clock);
    const points = base.stats.points;

    let p = completeMission(base, u1.mission.id, clock.now, { feeling: "leicht", note: " lief gut " });
    expect(p.stats.points).toBe(points + POINTS.missionDone);
    expect(p.missions[u1.mission.id]).toMatchObject({ state: "done", feeling: "leicht", note: "lief gut" });
    expect(completeMission(p, u1.mission.id, clock.now)).toBe(p);

    p = skipMission(base, u1.mission.id, clock.now);
    expect(p.stats.points).toBe(points);
    p = completeMission(p, u1.mission.id, clock.now);
    expect(p.stats.points).toBe(points + POINTS.missionDone);
    expect(missionState(p, u1.mission.id)).toBe("done");
    expect(completeMission(p, u1.mission.id, clock.now).stats.points).toBe(points + POINTS.missionDone);
  });

  it("gesperrte Missionen lassen sich nicht erledigen", () => {
    const clock = makeClock();
    const p = freshProgress(clock);
    expect(completeMission(p, u2.mission.id, clock.now)).toBe(p);
  });
});

describe("Endstation", () => {
  it("öffnet nach Haltestelle 10 und wird mit dem Ergebnis abgeschlossen", () => {
    const clock = makeClock();
    let p = freshProgress(clock);
    for (const unit of units) {
      p = playUnit(p, unit.id, clock);
      clock.advance(1);
    }
    expect(finalStationState(p)).toBe("open");
    const round = buildFinalStationRound(p, createRng(1), env);
    expect(round.total).toBe(30);
    p = finishFinalReview(p, 25, 30, clock.now);
    expect(finalStationState(p)).toBe("done");
    expect(p.finalReview).toMatchObject({ right: 25, total: 30 });
  });

  function atStation() {
    const clock = makeClock();
    let p = freshProgress(clock);
    for (const unit of units) {
      p = playUnit(p, unit.id, clock);
      clock.advance(1);
    }
    return { clock, p };
  }

  it("startFinalStation wählt die 30 Karten einmal und merkt sie; ein zweiter Aufruf ändert nichts", () => {
    const { p } = atStation();
    const started = startFinalStation(p, createRng(1));
    expect(started.finalRun).toMatchObject({ answered: [], right: 0 });
    expect(started.finalRun?.ids).toHaveLength(30);
    expect(startFinalStation(started, createRng(2))).toBe(started);
    expect(finalStationTaskCount(p)).toBe(30);
    expect(finalStationTaskCount(started)).toBe(30);
  });

  it("die Runde der Endstation trägt jede erste Antwort in finalRun ein; eine Wiedervorlage zählt nicht", () => {
    const { clock, p } = atStation();
    let progress = startFinalStation(p, createRng(1));
    let round = buildFinalStationRound(progress, createRng(2), env);
    expect(round.finalStation).toBe(true);
    ({ progress, round } = answerInRound(progress, round, false, clock.now));
    ({ progress, round } = answerInRound(progress, round, true, clock.now));
    expect(progress.finalRun?.answered).toHaveLength(2);
    expect(progress.finalRun?.right).toBe(1);
    // Neu aufgebaut: die zwei beantworteten fehlen, `total` zählt nur den Rest.
    const again = buildFinalStationRound(progress, createRng(3), env);
    expect(again.total).toBe(28);
    expect(again.queue.map((task) => task.itemId)).not.toContain(progress.finalRun!.answered[0]);
  });

  it("finishFinalReview speichert das Ergebnis und entfernt finalRun; die Endstation gilt als geschafft", () => {
    const { clock, p } = atStation();
    const started = startFinalStation(p, createRng(1));
    const done = finishFinalReview(started, 20, 30, clock.now);
    expect(done.finalRun).toBeUndefined();
    expect(done.finalReview).toMatchObject({ right: 20, total: 30 });
    expect(startFinalStation(done, createRng(1))).toBe(done);
    expect(todayPlan(done, "2030-01-01").finalResult).toEqual({ right: 20, total: 30 });
    expect(todayPlan(done, "2030-01-01").finalStationOpen).toBe(false);
    expect(todayPlan(p, "2030-01-01")).toMatchObject({ finalStationOpen: true, kind: "work", finalResult: null });
  });

  it("validateProgress prüft finalRun: Typen, `right` höchstens so groß wie `answered`", () => {
    const { p } = atStation();
    const started = startFinalStation(p, createRng(1));
    expect(parseProgress(serializeProgress(started)).status).toBe("ok");
    const bad = (finalRun: unknown) => parseProgress(JSON.stringify({ ...started, finalRun })).status;
    expect(bad({ ids: ["a"], answered: [], right: 0 })).toBe("ok");
    expect(bad({ ids: ["a"], answered: ["a"], right: 2 })).toBe("error");
    expect(bad({ ids: "a", answered: [], right: 0 })).toBe("error");
    expect(bad({ ids: [1], answered: [], right: 0 })).toBe("error");
    expect(bad({ ids: [], answered: [3], right: 0 })).toBe("error");
    expect(bad({ ids: [], answered: [], right: -1 })).toBe("error");
    expect(bad("x")).toBe("error");
  });
});

describe("Serie und Lernzeit", () => {
  it("Serie wächst an aufeinanderfolgenden Tagen und beginnt nach einer Lücke neu", () => {
    let p = freshProgress(makeClock());
    p = markStreakDay(p, "2026-11-23");
    p = markStreakDay(p, "2026-11-23");
    expect(p.stats.streak).toBe(1);
    p = markStreakDay(p, "2026-11-24");
    p = markStreakDay(p, "2026-11-25");
    expect(p.stats.streak).toBe(3);
    expect(currentStreak(p, "2026-11-26")).toBe(3);
    expect(currentStreak(p, "2026-11-27")).toBe(0);
    p = markStreakDay(p, "2026-11-28");
    expect(p.stats.streak).toBe(1);
  });

  it("10 wiederholte Karten an einem Tag zählen für die Serie, 9 nicht", () => {
    const clock = makeClock();
    const base = playUnit(freshProgress(clock), u1.id, clock);
    clock.advance(1);
    const day = today(clock.now);
    const full = buildReviewRound(base, day, createRng(1), env);
    let p = base;
    let r = full;
    for (let i = 0; i < 9; i++) ({ progress: p, round: r } = answerInRound(p, r, true, clock.now));
    expect(p.stats.lastActiveDay).toBe("2026-11-23");
    ({ progress: p, round: r } = answerInRound(p, r, true, clock.now));
    expect(p.stats.lastActiveDay).toBe("2026-11-24");
    expect(p.stats.streak).toBe(2);
  });

  it("Lernzeit: Abstand zwischen Eingaben zählt höchstens 60 Sekunden, ohne vorige Eingabe nichts", () => {
    let p = freshProgress(makeClock());
    p = recordActivity(p, null, 1_000, "2026-11-23");
    expect(p.stats.activeMsByDay).toEqual({});
    p = recordActivity(p, 1_000, 31_000, "2026-11-23");
    expect(p.stats.activeMsByDay["2026-11-23"]).toBe(30_000);
    p = recordActivity(p, 31_000, 31_000 + 5 * 60_000, "2026-11-23");
    expect(p.stats.activeMsByDay["2026-11-23"]).toBe(90_000);
  });
});
