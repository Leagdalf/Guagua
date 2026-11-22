// Ablauf der Lerneinheit als reine Zustandsmaschine (docs/02-spezifikation.md, 2.3 und 2.4).
// Kein React, kein Browser-Speicher, keine echte Uhr: Uhr, Zufall und Stimme kommen aus `SessionContext`.
//
//   createSession(progress, request, ctx)       baut die Sitzung (den Fahrplan der Einheit), auch nach einem Neuladen
//   reduce(state, event, progress, ctx)         Ereignis ergibt neuen Zustand, neuen Fortschritt und optional den Ton
//
// Jede Sitzung beginnt mit dem Fahrplan (Bildschirm `plan`). Erst das Ereignis `begin`, das Tippen auf den Hauptknopf,
// baut die erste Runde. Dann steht fest, ob es eine spanische Stimme gibt, und der erste Text wird im selben Tippen gesprochen.
//
// Der Ton (`speak`) wird nicht hier gesprochen: Die Maschine liefert den Text mit dem Zustandswechsel, die Ansicht
// spricht ihn in derselben Klick-Behandlung (iOS spielt nur direkt aus einem Tippen).
//
// Jedes Ergebnis trägt den Fortschritt (`progress`). Wer die Maschine aufruft, muss ihn speichern (`sessionDriver.ts`).

import { extraRoundIds, isRoundTimeUp } from "../../core/cards";
import { EXTRA_ROUND_CARDS } from "../../core/config";
import { getUnit } from "../../core/content";
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
} from "../../core/flow";
import { answerInRound, currentTask, isRepeat, isRoundDone } from "../../core/round";
import type { RoundState } from "../../core/round";
import { currentStreak, recordActivity } from "../../core/stats";
import { evaluateBuild, evaluateChoice, evaluateWrite, isPairMatch, speakTextOf } from "../../core/tasks";
import type { ChoiceTask, Feedback, PairsTask, RoundTask, TaskEnv } from "../../core/tasks";
import { today } from "../../core/time";
import type { Clock } from "../../core/time";
import type { Rng } from "../../core/random";
import type { Day, Item, Progress, Step } from "../../core/types";
import { completeStep, finalStationState, finishReviewRound, sessionPlan, startUnit, stopState, stopStates } from "../../core/units";
import type { StopState } from "../../core/units";
import type { SessionRequest } from "./types";

// ---------- Typen ----------

export interface SessionContext {
  now: Clock;
  rng: Rng;
  /** Gibt es eine spanische Stimme? Ohne wird aus „Hören“ „Erkennen“. */
  hasSpanishVoice: boolean;
}

/** Text, der im selben Tippen gesprochen werden soll. */
export interface SpeakRequest {
  text: string;
  slow?: boolean;
}

export type TaskRole = "review" | "extra" | "final" | "cloze" | "station";

export interface PairsRun {
  /** Gewählte Zeile, wartet auf die Gegenseite. */
  selected: { side: "left" | "right"; id: string } | null;
  /** Gefundene Paare (Karten-ids). */
  found: readonly string[];
  /** Falsches Paar, beide Zeilen zeigen das Kreuz bis zum nächsten Tippen. */
  wrong: { left: string; right: string } | null;
}

/** Eine Zeile im Fahrplan der Einheit. */
export interface PlanRow {
  /** Nummer des Schritts, `null` in der freien Runde. */
  step: Step | null;
  name: string;
  /** Kurze Angabe rechts: „16 Karten“, das Grammatikthema, der Ort des Dialogs. */
  detail: string;
  done: boolean;
}

/** Erster Bildschirm jeder Sitzung: Übersicht der heutigen Schritte (docs/04-design.md, „Fahrplan der Einheit“). */
export interface PlanScreen {
  kind: "plan";
  /** „Heute · Haltestelle 2“ oder „Heute“. */
  label: string;
  /** Name der Haltestelle (Spanisch, mit Marker) oder deutsche große Zeile. */
  title: { text: string; spanish: boolean };
  rows: readonly PlanRow[];
  /** „Beginnen“ oder „Weiter bei Schritt 3“. */
  button: string;
}

export interface CardsScreen {
  kind: "cards";
  blocks: readonly { items: Item[]; pairs: PairsTask }[];
  block: number;
  /** look: Karte `card` ansehen und anhören. pairs: die vier Karten des Blocks zuordnen. */
  stage: "look" | "pairs";
  card: number;
  pairs: PairsRun;
}

export interface GrammarScreen {
  kind: "grammar";
}

export interface TaskScreen {
  kind: "task";
  role: TaskRole;
  /** Zählt bei jeder neuen Aufgabe hoch, damit die Ansicht sie neu aufbaut. */
  seq: number;
  /** Wiedervorlage einer falsch beantworteten Karte. */
  repeat: boolean;
  task: RoundTask;
  /** Runde mit Wiedervorlage (alle Rollen außer Lücke). Nach der Antwort steht die Aufgabe schon weitergeschoben. */
  round: RoundState | null;
  /** Lückensätze (Rolle cloze). */
  cloze: { tasks: readonly ChoiceTask[]; index: number } | null;
  /** Aktive Zeit der Sitzung (`SessionState.activeMs`) beim Beginn der Runde, für die Grenze von 6 Minuten. */
  startedActiveMs: number;
  /** Aufgaben der Abschlussrunde, die schon vor einem Neuladen beantwortet waren. Der Zähler zählt sie mit. */
  offset: number;
  /** Satzbau: Indizes in `task.tokens` in der Reihenfolge des Satzes. */
  placed: readonly number[];
  /** Auswahl: gewählte Antwort. */
  chosen: number | null;
  answer: Feedback | null;
}

