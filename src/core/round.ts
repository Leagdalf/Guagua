// Ablauf einer Runde (Wiederholen, Abschlussrunde, Endstation, freie Runde) mit Wiedervorlage falscher Karten.
// Eine falsch beantwortete Karte kommt frühestens nach drei anderen Aufgaben erneut, höchstens zweimal (5.1).
// Nur die erste Antwort auf eine Karte ändert Fach und Punkte. Wiedervorlagen sind Übung ohne Wertung.

import { POINTS, WRONG_ANSWER } from "./config";
import { recordCardAnswer } from "./cards";
import { addPoints } from "./stats";
import { today } from "./time";
import type { Clock } from "./time";
import type { RoundTask } from "./tasks";
import type { Progress } from "./types";

export interface RoundState {
  /** Noch offene Aufgaben, die aktuelle zuerst. Enthält auch Wiedervorlagen. */
  readonly queue: readonly RoundTask[];
  /** Wie oft eine Aufgabe (nach id) schon beantwortet wurde. */
  readonly attempts: Readonly<Record<string, number>>;
  /** Zahl der Aufgaben beim Start, ohne Wiedervorlagen. */
  readonly total: number;
  /** Davon bereits zum ersten Mal beantwortet. Für den Zähler „n von total“. */
  readonly completed: number;
  /** Erste Antworten richtig und falsch. */
  readonly right: number;
  readonly wrong: number;
}

export function createRound(tasks: readonly RoundTask[]): RoundState {
  return { queue: tasks, attempts: {}, total: tasks.length, completed: 0, right: 0, wrong: 0 };
}

export function currentTask(round: RoundState): RoundTask | null {
  return round.queue[0] ?? null;
}

export function isRoundDone(round: RoundState): boolean {
  return round.queue.length === 0;
}

/** Wahr, wenn die aktuelle Aufgabe eine Wiedervorlage ist. */
export function isRepeat(round: RoundState): boolean {
  const task = currentTask(round);
  return task !== null && (round.attempts[task.id] ?? 0) > 0;
}

export interface RoundAnswerResult {
  progress: Progress;
  round: RoundState;
  /** Falsch beantwortet und erneut eingereiht. */
  requeued: boolean;
}

/**
 * Verbucht die Antwort auf die aktuelle Aufgabe.
 * Erste Antwort auf eine Karte: Fach, Fälligkeit, 10 Punkte bei richtig, Serie. Satzbau ohne Karte: 10 Punkte bei richtig.
 * Wiedervorlage: keine Änderung am Fortschritt.
 */
export function answerInRound(progress: Progress, round: RoundState, correct: boolean, now: Clock): RoundAnswerResult {
  const task = currentTask(round);
  if (!task) return { progress, round, requeued: false };

  const attempt = round.attempts[task.id] ?? 0;
  const first = attempt === 0;
  let nextProgress = progress;
  if (first) {
    if (task.itemId !== null) nextProgress = recordCardAnswer(progress, task.itemId, correct, today(now));
    else if (correct) nextProgress = addPoints(progress, POINTS.correctAnswer);
  }

  const rest = round.queue.slice(1);
  const requeue = !correct && task.itemId !== null && attempt < WRONG_ANSWER.maxRepeatsPerRound;
  const queue = requeue ? insertAt(rest, Math.min(WRONG_ANSWER.repeatAfterOtherCards, rest.length), task) : rest;

  return {
    progress: nextProgress,
    requeued: requeue,
    round: {
      queue,
      attempts: { ...round.attempts, [task.id]: attempt + 1 },
      total: round.total,
      completed: round.completed + (first ? 1 : 0),
      right: round.right + (first && correct ? 1 : 0),
      wrong: round.wrong + (first && !correct ? 1 : 0),
    },
  };
}

function insertAt<T>(list: readonly T[], index: number, value: T): T[] {
  return [...list.slice(0, index), value, ...list.slice(index)];
}
