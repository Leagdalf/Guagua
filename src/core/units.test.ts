import { describe, expect, it } from "vitest";
import { dueCardIds } from "./cards";
import { POINTS } from "./config";
import { units } from "./content";
import { buildClozeRound, buildExtraRound, buildFinalRound, buildFinalStationRound, buildNewCards, buildReviewRound, finishFinalReview } from "./flow";
import { parseProgress, serializeProgress } from "./progress";
import { createRng } from "./random";
import { answerInRound, isRoundDone } from "./round";
import type { RoundState } from "./round";
import { currentStreak, markStreakDay, recordActivity } from "./stats";
import { freshProgress, makeClock } from "./testkit";
import { today } from "./time";
import {
  completeMission,
  completeStep,
  currentStep,
  dayCounter,
  finalStationState,
  missionState,
  missionStates,
  openMissionIds,
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
  p = drain(p, buildFinalRound(unitId, createRng(1), env), clock.now, correct);
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
    p = completeStep(completeStep(p, u1.id, 2, clock.now), u1.id, 3, clock.now);
    p = completeStep(p, u1.id, 3, clock.now); // schon weiter, zweiter Aufruf wirkt nicht
    const reloaded = parseProgress(serializeProgress(p));
    expect(reloaded.status).toBe("ok");
    if (reloaded.status === "ok") expect(currentStep(reloaded.progress, u1.id)).toBe(4);
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