/**
 * Schritt 4 in zwei Teilen: erst „Anhören“ (`listen`), dann das Rollenspiel (`role`).
 * Das Rollenspiel ändert weder Karten noch Punkte. Die 20 Punkte kommen einmal mit dem Abschluss des Schritts (`completeStep`).
 */
export interface DialogueScreen {
  kind: "dialogue";
  phase: "listen" | "role";
  /** Zahl der sichtbaren Zeilen. Im Rollenspiel ist die letzte sichtbare Zeile die, die gerade dran ist. */
  shown: number;
  /** Zeilen, deren Übersetzung aufgedeckt ist. */
  revealed: readonly number[];
  /** Rollenspiel: Die Lösung der eigenen Zeile, die gerade dran ist, ist aufgedeckt. */
  uncovered: boolean;
  /** Rollenspiel: Zeilen, bei denen „Noch mal“ schon gewählt wurde (höchstens einmal je Zeile). */
  again: readonly number[];
  /** Rollenspiel: Zeilen, die mit „Saß“ bestätigt sind. */
  sat: readonly number[];
}

/** Endstation geschafft: die Ansicht „Deine Linie“ (Karten je Fach, Missionen, aktive Tage, Lernzeit, Ergebnis, Berg). */
export interface LineScreen {
  kind: "line";
}

export interface MissionScreen {
  kind: "mission";
}

export type SummaryKind = "unit" | "review" | "extra";

export interface SummaryScreen {
  kind: "summary";
  summary: SummaryKind;
}

export type Screen = PlanScreen | CardsScreen | GrammarScreen | TaskScreen | DialogueScreen | MissionScreen | SummaryScreen | LineScreen;

export interface SessionTally {
  /** Wiederholte Karten (Wiederholen und freie Runde). */
  reviewed: number;
  /** Erste Antworten in Wiederholen und Abschlussrunde: richtig und alle. */
  right: number;
  answered: number;
  /** Punkte beim Start, für „Punkte in dieser Einheit“. */
  startPoints: number;
}

export interface SessionState {
  request: SessionRequest;
  /** Haltestelle, an der die Sitzung arbeitet. `null`: nur Wiederholen oder freie Runde. */
  unitId: string | null;
  screen: Screen;
  /** Zeitpunkt der letzten Eingabe für die Lernzeit, `null` nach dem Wechsel in den Hintergrund. */
  lastInputMs: number | null;
  /** Aktive Zeit dieser Sitzung in Millisekunden (Abschnitt 5.4): Abstände über 60 Sekunden und Hintergrund zählen nicht. */
  activeMs: number;
  tally: SessionTally;
}

export type SessionEvent =
  /** Hauptknopf des Fahrplans: baut die erste Runde und spricht ihren ersten Text. */
  | { type: "begin" }
  /** „Weiter“ */
  | { type: "next" }
  | { type: "choose"; index: number }
  /** Satzbau: Baustein (Index in `task.tokens`) setzen oder zurücknehmen, dann prüfen. */
  | { type: "place"; index: number }
  | { type: "unplace"; index: number }
  | { type: "check" }
  /** Schreiben: getippte Antwort prüfen (Knopf „Prüfen“ oder Eingabetaste). */
  | { type: "submitText"; text: string }
  | { type: "pair"; side: "left" | "right"; id: string }
  /** Übersetzung einer Dialogzeile aufdecken. */
  | { type: "reveal"; line: number }
  /** Rollenspiel: „Aufdecken“, die Lösung der eigenen Zeile erscheint und wird gesprochen. */
  | { type: "uncover" }
  /** Rollenspiel: „Saß“, weiter zur nächsten Zeile. */
  | { type: "sat" }
  /** Rollenspiel: „Noch mal“, die Zeile wird wieder verdeckt (höchstens einmal je Zeile). */
  | { type: "again" }
  /** App im Hintergrund: die Lernzeit pausiert. */
  | { type: "background" };

export interface SessionResult {
  state: SessionState;
  progress: Progress;
  speak: SpeakRequest | null;
}

// ---------- Hilfen ----------

const nowMs = (ctx: SessionContext): number => ctx.now().getTime();

function envOf(ctx: SessionContext): TaskEnv {
  return { hasSpanishVoice: ctx.hasSpanishVoice };
}

function unitOf(state: SessionState) {
  return state.unitId === null ? undefined : getUnit(state.unitId);
}

/** Ton für eine Aufgabe, die beim Wechsel erscheint: nur „Hören“ beginnt mit Ton. */
function speakForTask(task: RoundTask): SpeakRequest | null {
  return task.kind === "choice" && task.type === "listen" ? { text: task.speak } : null;
}

function summaryScreen(summary: SummaryKind): SummaryScreen {
  return { kind: "summary", summary };
}

