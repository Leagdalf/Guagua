// Inhalte der Schritte einer Haltestelle und freie Runden. Jede Funktion liefert, was die Oberfläche anzeigt.
// Die Antworten laufen über `answerInRound` (round.ts), Schritte schließt `completeStep` (units.ts) ab.

import { extraRoundIds, reviewLimit, reviewRoundIds } from "./cards";
import { EXTRA_ROUND_CARDS, FINAL_REVIEW } from "./config";
import { allItems, getItem } from "./content";
import { shuffle } from "./random";
import type { Rng } from "./random";
import { createRound } from "./round";
import type { RoundState } from "./round";
import { buildClozeTasks, buildFinalRoundTasks, buildNewCardBlocks, makeReviewTask } from "./tasks";
import { addDays } from "./time";
import type { Clock } from "./time";
import type { ChoiceTask, PairsTask, RoundTask, TaskEnv } from "./tasks";
import type { Day, Item, Progress } from "./types";

/**
 * Aufgaben zu Karten in der Reihenfolge von `ids`: Typ nach Fach. Die ersten `MAX_WRITE_TASKS_PER_ROUND` Schreibaufgaben
 * bleiben Schreibaufgaben, alle weiteren Karten ab Fach 3 kommen als „Sag es laut“ (oder „Erinnern“, siehe `taskTypeForReview`).
 */
function tasksForCards(progress: Progress, ids: readonly string[], rng: Rng, env: TaskEnv): RoundTask[] {
  let writes = 0;
  return ids.map((id) => {
    const task = makeReviewTask(id, progress.cards[id]?.box ?? 1, rng, env, writes);
    if (task.kind === "write") writes++;
    return task;
  });
}

/** Schritt 1: fällige Karten, niedrigstes Fach zuerst, höchstens 40 (nach der Endstation 20, `reviewLimit`). Aufgabentyp nach Fach. */
export function buildReviewRound(progress: Progress, day: Day, rng: Rng, env: TaskEnv, limit: number = reviewLimit(progress)): RoundState {
  return createRound(tasksForCards(progress, reviewRoundIds(progress, day, limit), rng, env));
}
/**
 * Freie Runde „10 Karten extra“. Leer, wenn noch keine Haltestelle abgeschlossen ist.
 * Karten in niedrigen Fächern zuerst, innerhalb eines Fachs zufällig, bei jedem Start neu (2.9, Punkt 7).
 * Reine Übung: Die Runde trägt `practice`, `answerInRound` ändert dann kein Fach und gibt keine Punkte.
 */
export function buildExtraRound(progress: Progress, day: Day, rng: Rng, env: TaskEnv, count: number = EXTRA_ROUND_CARDS): RoundState {
  return createRound(tasksForCards(progress, extraRoundIds(progress, day, count, rng), rng, env), { practice: true });
}

/**
 * Schritt 2: Blöcke zu vier Karten. Pro Block zuerst jede Karte ansehen und anhören (`items`), danach die Paare-Aufgabe.
 * Die Paare ändern keine Fächer.
 */
export function buildNewCards(unitId: string, rng: Rng): { items: Item[]; pairs: PairsTask }[] {
  return buildNewCardBlocks(unitId, rng);
}

/** Schritt 3, zweiter Teil: die Lückensätze. Ändern keine Fächer. */
export function buildClozeRound(unitId: string, rng: Rng): ChoiceTask[] {
  return buildClozeTasks(unitId, rng);
}

/**
 * Schritt 5: jede neue Karte einmal („Erkennen“), dazu die Satzbau-Aufgaben. Die Antworten ändern die Fächer der neuen Karten.
 * Aufgaben, die laut `progress.units[unitId].answered` schon ihre erste Antwort haben, fehlen. `total` zählt nur den Rest.
 * Die Runde merkt sich `unitId`, damit `answerInRound` jede erste Antwort in `answered` einträgt.
 */
export function buildFinalRound(progress: Progress, unitId: string, rng: Rng, env: Pick<TaskEnv, "hasSpanishVoice">): RoundState {
  const answered = new Set(progress.units[unitId]?.answered ?? []);
  const tasks = buildFinalRoundTasks(unitId, rng, env).filter((task) => !answered.has(task.id));
  return createRound(tasks, { unitId });
}

/**
 * Die Karten der Endstation (2.8): zuerst Fach 1 bis 3 (gemischt), danach der Rest (gemischt), höchstens 30.
 * Karten, die heute schon beantwortet wurden (`lastSeen` ist `day` und es gibt mindestens eine Antwort), kommen nur dran,
 * wenn sonst keine 30 zusammenkommen, und dann zuletzt, in derselben Ordnung (zuerst niedrige Fächer).
 */
