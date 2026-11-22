// Ablauf der Lerneinheit als reine Zustandsmaschine (docs/02-spezifikation.md, 2.3 und 2.4).
// Kein React, kein Browser-Speicher, keine echte Uhr: Uhr, Zufall und Stimme kommen aus `SessionContext`.
//
//   createSession(progress, request, ctx)       baut die Sitzung aus dem gespeicherten Fortschritt (auch nach einem Neuladen)
//   reduce(state, event, progress, ctx)         Ereignis ergibt neuen Zustand, neuen Fortschritt und optional den Ton
//
// Der Ton (`speak`) wird nicht hier gesprochen: Die Maschine liefert den Text mit dem Zustandswechsel, die Ansicht
// spricht ihn in derselben Klick-Behandlung (iOS spielt nur direkt aus einem Tippen).

import { isRoundTimeUp } from "../../core/cards";
import { getUnit } from "../../core/content";
import { buildClozeRound, buildExtraRound, buildFinalRound, buildNewCards, buildReviewRound } from "../../core/flow";
import { answerInRound, currentTask, isRepeat, isRoundDone } from "../../core/round";
import type { RoundState } from "../../core/round";
import { currentStreak, recordActivity } from "../../core/stats";
import { evaluateBuild, evaluateChoice, evaluateWrite, isPairMatch, speakTextOf } from "../../core/tasks";
import type { ChoiceTask, Feedback, PairsTask, RoundTask, TaskEnv } from "../../core/tasks";
import { today } from "../../core/time";
import type { Clock } from "../../core/time";
import type { Rng } from "../../core/random";
import type { Day, Item, Progress, Step } from "../../core/types";
import { completeStep, finishReviewRound, sessionPlan, startUnit, stopStates } from "../../core/units";
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

export type TaskRole = "review" | "extra" | "final" | "cloze";

export interface PairsRun {
  /** Gewählte Zeile, wartet auf die Gegenseite. */
  selected: { side: "left" | "right"; id: string } | null;
  /** Gefundene Paare (Karten-ids). */
  found: readonly string[];
  /** Falsches Paar, beide Zeilen zeigen das Kreuz bis zum nächsten Tippen. */
  wrong: { left: string; right: string } | null;
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
  startedMs: number;
  /** Satzbau: Indizes in `task.tokens` in der Reihenfolge des Satzes. */
  placed: readonly number[];
  /** Auswahl: gewählte Antwort. */
  chosen: number | null;
  answer: Feedback | null;
}

export interface DialogueScreen {
  kind: "dialogue";
  /** Zahl der sichtbaren Zeilen. */
  shown: number;
  /** Zeilen, deren Übersetzung aufgedeckt ist. */
  revealed: readonly number[];
}

export interface MissionScreen {
  kind: "mission";
}

export type SummaryKind = "unit" | "review" | "extra";

export interface SummaryScreen {
  kind: "summary";
  summary: SummaryKind;
}

export type Screen = CardsScreen | GrammarScreen | TaskScreen | DialogueScreen | MissionScreen | SummaryScreen;

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
  tally: SessionTally;
}

export type SessionEvent =
  /** „Weiter“ */
  | { type: "next" }
  | { type: "choose"; index: number }
  /** Satzbau: Baustein (Index in `task.tokens`) setzen oder zurücknehmen, dann prüfen. */
  | { type: "place"; index: number }
  | { type: "unplace"; index: number }
  | { type: "check" }
  /** Schreiben (nicht im MVP ausgegeben, die Maschine kann es schon). */
  | { type: "submitText"; text: string }
  | { type: "pair"; side: "left" | "right"; id: string }
  /** Übersetzung einer Dialogzeile aufdecken. */
  | { type: "reveal"; line: number }
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

function emptyPairs(): PairsRun {
  return { selected: null, found: [], wrong: null };
}

function taskScreenOf(role: TaskRole, round: RoundState, ctx: SessionContext, previous?: TaskScreen): TaskScreen {
  const task = currentTask(round);
  if (!task) throw new Error("Runde ohne Aufgabe");
  return {
    kind: "task",
    role,
    seq: (previous?.seq ?? -1) + 1,
    repeat: isRepeat(round),
    task,
    round,
    cloze: null,
    startedMs: previous?.startedMs ?? nowMs(ctx),
    placed: [],
    chosen: null,
    answer: null,
  };
}

function clozeScreenOf(tasks: readonly ChoiceTask[], index: number, ctx: SessionContext, previous?: TaskScreen): TaskScreen {
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
    startedMs: previous?.startedMs ?? nowMs(ctx),
    placed: [],
    chosen: null,
    answer: null,
  };
}

/** Der Zustand nach „Hintergrund“: Die Lernzeit zählt bis zur nächsten Eingabe nichts. */
export function withBackground(state: SessionState): SessionState {
  return state.lastInputMs === null ? state : { ...state, lastInputMs: null };
}

// ---------- Sitzung aufbauen ----------

/**
 * Baut die Sitzung aus dem Fortschritt. `day`: erst die Wiederholrunde, falls sie aussteht, dann der gespeicherte Schritt
 * der Haltestelle. Das gilt auch nach einem Neuladen: Es zählt nur, was im Fortschritt steht. Der Ton ist hier immer `null`,
 * weil die Sitzung nicht durch ein Tippen in dieser Ansicht beginnt.
 */