function listenScreen(): DialogueScreen {
  return { kind: "dialogue", phase: "listen", shown: 0, revealed: [], uncovered: false, again: [], sat: [] };
}

function emptyPairs(): PairsRun {
  return { selected: null, found: [], wrong: null };
}

/** Aufgaben der ganzen Abschlussrunde einer Haltestelle: jede Karte einmal, dazu der Satzbau. */
function finalTaskCount(unitId: string): number {
  const unit = getUnit(unitId);
  return unit ? unit.items.length + unit.build.length : 0;
}

function taskScreenOf(role: TaskRole, round: RoundState, state: SessionState, previous?: TaskScreen, stationOffset = 0): TaskScreen {
  const task = currentTask(round);
  if (!task) throw new Error("Runde ohne Aufgabe");
  const offset =
    previous?.offset ??
    (role === "station"
      ? stationOffset
      : role === "final" && state.unitId !== null
        ? Math.max(finalTaskCount(state.unitId) - round.total, 0)
        : 0);
  return {
    kind: "task",
    role,
    seq: (previous?.seq ?? -1) + 1,
    repeat: isRepeat(round),
    task,
    round,
    cloze: null,
    startedActiveMs: previous?.startedActiveMs ?? state.activeMs,
    offset,
    placed: [],
    chosen: null,
    answer: null,
  };
}

function clozeScreenOf(tasks: readonly ChoiceTask[], index: number, state: SessionState, previous?: TaskScreen): TaskScreen {
  const task = tasks[index];
  if (!task) throw new Error("Lückensatz fehlt");
  return {
    kind: "task",
    role: "cloze",
    seq: (previous?.seq ?? -1) + 1,
    repeat: false,
    task,
    round: null,
    cloze: { tasks, index },
    startedActiveMs: previous?.startedActiveMs ?? state.activeMs,
    offset: 0,
    placed: [],
    chosen: null,
    answer: null,
  };
}

/** Der Zustand nach „Hintergrund“: Die Lernzeit zählt bis zur nächsten Eingabe nichts. */
export function withBackground(state: SessionState): SessionState {
  return state.lastInputMs === null ? state : { ...state, lastInputMs: null };
}

// ---------- Fahrplan ----------

const STEP_NAMES: Record<Step, string> = {
  1: "Wiederholen",
  2: "Neue Karten",
  3: "Grammatik",
  4: "Dialog",
  5: "Abschlussrunde",
  6: "Mission",
};

function cards(count: number): string {
  return count === 0 ? "keine Karten" : `${count} ${count === 1 ? "Karte" : "Karten"}`;
}

/** Der Fahrplan für den Fortschritt `progress`. Ändert nichts: Eine Haltestelle gilt erst mit dem Hauptknopf als begonnen. */
function planScreenOf(progress: Progress, request: SessionRequest, day: Day, now: Clock): { unitId: string | null; screen: PlanScreen } {
  if (request.kind === "extra") {
    const count = extraRoundIds(progress, day).length;
    return {
      unitId: null,
      screen: {
        kind: "plan",
        label: "Heute",
        title: { text: `${EXTRA_ROUND_CARDS} Karten extra`, spanish: false },
        rows: [{ step: null, name: "Karten üben", detail: cards(count), done: false }],
        button: "Beginnen",
      },
    };
  }

  if (request.kind === "final") {
    const review = sessionPlan(progress, null, day);
    const total = finalStationTaskCount(progress);
    const running = progress.finalRun !== undefined;
    const rows: PlanRow[] = [];
    if (review.review) rows.push({ step: 1, name: STEP_NAMES[1], detail: cards(review.reviewCount), done: false });
    rows.push({ step: null, name: "Endstation", detail: `${total} Aufgaben`, done: false });
    return {
      unitId: null,
      screen: {
        kind: "plan",
        label: "Heute · Endstation",
        title: { text: "Repaso final", spanish: true },
        rows,
        button: running && !review.review ? `Weiter bei Aufgabe ${(progress.finalRun?.answered.length ?? 0) + 1}` : "Beginnen",
      },
    };
  }

  // Die Haltestelle so rechnen, als wäre sie begonnen (ein gespeicherter Schritt 1 gilt dann als erledigt), ohne zu speichern.
  const wasRunning = request.unitId !== null && stopState(progress, request.unitId) === "running";
  const planned = request.unitId !== null ? startUnit(progress, request.unitId, now) : progress;
  const plan = sessionPlan(planned, request.unitId, day);
  const unit = plan.unitId === null ? undefined : getUnit(plan.unitId);

  if (plan.unitId === null || plan.step === null || !unit) {
    return {
      unitId: null,
      screen: {
        kind: "plan",
        label: "Heute",
        title: { text: "Wiederholen", spanish: false },
        rows: [{ step: 1, name: STEP_NAMES[1], detail: cards(plan.reviewCount), done: false }],
        button: "Beginnen",
      },
    };
  }

  const name = progress.profile.name;
  const details: Record<Step, string> = {
    1: cards(plan.reviewCount),
    2: cards(unit.items.length),
    3: unit.grammar.topic_de.replaceAll("{name}", name),
    4: unit.dialogue.setting_de.replaceAll("{name}", name),
    5: `${finalTaskCount(unit.id)} Aufgaben`,
    6: unit.mission.title_de.replaceAll("{name}", name),
  };
  const steps: Step[] = plan.review ? [1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6];
  const rows: PlanRow[] = steps.map((step) => ({ step, name: STEP_NAMES[step], detail: details[step], done: step > 1 && step < (plan.step ?? 2) }));
  const resume = wasRunning && !plan.review && plan.step > 2;
  return {
    unitId: plan.unitId,
    screen: {
      kind: "plan",
      label: `Heute · Haltestelle ${unit.stop}`,
      title: { text: unit.title_es, spanish: true },
      rows,
      button: resume ? `Weiter bei Schritt ${plan.step}` : "Beginnen",
    },
  };
}