export function pickFinalStationIds(progress: Progress, rng: Rng, day?: Day): string[] {
  const ids = allItems.map((item) => item.id).filter((id) => progress.cards[id] !== undefined);
  const answeredToday = (id: string): boolean => {
    const card = progress.cards[id];
    return day !== undefined && card !== undefined && card.lastSeen === day && card.right + card.wrong > 0;
  };
  const isLow = (id: string): boolean => (progress.cards[id]?.box ?? 5) <= FINAL_REVIEW.firstUpToBox;
  const fresh = ids.filter((id) => !answeredToday(id));
  const seen = ids.filter(answeredToday);
  const order = (list: string[]): string[] => [...shuffle(list.filter(isLow), rng), ...shuffle(list.filter((id) => !isLow(id)), rng)];
  return [...order(fresh), ...order(seen)].slice(0, FINAL_REVIEW.taskCount);
}

/** Zahl der Aufgaben der Endstation: die der laufenden, sonst die, die eine neue bekäme. */
export function finalStationTaskCount(progress: Progress): number {
  if (progress.finalRun) return progress.finalRun.ids.length;
  return Math.min(FINAL_REVIEW.taskCount, allItems.filter((item) => progress.cards[item.id] !== undefined).length);
}

/**
 * Beginnt die Endstation: wählt die Karten einmal und merkt sie in `finalRun`. Läuft sie schon oder ist sie geschafft,
 * bleibt alles unverändert. Rufen, wenn die Wiederholrunde davor durch ist (sie ändert Fächer, und die Auswahl hängt davon ab).
 */
export function startFinalStation(progress: Progress, rng: Rng, day?: Day): Progress {
  if (progress.finalRun || progress.finalReview) return progress;
  return { ...progress, finalRun: { ids: pickFinalStationIds(progress, rng, day), answered: [], right: 0 } };
}

/**
 * Endstation (2.8): 30 Aufgaben über alle angelegten Karten, zuerst Fach 1 bis 3, der Rest zufällig.
 * Aufgabentyp nach Fach. Die Antworten ändern die Fächer. Hat `startFinalStation` die Karten schon gewählt, gilt diese Auswahl,
 * und Karten, die in `finalRun.answered` stehen, fehlen (`total` zählt nur den Rest). Das Ergebnis speichert `finishFinalReview`.
 */
export function buildFinalStationRound(progress: Progress, rng: Rng, env: TaskEnv, day?: Day): RoundState {
  const run = progress.finalRun;
  const answered = new Set(run?.answered ?? []);
  const ids = (run ? run.ids : pickFinalStationIds(progress, rng, day)).filter((id) => !answered.has(id) && getItem(id) !== undefined);
  return createRound(tasksForCards(progress, ids, rng, env), { finalStation: true });
}

/** Ergebnis der Endstation speichern (Endstation abgeschlossen). `finalRun` entfällt. */
export function finishFinalReview(progress: Progress, right: number, total: number, now: Clock): Progress {
  const { finalRun: _run, ...rest } = progress;
  return { ...rest, finalReview: { at: now().toISOString(), right, total } };
}

/**
 * Karten, die heute falsch beantwortet wurden und morgen wiederkommen: heute gesehen, Fach 1, fällig morgen (2.9, Punkt 6).
 * Leitet die Liste aus dem Lernstand ab, damit sie nach einem Neuladen stimmt. Reihenfolge wie im Kurs.
 */
export function wrongTodayIds(progress: Progress, day: Day): string[] {
  const tomorrow = addDays(day, 1);
  return allItems
    .map((item) => item.id)
    .filter((id) => {
      const card = progress.cards[id];
      return card !== undefined && card.lastSeen === day && card.box === 1 && card.due === tomorrow;
    });
}

/**
 * Richtige Antworten unter den Aufgaben, die laut `units[unitId].answered` schon beantwortet sind. Nur für Kartenaufgaben
 * (`recognize:<id>`) und nur, wenn die Karte heute gesehen wurde, lässt sich das sicher ableiten: Falsch heißt Fach 1, fällig morgen.
 * Bei Satzbau-Aufgaben (ohne Karte) oder Karten von einem anderen Tag gibt es `null`.
 */
export function rightAmongAnswered(progress: Progress, answeredTaskIds: readonly string[], day: Day): number | null {
  const wrong = new Set(wrongTodayIds(progress, day));
  let right = 0;
  for (const taskId of answeredTaskIds) {
    if (!taskId.startsWith("recognize:")) return null;
    const itemId = taskId.slice("recognize:".length);
    if (progress.cards[itemId]?.lastSeen !== day) return null;
    if (!wrong.has(itemId)) right++;
  }
  return right;
}
