// Haltestellen, Schritte der Lerneinheit, Missionen und die Abfragen für die Startseite
// (docs/02-spezifikation.md, 2.2, 2.3, 2.5, 2.8 und 5.3). Alles unveränderlich: Funktionen geben neue Progress-Objekte zurück.

import { dueCardIds, newCard } from "./cards";
import { POINTS, REVIEW_ROUND } from "./config";
import { getUnit, units } from "./content";
import { addPoints, markStreakDay } from "./stats";
import { dayOfIso, daysBetween, today } from "./time";
import type { Clock } from "./time";
import type { Day, MissionFeeling, Progress, Step } from "./types";

// ---------- Haltestellen ----------

/** Zustände der Linie: gesperrt, offen (noch nicht begonnen), läuft (begonnen), abgeschlossen. */
export type StopState = "locked" | "open" | "running" | "done";

/** Abgeschlossen heißt: Abschlussrunde (Schritt 5) beendet. Schritt 6 zeigt nur noch Mission und Zusammenfassung. */
export function isUnitDone(progress: Progress, unitId: string): boolean {
  return progress.units[unitId]?.completedAt !== undefined;
}

export function stopState(progress: Progress, unitId: string): StopState {
  const index = units.findIndex((unit) => unit.id === unitId);
  if (index < 0) return "locked";
  if (isUnitDone(progress, unitId)) return "done";
  if (index > 0 && !isUnitDone(progress, units[index - 1]?.id ?? "")) return "locked";
  return progress.units[unitId] ? "running" : "open";
}

export interface StopInfo {
  unitId: string;
  /** Nummer der Haltestelle, 1 bis 10. */
  stop: number;
  state: StopState;
  /** Nächster offener Schritt, solange die Haltestelle läuft. */
  step: Step | null;
}

/** Die zehn Haltestellen der Linie in Kursreihenfolge. */
export function stopStates(progress: Progress): StopInfo[] {
  return units.map((unit) => {
    const state = stopState(progress, unit.id);
    return { unitId: unit.id, stop: unit.stop, state, step: state === "running" ? (progress.units[unit.id]?.step ?? null) : null };
  });
}

/** Endstation: gesperrt bis Haltestelle 10 abgeschlossen ist, danach offen, nach der Runde („finalReview“) abgeschlossen. */
export function finalStationState(progress: Progress): "locked" | "open" | "done" {
  if (progress.finalReview) return "done";
  const last = units[units.length - 1];
  return last && isUnitDone(progress, last.id) ? "open" : "locked";
}

/**
 * Beginnt eine Haltestelle (oder setzt sie fort). Gesperrte oder abgeschlossene Haltestellen bleiben unverändert.
 * Schritt 1 entfällt, wenn nichts fällig ist: dann beginnt die Einheit bei Schritt 2.
 */
export function startUnit(progress: Progress, unitId: string, now: Clock): Progress {
  const state = stopState(progress, unitId);
  if (state === "locked" || state === "done") return progress;
  const hasDue = dueCardIds(progress, today(now)).length > 0;
  const existing = progress.units[unitId];
  if (!existing) {
    return { ...progress, units: { ...progress.units, [unitId]: { step: hasDue ? 1 : 2, startedAt: now().toISOString() } } };
  }
  if (existing.step === 1 && !hasDue) {
    return { ...progress, units: { ...progress.units, [unitId]: { ...existing, step: 2 } } };
  }
  return progress;
}

/** Nächster offener Schritt einer begonnenen Haltestelle, sonst `null`. */
export function currentStep(progress: Progress, unitId: string): Step | null {
  const unit = progress.units[unitId];
  return unit && !unit.completedAt ? unit.step : null;
}

/**
 * Schließt einen Schritt ab und speichert den nächsten. Wirkt nur, wenn `step` der offene Schritt der Haltestelle ist,
 * sonst bleibt alles unverändert (kein doppeltes Vergeben von Punkten).
 * 1 Wiederholen: weiter zu 2. Die Fächer änderten schon die einzelnen Antworten.
 * 2 Neue Karten: legt die Karten der Einheit in Fach 1 an, heute fällig.
 * 3 Grammatik: weiter zu 4. Lücken ändern keine Fächer.
 * 4 Dialog: 20 Punkte, weiter zu 5.
 * 5 Abschlussrunde: Haltestelle abgeschlossen, 100 Punkte, Serie, Mission offen, nächste Haltestelle offen.
 * 6 Mission und Zusammenfassung: nichts zu speichern.
 */
export function completeStep(progress: Progress, unitId: string, step: Step, now: Clock): Progress {
  const entry = progress.units[unitId];
  const unit = getUnit(unitId);
  if (!entry || !unit || entry.completedAt || entry.step !== step) return progress;

  const day = today(now);
  switch (step) {
    case 1:
    case 3:
      return withStep(progress, unitId, (step + 1) as Step);
    case 2: {
      const cards = { ...progress.cards };
      for (const item of unit.items) if (!cards[item.id]) cards[item.id] = newCard(day);
      return withStep({ ...progress, cards }, unitId, 3);
    }
    case 4:
      return withStep(addPoints(progress, POINTS.dialogueDone), unitId, 5);
    case 5: {
      const done: Progress = {
        ...progress,
        units: { ...progress.units, [unitId]: { ...entry, step: 6, completedAt: now().toISOString() } },
      };
      return markStreakDay(addPoints(done, POINTS.unitDone), day);
    }
    default:
      return progress;
  }
}