// ---------- Sitzung aufbauen ----------

/**
 * Baut die Sitzung: den Fahrplan der Einheit. Es gibt noch keine Runde und keinen Ton. Das gilt auch nach einem Neuladen:
 * Der Fahrplan zeigt, was im Fortschritt steht. Der zurückgegebene Fortschritt ist der übergebene, ändert sich aber das
 * Anlegen einmal, muss der Aufrufer ihn speichern (`startSession` in `sessionDriver.ts` tut das).
 */
export function createSession(progress: Progress, asked: SessionRequest, ctx: SessionContext): SessionResult {
  const day = today(ctx.now);
  // Die Endstation gibt es nur, solange sie offen ist. Sonst bleibt eine Sitzung nur zum Wiederholen.
  const request: SessionRequest = asked.kind === "final" && finalStationState(progress) !== "open" ? { kind: "day", unitId: null } : asked;
  const { unitId, screen } = planScreenOf(progress, request, day, ctx.now);
  const state: SessionState = {
    request,
    unitId,
    screen,
    lastInputMs: nowMs(ctx),
    activeMs: 0,
    tally: { reviewed: 0, right: 0, answered: 0, startPoints: progress.stats.points },
  };
  return { state, progress, speak: null };
}

/** Tippen auf den Hauptknopf des Fahrplans: die erste Runde bauen. Erst jetzt gilt die Haltestelle als begonnen. */
function begin(s: SessionState, progress: Progress, ctx: SessionContext): SessionResult {
  const day = today(ctx.now);
  const request = s.request;

  if (request.kind === "extra") {
    const round = buildExtraRound(progress, day, ctx.rng, envOf(ctx));
    if (isRoundDone(round)) return { state: { ...s, screen: summaryScreen("extra") }, progress, speak: null };
    const screen = taskScreenOf("extra", round, s);
    return { state: { ...s, screen }, progress, speak: speakForTask(screen.task) };
  }

  const requestedUnit = request.kind === "day" ? request.unitId : null;
  const p = requestedUnit !== null ? startUnit(progress, requestedUnit, ctx.now) : progress;
  const plan = sessionPlan(p, requestedUnit, day);
  const state: SessionState = { ...s, unitId: plan.unitId };
  if (plan.review) {
    const round = buildReviewRound(p, day, ctx.rng, envOf(ctx));
    if (!isRoundDone(round)) {
      const screen = taskScreenOf("review", round, state);
      return { state: { ...state, screen }, progress: p, speak: speakForTask(screen.task) };
    }
    return afterReview(state, p, ctx);
  }
  return proceed(state, p, ctx);
}

/** Die Wiederholrunde ist durch oder an der Grenze: merken und beim gespeicherten Schritt 1 abschließen. */
function afterReview(state: SessionState, progress: Progress, ctx: SessionContext): SessionResult {
  let p = finishReviewRound(progress, today(ctx.now));
  if (state.unitId !== null && p.units[state.unitId]?.step === 1) p = completeStep(p, state.unitId, 1, ctx.now);
  return proceed(state, p, ctx);
}

/** Nach dem Wiederholen (oder ohne): bei der Haltestelle am gespeicherten Schritt weiter, sonst Zusammenfassung. */
function proceed(state: SessionState, progress: Progress, ctx: SessionContext): SessionResult {
  if (state.request.kind === "final") return enterStation(state, progress, ctx);
  if (state.unitId === null) {
    return { state: { ...state, screen: summaryScreen(state.request.kind === "extra" ? "extra" : "review") }, progress, speak: null };
  }
  const plan = sessionPlan(progress, state.unitId, today(ctx.now));
  if (plan.unitId === null || plan.step === null) {
    return { state: { ...state, unitId: null, screen: summaryScreen("review") }, progress, speak: null };
  }
  return enterStep(state, progress, plan.step, ctx);
}