export function createSession(progress: Progress, request: SessionRequest, ctx: SessionContext): SessionResult {
  const day = today(ctx.now);
  let p = progress;
  if (request.kind === "day" && request.unitId !== null) p = startUnit(p, request.unitId, ctx.now);
  const base: SessionState = {
    request,
    unitId: null,
    screen: summaryScreen("review"),
    lastInputMs: nowMs(ctx),
    tally: { reviewed: 0, right: 0, answered: 0, startPoints: p.stats.points },
  };

  if (request.kind === "extra") {
    const round = buildExtraRound(p, day, ctx.rng, envOf(ctx));
    const screen = isRoundDone(round) ? summaryScreen("extra") : taskScreenOf("extra", round, ctx);
    return { state: { ...base, screen }, progress: p, speak: null };
  }

  const plan = sessionPlan(p, request.unitId, day);
  const state: SessionState = { ...base, unitId: plan.unitId };
  if (plan.review) {
    const round = buildReviewRound(p, day, ctx.rng, envOf(ctx));
    if (!isRoundDone(round)) return { state: { ...state, screen: taskScreenOf("review", round, ctx) }, progress: p, speak: null };
    return { ...afterReview(state, p, ctx), speak: null };
  }
  return { ...proceed(state, p, ctx), speak: null };
}

/** Die Wiederholrunde ist durch oder an der Grenze: merken und beim gespeicherten Schritt 1 abschließen. */
function afterReview(state: SessionState, progress: Progress, ctx: SessionContext): SessionResult {
  let p = finishReviewRound(progress, today(ctx.now));
  if (state.unitId !== null && p.units[state.unitId]?.step === 1) p = completeStep(p, state.unitId, 1, ctx.now);
  return proceed(state, p, ctx);
}

/** Nach dem Wiederholen (oder ohne): bei der Haltestelle am gespeicherten Schritt weiter, sonst Zusammenfassung. */
function proceed(state: SessionState, progress: Progress, ctx: SessionContext): SessionResult {
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
      return { state: { ...state, screen: { kind: "dialogue", shown: 1, revealed: [] } }, progress, speak: { text: first.es } };
    }
    case 5: {
      const round = buildFinalRound(progress, unitId, ctx.rng, envOf(ctx));
      if (isRoundDone(round)) return finishFinal(state, progress, ctx, null);
      return { state: { ...state, screen: taskScreenOf("final", round, ctx) }, progress, speak: null };
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
  let p = recordActivity(progress, state.lastInputMs, ms, today(ctx.now));
  if (state.unitId !== null && !p.units[state.unitId]) p = startUnit(p, state.unitId, ctx.now);
  const s: SessionState = { ...state, lastInputMs: ms };
  const ignore: SessionResult = { state: s, progress: p, speak: null };

  const screen = s.screen;
  switch (screen.kind) {
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
  return { state: { ...s, screen: clozeScreenOf(tasks, 0, ctx) }, progress: p, speak: null };
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
      return { state: { ...s, screen: clozeScreenOf(screen.cloze.tasks, index, ctx, screen) }, progress: p, speak: null };
    }
    if (s.unitId === null) return { state: { ...s, screen: summaryScreen("review") }, progress: p, speak: null };
    return enterStep(s, completeStep(p, s.unitId, 3, ctx.now), 4, ctx);
  }

  const round = screen.round;
  if (!round) return { state: s, progress: p, speak: null };
  const timeUp = screen.role === "review" && isRoundTimeUp(screen.startedMs, nowMs(ctx));
  if (!isRoundDone(round) && !timeUp) {
    const next = taskScreenOf(screen.role, round, ctx, screen);
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
    default:
      return finishFinal(s, p, ctx, round);
  }
}

// --- Dialog ---

function onDialogue(s: SessionState, screen: DialogueScreen, event: SessionEvent, p: Progress, ctx: SessionContext): SessionResult | null {
  const unit = unitOf(s);
  if (!unit) return null;
  if (event.type === "reveal") {
    if (event.line < 0 || event.line >= screen.shown || screen.revealed.includes(event.line)) return null;
    return { state: { ...s, screen: { ...screen, revealed: [...screen.revealed, event.line] } }, progress: p, speak: null };
  }
  if (event.type !== "next" || s.unitId === null) return null;
  const line = unit.dialogue.lines[screen.shown];
  if (line) return { state: { ...s, screen: { ...screen, shown: screen.shown + 1 } }, progress: p, speak: { text: line.es } };
  return enterStep(s, completeStep(p, s.unitId, 4, ctx.now), 5, ctx);
}

// ---------- Anzeige-Hilfen ----------

/** Nummer des Schritts für die Linie im Kopf, `null` ohne Haltestelle. */
export function stepNumberOf(state: SessionState): number | null {
  if (state.unitId === null) return null;
  const screen = state.screen;
  switch (screen.kind) {
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
      return screen.role === "review" ? 1 : screen.role === "cloze" ? 3 : 5;
  }
}

/** Zähler im Kopf: „5 von 18“. */
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
      return `${Math.min(Math.max(shown, 1), Math.max(round.total, 1))} von ${round.total}`;
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
export function mountainStops(progress: Progress) {
  return stopStates(progress).map((stop) => stop.state);
}