function withStep(progress: Progress, unitId: string, step: Step): Progress {
  const entry = progress.units[unitId];
  if (!entry) return progress;
  return { ...progress, units: { ...progress.units, [unitId]: { ...entry, step } } };
}

// ---------- Missionen ----------

export type MissionState = "locked" | "open" | "done" | "skipped";

export interface MissionInfo {
  missionId: string;
  unitId: string;
  stop: number;
  state: MissionState;
}

/** Eine Mission wird mit dem Abschluss ihrer Haltestelle offen. */
export function missionState(progress: Progress, missionId: string): MissionState {
  const unit = units.find((entry) => entry.mission.id === missionId);
  if (!unit) return "locked";
  const saved = progress.missions[missionId];
  if (saved) return saved.state;
  return isUnitDone(progress, unit.id) ? "open" : "locked";
}

/** Alle zehn Missionen mit Zustand. */
export function missionStates(progress: Progress): MissionInfo[] {
  return units.map((unit) => ({
    missionId: unit.mission.id,
    unitId: unit.id,
    stop: unit.stop,
    state: missionState(progress, unit.mission.id),
  }));
}

/** Offene Missionen, die der Haltestelle nach neueste zuerst. */
export function openMissionIds(progress: Progress): string[] {
  return missionStates(progress)
    .filter((mission) => mission.state === "open")
    .reverse()
    .map((mission) => mission.missionId);
}

export interface MissionResult {
  feeling?: MissionFeeling;
  note?: string;
}

/**
 * Mission erledigen: 50 Punkte genau einmal, auch wenn sie vorher übersprungen war.
 * Gesperrte und schon erledigte Missionen bleiben unverändert.
 */
export function completeMission(progress: Progress, missionId: string, now: Clock, result: MissionResult = {}): Progress {
  const state = missionState(progress, missionId);
  if (state !== "open" && state !== "skipped") return progress;
  const note = result.note?.trim();
  const entry = {
    state: "done" as const,
    at: now().toISOString(),
    ...(result.feeling ? { feeling: result.feeling } : {}),
    ...(note ? { note } : {}),
  };
  return addPoints({ ...progress, missions: { ...progress.missions, [missionId]: entry } }, POINTS.missionDone);
}

/** Mission überspringen. Nur offene Missionen. Später lässt sie sich noch erledigen. */
export function skipMission(progress: Progress, missionId: string, now: Clock): Progress {
  if (missionState(progress, missionId) !== "open") return progress;
  return { ...progress, missions: { ...progress.missions, [missionId]: { state: "skipped", at: now().toISOString() } } };
}

// ---------- Startseite ----------

/** Wie viele Karten heute fällig sind (alle, auch über der Grenze der Runde). */
export function dueCount(progress: Progress, day: Day): number {
  return dueCardIds(progress, day).length;
}

/** Tageszähler im Kopf: Tage seit dem Anlegen des Profils, der erste Tag ist 1. */
export function dayCounter(progress: Progress, day: Day): number {
  const created = dayOfIso(progress.profile.createdAt);
  return created === null ? 1 : Math.max(1, daysBetween(created, day) + 1);
}

/**
 * Der Block „Heute“.
 * work: Wiederholungen fällig und/oder eine Haltestelle offen oder laufend. `unitId` ist die Haltestelle (oder `null`).
 * missionOnly: nichts fällig, die Haltestelle des Tages ist erledigt, aber eine Mission ist offen.
 * allDone: alles erledigt. `nextUnitId` für „Morgen: Haltestelle n“, `finalStationOpen` wenn die Endstation wartet.
 * Hat heute schon eine Haltestelle abgeschlossen, bietet der Block keine weitere an. Über die Linie lässt sie sich trotzdem öffnen.
 */
export interface TodayPlan {
  kind: "work" | "missionOnly" | "allDone";
  /** Alle fälligen Karten. */
  dueCount: number;
  /** Karten der heutigen Runde, höchstens 40. */
  reviewCount: number;
  unitId: string | null;
  unitState: "open" | "running" | null;
  /** Nächster Schritt der laufenden Haltestelle. */
  unitStep: Step | null;
  /** Zahl der neuen Karten der angebotenen Haltestelle. */
  newCardCount: number;
  /** Offene Mission, die der Haltestelle nach neueste. */
  openMissionId: string | null;
  /** Nächste noch nicht abgeschlossene, entsperrte Haltestelle. */
  nextUnitId: string | null;
  finalStationOpen: boolean;
}

export function todayPlan(progress: Progress, day: Day): TodayPlan {
  const due = dueCount(progress, day);
  const states = stopStates(progress);
  const candidate = states.find((s) => s.state === "running") ?? states.find((s) => s.state === "open") ?? null;
  const doneToday = units.some((unit) => {
    const at = progress.units[unit.id]?.completedAt;
    return at !== undefined && dayOfIso(at) === day;
  });
  const offered = candidate && (candidate.state === "running" || !doneToday) ? candidate : null;
  const openMissionId = openMissionIds(progress)[0] ?? null;

  const kind: TodayPlan["kind"] = due > 0 || offered ? "work" : openMissionId ? "missionOnly" : "allDone";
  return {
    kind,
    dueCount: due,
    reviewCount: Math.min(due, REVIEW_ROUND.maxCards),
    unitId: offered ? offered.unitId : null,
    unitState: offered ? (offered.state as "open" | "running") : null,
    unitStep: offered ? offered.step : null,
    newCardCount: offered ? (getUnit(offered.unitId)?.items.length ?? 0) : 0,
    openMissionId,
    nextUnitId: candidate ? candidate.unitId : null,
    finalStationOpen: finalStationState(progress) === "open",
  };
}