function enterStep(state: SessionState, progress: Progress, step: Step, ctx: SessionContext): SessionResult {
  const unitId = state.unitId;
  const unit = unitOf(state);
  if (unitId === null || !unit) return proceed({ ...state, unitId: null }, progress, ctx);

  switch (step) {
    case 2: {
      const blocks = buildNewCards(unitId, ctx.rng);
      const first = blocks[0]?.items[0];
      if (!first) return enterStep(state, completeStep(progress, unitId, 2, ctx.now), 3, ctx);
      const screen: CardsScreen = { kind: "cards", blocks, block: 0, stage: "look", card: 0, pairs: emptyPairs() };
      return { state: { ...state, screen }, progress, speak: { text: speakTextOf(first) } };
    }
    case 3:
      return { state: { ...state, screen: { kind: "grammar" } }, progress, speak: null };
    case 4: {
      const first = unit.dialogue.lines[0];
      if (!first) return enterStep(state, completeStep(progress, unitId, 4, ctx.now), 5, ctx);
      return { state: { ...state, screen: { ...listenScreen(), shown: 1 } }, progress, speak: { text: first.es } };
    }
    case 5: {
      const round = buildFinalRound(progress, unitId, ctx.rng, envOf(ctx));
      if (isRoundDone(round)) return finishFinal(state, progress, ctx, null);
      const screen = taskScreenOf("final", round, state);
      return { state: { ...state, screen }, progress, speak: speakForTask(screen.task) };
    }
    default:
      return { state: { ...state, screen: { kind: "mission" } }, progress, speak: null };
  }
}

/** Abschlussrunde durch: Haltestelle abschließen (100 Punkte, Serie, Mission offen), dann die Mission zeigen. */
function finishFinal(state: SessionState, progress: Progress, ctx: SessionContext, round: RoundState | null): SessionResult {
  const unitId = state.unitId;
  const p = unitId === null ? progress : completeStep(progress, unitId, 5, ctx.now);
  const tally = round ? addRound(state.tally, round, false) : state.tally;
  return { state: { ...state, tally, screen: { kind: "mission" } }, progress: p, speak: null };
}

/**
 * Endstation beginnen oder nach einem Neuladen fortsetzen: Die Karten werden einmal gewählt und gespeichert (`finalRun`),
 * schon beantwortete fehlen in der Runde. Der Zähler zählt sie mit.
 */
function enterStation(state: SessionState, progress: Progress, ctx: SessionContext): SessionResult {
  const p = startFinalStation(progress, ctx.rng);
  const round = buildFinalStationRound(p, ctx.rng, envOf(ctx));
  if (isRoundDone(round)) return finishStation(state, p, ctx, null);
  const screen = taskScreenOf("station", round, state, undefined, Math.max(finalStationTaskCount(p) - round.total, 0));
  return { state: { ...state, screen }, progress: p, speak: speakForTask(screen.task) };
}

/** Endstation durch: Ergebnis speichern (`finalReview`), dann „Deine Linie“. */
function finishStation(state: SessionState, progress: Progress, ctx: SessionContext, round: RoundState | null): SessionResult {
  const run = progress.finalRun;
  const right = run ? run.right : (round?.right ?? 0);
  const total = run ? run.ids.length : (round?.total ?? 0);
  const p = progress.finalReview ? progress : finishFinalReview(progress, right, total, ctx.now);
  const tally = round ? addRound(state.tally, round, false) : state.tally;
  return { state: { ...state, tally, screen: { kind: "line" } }, progress: p, speak: null };
}

function addRound(tally: SessionTally, round: RoundState, countsAsReview: boolean): SessionTally {
  return {
    ...tally,
    reviewed: tally.reviewed + (countsAsReview ? round.completed : 0),
    right: tally.right + round.right,
    answered: tally.answered + round.completed,
  };
}

// ---------- Ereignisse ----------

export function reduce(state: SessionState, event: SessionEvent, progress: Progress, ctx: SessionContext): SessionResult {
  if (event.type === "background") return { state: withBackground(state), progress, speak: null };

  const ms = nowMs(ctx);
  const day = today(ctx.now);
  let p = recordActivity(progress, state.lastInputMs, ms, day);
  // Aktive Zeit der Sitzung: genau das, was `recordActivity` dem Tag gutgeschrieben hat (höchstens 60 s je Abstand).
  const gap = (p.stats.activeMsByDay[day] ?? 0) - (progress.stats.activeMsByDay[day] ?? 0);
  if (state.screen.kind !== "plan" && state.unitId !== null && !p.units[state.unitId]) p = startUnit(p, state.unitId, ctx.now);
  const s: SessionState = { ...state, lastInputMs: ms, activeMs: state.activeMs + gap };
  const ignore: SessionResult = { state: s, progress: p, speak: null };

  const screen = s.screen;
  switch (screen.kind) {
    case "plan":
      return event.type === "begin" ? begin(s, p, ctx) : ignore;
    case "cards":
      return onCards(s, screen, event, p, ctx) ?? ignore;
    case "grammar":
      return event.type === "next" ? startCloze(s, p, ctx) : ignore;
    case "task":
      return onTask(s, screen, event, p, ctx) ?? ignore;
    case "dialogue":
      return onDialogue(s, screen, event, p, ctx) ?? ignore;
    case "mission":
      return event.type === "next" ? { state: { ...s, screen: summaryScreen("unit") }, progress: p, speak: null } : ignore;
    case "summary":
    case "line":
      return ignore;
  }
}

// --- Neue Karten ---

function onCards(s: SessionState, screen: CardsScreen, event: SessionEvent, p: Progress, ctx: SessionContext): SessionResult | null {
  const block = screen.blocks[screen.block];
  if (!block) return null;

  if (screen.stage === "look") {
    if (event.type !== "next") return null;
    const nextItem = block.items[screen.card + 1];
    if (nextItem) {
      return { state: { ...s, screen: { ...screen, card: screen.card + 1 } }, progress: p, speak: { text: speakTextOf(nextItem) } };
    }
    return { state: { ...s, screen: { ...screen, stage: "pairs", pairs: emptyPairs() } }, progress: p, speak: null };
  }

  if (event.type === "pair") {
    return { state: { ...s, screen: { ...screen, pairs: tapPair(screen.pairs, event.side, event.id, block.items) } }, progress: p, speak: null };
  }
  if (event.type !== "next" || screen.pairs.found.length < block.items.length) return null;

  const nextBlock = screen.blocks[screen.block + 1];
  if (nextBlock) {
    const first = nextBlock.items[0];
    const next: CardsScreen = { ...screen, block: screen.block + 1, stage: "look", card: 0, pairs: emptyPairs() };
    return { state: { ...s, screen: next }, progress: p, speak: first ? { text: speakTextOf(first) } : null };
  }
  if (s.unitId === null) return null;
  return enterStep(s, completeStep(p, s.unitId, 2, ctx.now), 3, ctx);
}

/** Tippen in den Paaren: erst eine Zeile wählen, dann die Gegenseite. Ein falsches Paar bleibt bis zum nächsten Tippen markiert. */
function tapPair(run: PairsRun, side: "left" | "right", id: string, items: readonly Item[]): PairsRun {
  if (run.found.includes(id) || !items.some((item) => item.id === id)) return run;
  const base: PairsRun = run.wrong ? { ...run, wrong: null, selected: null } : run;
  const selected = base.selected;
  if (!selected || selected.side === side) {
    if (selected && selected.id === id) return { ...base, selected: null };
    return { ...base, selected: { side, id } };
  }
  const left = side === "right" ? selected.id : id;
  const right = side === "right" ? id : selected.id;
  if (isPairMatch(left, right)) return { selected: null, found: [...base.found, left], wrong: null };
  return { selected: null, found: base.found, wrong: { left, right } };
}

// --- Grammatik ---

function startCloze(s: SessionState, p: Progress, ctx: SessionContext): SessionResult {
  if (s.unitId === null) return { state: s, progress: p, speak: null };
  const tasks = buildClozeRound(s.unitId, ctx.rng);
  if (tasks.length === 0) return enterStep(s, completeStep(p, s.unitId, 3, ctx.now), 4, ctx);
  return { state: { ...s, screen: clozeScreenOf(tasks, 0, s) }, progress: p, speak: null };
}

// --- Aufgaben ---

function onTask(s: SessionState, screen: TaskScreen, event: SessionEvent, p: Progress, ctx: SessionContext): SessionResult | null {
  const task = screen.task;
  if (screen.answer === null) {
    switch (event.type) {
      case "choose":
        return task.kind === "choice" && event.index >= 0 && event.index < task.options.length
          ? answer(s, screen, evaluateChoice(task, event.index), event.index, p, ctx)
          : null;
      case "place":
        if (task.kind !== "build" || screen.placed.includes(event.index) || event.index < 0 || event.index >= task.tokens.length) return null;
        return { state: { ...s, screen: { ...screen, placed: [...screen.placed, event.index] } }, progress: p, speak: null };
      case "unplace":
        if (task.kind !== "build" || !screen.placed.includes(event.index)) return null;
        return { state: { ...s, screen: { ...screen, placed: screen.placed.filter((i) => i !== event.index) } }, progress: p, speak: null };
      case "check":
        if (task.kind !== "build" || screen.placed.length !== task.tokens.length) return null;
        return answer(s, screen, evaluateBuild(task, screen.placed.map((i) => task.tokens[i] ?? "")), null, p, ctx);
      case "submitText":
        return task.kind === "write" && event.text.trim() !== "" ? answer(s, screen, evaluateWrite(task, event.text), null, p, ctx) : null;
      default:
        return null;
    }
  }
  return event.type === "next" ? advanceTask(s, screen, p, ctx) : null;
}

/** Antwort verbuchen und speichern: Fach, Fälligkeit und Punkte laufen über `answerInRound`. Lückensätze ändern nichts. */
function answer(
  s: SessionState,
  screen: TaskScreen,
  feedback: Feedback,
  chosen: number | null,
  p: Progress,
  ctx: SessionContext,
): SessionResult {
  let progress = p;
  let round = screen.round;
  if (round) {
    const result = answerInRound(p, round, feedback.correct, ctx.now);
    progress = result.progress;
    round = result.round;
  }
  return { state: { ...s, screen: { ...screen, round, chosen, answer: feedback } }, progress, speak: null };
}

/** „Weiter“ nach einer Antwort: nächste Aufgabe oder Ende der Runde. */
function advanceTask(s: SessionState, screen: TaskScreen, p: Progress, ctx: SessionContext): SessionResult {
  if (screen.role === "cloze" && screen.cloze) {
    const index = screen.cloze.index + 1;
    if (index < screen.cloze.tasks.length) {
      return { state: { ...s, screen: clozeScreenOf(screen.cloze.tasks, index, s, screen) }, progress: p, speak: null };
    }
    if (s.unitId === null) return { state: { ...s, screen: summaryScreen("review") }, progress: p, speak: null };
    return enterStep(s, completeStep(p, s.unitId, 3, ctx.now), 4, ctx);
  }

  const round = screen.round;
  if (!round) return { state: s, progress: p, speak: null };
  // Die Grenze von 6 Minuten zählt aktive Zeit: Pausen über 60 Sekunden und Zeit im Hintergrund zählen nicht (5.4).
  const timeUp = screen.role === "review" && isRoundTimeUp(screen.startedActiveMs, s.activeMs);
  if (!isRoundDone(round) && !timeUp) {
    const next = taskScreenOf(screen.role, round, s, screen);
    return { state: { ...s, screen: next }, progress: p, speak: speakForTask(next.task) };
  }

  switch (screen.role) {
    case "review":
      return afterReview({ ...s, tally: addRound(s.tally, round, true) }, p, ctx);
    case "extra":
      return {
        state: { ...s, tally: addRound(s.tally, round, true), screen: summaryScreen("extra") },
        progress: p,
        speak: null,
      };
    case "station":
      return finishStation(s, p, ctx, round);
    default:
      return finishFinal(s, p, ctx, round);
  }
}

// --- Dialog ---

function onDialogue(s: SessionState, screen: DialogueScreen, event: SessionEvent, p: Progress, ctx: SessionContext): SessionResult | null {
  const unit = unitOf(s);
  if (!unit) return null;
  const lines = unit.dialogue.lines;
  const unitId = s.unitId;
  if (unitId === null) return null;

  if (event.type === "reveal") {
    // Die Zeilen der Lernenden bleiben im Rollenspiel verdeckt: Ihre Übersetzung gibt es nur beim Anhören.
    const target = lines[event.line];
    if (!target || event.line < 0 || event.line >= screen.shown || screen.revealed.includes(event.line)) return null;
    if (screen.phase === "role" && target.learner) return null;
    return { state: { ...s, screen: { ...screen, revealed: [...screen.revealed, event.line] } }, progress: p, speak: null };
  }

  if (screen.phase === "listen") {
    if (event.type !== "next") return null;
    const line = lines[screen.shown];
    if (line) return { state: { ...s, screen: { ...screen, shown: screen.shown + 1 } }, progress: p, speak: { text: line.es } };
    // Alles gehört: das Rollenspiel beginnt. Ohne eigene Zeile gibt es nichts zu spielen.
    const first = lines[0];
    if (!first || !lines.some((line) => line.learner)) return enterStep(s, completeStep(p, unitId, 4, ctx.now), 5, ctx);
    const role: DialogueScreen = { ...listenScreen(), phase: "role", shown: 1 };
    return { state: { ...s, screen: role }, progress: p, speak: first.learner ? null : { text: first.es } };
  }

  // Rollenspiel: Die Zeile, die gerade dran ist, ist die letzte sichtbare.
  const index = screen.shown - 1;
  const current = lines[index];
  if (!current) return null;
  if (current.learner) {
    if (event.type === "uncover" && !screen.uncovered) {
      return { state: { ...s, screen: { ...screen, uncovered: true } }, progress: p, speak: { text: current.es } };
    }
    if (!screen.uncovered) return null;
    if (event.type === "again" && !screen.again.includes(index)) {
      return { state: { ...s, screen: { ...screen, uncovered: false, again: [...screen.again, index] } }, progress: p, speak: null };
    }
    if (event.type === "sat") return nextRoleLine(s, { ...screen, sat: [...screen.sat, index] }, lines, p, ctx);
    return null;
  }
  return event.type === "next" ? nextRoleLine(s, screen, lines, p, ctx) : null;
}

/** Rollenspiel: zur nächsten Zeile. Eine Zeile der anderen Person wird im selben Tippen gesprochen. Nach der letzten Zeile ist Schritt 4 fertig. */
function nextRoleLine(
  s: SessionState,
  screen: DialogueScreen,
  lines: readonly { es: string; learner: boolean }[],
  p: Progress,
  ctx: SessionContext,
): SessionResult | null {
  if (s.unitId === null) return null;
  const next = lines[screen.shown];
  if (!next) return enterStep(s, completeStep(p, s.unitId, 4, ctx.now), 5, ctx);
  return {
    state: { ...s, screen: { ...screen, shown: screen.shown + 1, uncovered: false } },
    progress: p,
    speak: next.learner ? null : { text: next.es },
  };
}

// ---------- Anzeige-Hilfen ----------

/** Nummer des Schritts für die Linie im Kopf, `null` ohne Haltestelle und im Fahrplan. */
export function stepNumberOf(state: SessionState): number | null {
  if (state.unitId === null) return null;
  const screen = state.screen;
  switch (screen.kind) {
    case "plan":
    case "line":
      return null;
    case "cards":
      return 2;
    case "grammar":
      return 3;
    case "dialogue":
      return 4;
    case "mission":
    case "summary":
      return 6;
    case "task":
      if (state.request.kind === "final") return null;
      return screen.role === "review" ? 1 : screen.role === "cloze" ? 3 : 5;
  }
}

/** Zähler im Kopf: „5 von 18“. In der Abschlussrunde zählt er über die ganze Runde, auch nach einem Neuladen. */
export function counterOf(state: SessionState): string | null {
  const screen = state.screen;
  switch (screen.kind) {
    case "cards": {
      if (screen.stage === "pairs") return `Paare ${screen.block + 1} von ${screen.blocks.length}`;
      const total = screen.blocks.reduce((sum, block) => sum + block.items.length, 0);
      const before = screen.blocks.slice(0, screen.block).reduce((sum, block) => sum + block.items.length, 0);
      return `Karte ${before + screen.card + 1} von ${total}`;
    }
    case "dialogue": {
      const total = unitOf(state)?.dialogue.lines.length ?? screen.shown;
      return `Zeile ${screen.shown} von ${total}`;
    }
    case "task": {
      if (screen.cloze) return `${screen.cloze.index + 1} von ${screen.cloze.tasks.length}`;
      const round = screen.round;
      if (!round) return null;
      // Vor der Antwort zählt eine erste Aufgabe schon mit, eine Wiedervorlage nicht.
      const shown = screen.answer === null && !isRepeat(round) ? round.completed + 1 : round.completed;
      const total = screen.offset + round.total;
      return `${Math.min(Math.max(screen.offset + shown, 1), Math.max(total, 1))} von ${total}`;
    }
    default:
      return null;
  }
}

export interface SummaryFacts {
  kind: SummaryKind;
  /** Nummer der Haltestelle bei `unit`. */
  stop: number | null;
  newCards: number;
  reviewed: number;
  right: number;
  answered: number;
  pointsGained: number;
  streak: number;
}

export function summaryFacts(state: SessionState, progress: Progress, day: Day): SummaryFacts {
  const screen = state.screen;
  const kind: SummaryKind = screen.kind === "summary" ? screen.summary : "review";
  const unit = state.unitId === null ? undefined : getUnit(state.unitId);
  return {
    kind,
    stop: kind === "unit" && unit ? unit.stop : null,
    newCards: kind === "unit" && unit ? unit.items.length : 0,
    reviewed: state.tally.reviewed,
    right: state.tally.right,
    answered: state.tally.answered,
    pointsGained: progress.stats.points - state.tally.startPoints,
    streak: currentStreak(progress, day),
  };
}

/** Zustände der zehn Haltestellen für den Berg. */
export function mountainStops(progress: Progress): StopState[] {
  return stopStates(progress).map((stop) => stop.state);
}

/**
 * Der Berg vor dem Abschluss der Haltestelle `unitId`: Sie läuft noch, die nächste ist noch gesperrt.
 * Die Zusammenfassung blendet ihn ein und wechselt dann auf `mountainStops` (docs/04-design.md, „Bewegung“).
 */
export function mountainBefore(after: readonly StopState[], unitId: string | null): StopState[] {
  const index = unitId === null ? -1 : (getUnit(unitId)?.stop ?? 0) - 1;
  return after.map((state, i) => (i === index ? "running" : i > index && state === "open" ? "locked" : state));
}

export interface SummaryLine {
  label: string;
  value: string;
}

export interface SummaryText {
  headline: string;
  /** Sachliche Sätze unter der Zeile. */
  notes: string[];
  lines: SummaryLine[];
}

/**
 * Text der Zusammenfassung. Zeigt nur, was war: Zeilen mit „+0“ oder „0 Tage“ gibt es nicht, „ist geschafft“ nur, wo
 * eine Haltestelle abgeschlossen wurde. Im Ruhemodus fehlen Punkte und Serie.
 */
export function summaryText(facts: SummaryFacts, opts: { calm: boolean; missionTitle: string | null; doneStops: number }): SummaryText {
  const lines: SummaryLine[] = [];
  const notes: string[] = [];
  let headline: string;
  if (facts.kind === "unit") {
    headline = `Haltestelle ${facts.stop ?? ""} ist geschafft.`;
    notes.push(`${opts.doneStops} von 10 Haltestellen abgeschlossen.`);
    if (opts.missionTitle) notes.push(`Deine Mission ist offen: ${opts.missionTitle}`);
    lines.push({ label: "Neue Karten", value: String(facts.newCards) });
  } else if (facts.kind === "extra") {
    if (facts.answered === 0) {
      headline = "Noch nichts zu üben.";
      notes.push("Die freie Runde nimmt Karten aus abgeschlossenen Haltestellen. Schließe zuerst Haltestelle 1 ab.");
    } else {
      headline = "Die freie Runde ist zu Ende.";
      notes.push("Sie ändert keine Fächer und gibt keine Punkte.");
      lines.push({ label: "Geübte Karten", value: String(facts.reviewed) });
    }
  } else {
    headline = facts.answered === 0 ? "Heute ist nichts mehr fällig." : "Die Wiederholrunde ist zu Ende.";
    if (facts.answered > 0) lines.push({ label: "Wiederholte Karten", value: String(facts.reviewed) });
  }
  if (facts.answered > 0) lines.push({ label: "Richtige Antworten", value: `${facts.right} von ${facts.answered}` });
  if (!opts.calm && facts.kind !== "extra" && facts.pointsGained > 0) lines.push({ label: "Punkte", value: `+${facts.pointsGained}` });
  if (!opts.calm && facts.streak >= 1) lines.push({ label: "Serie", value: `${facts.streak} ${facts.streak === 1 ? "Tag" : "Tage"}` });
  return { headline, notes, lines };
}