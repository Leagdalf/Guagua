import { describe, expect, it } from "vitest";
import { extraRoundIds, oftenWrongCards, reviewLimit, reviewRoundIds } from "./cards";
import {
  EXTRA_ROUND_CARDS,
  MAX_WRITE_TASKS_PER_ROUND,
  OFTEN_WRONG,
  REVIEW_ROUND,
  REVIEW_ROUND_AFTER_FINAL,
  SAY_TASK_ENABLED,
  WRITE_EXCLUDED_ITEM_IDS,
} from "./config";
import { allItems, getItem } from "./content";
import { buildExtraRound, buildReviewRound } from "./flow";
import { createRng } from "./random";
import { freshProgress, makeClock } from "./testkit";
import { evaluateWrite, isWritable, makeItemTask, makeReviewTask, taskTypeForReview } from "./tasks";
import type { WriteTask } from "./tasks";
import type { Box, CardProgress, Progress } from "./types";
import { sessionPlan, todayPlan } from "./units";

const env = { hasSpanishVoice: true };

/** Fortschritt mit Karten der ersten drei Haltestellen (abgeschlossen) in den gegebenen Fächern, alle heute fällig. */
function progressWith(count: number, boxOf: (i: number) => Box, wrongOf: (i: number) => number = () => 0): Progress {
  const clock = makeClock("2026-11-23");
  const base = freshProgress(clock);
  const cards: Record<string, CardProgress> = {};
  allItems.slice(0, count).forEach((item, i) => {
    cards[item.id] = { box: boxOf(i), due: "2026-11-22", right: 1, wrong: wrongOf(i), lastSeen: "2026-11-21" };
  });
  const units: Progress["units"] = {};
  for (const id of ["u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08"]) {
    units[id] = { step: 6, startedAt: "2026-11-01T10:00:00.000Z", completedAt: "2026-11-02T10:00:00.000Z" };
  }
  return { ...base, cards, units };
}

describe("Faire Schreibaufgaben: Ausschlussliste", () => {
  it("jede id der Liste ist eine vorhandene Karte, keine kommt doppelt vor", () => {
    expect(WRITE_EXCLUDED_ITEM_IDS).toHaveLength(24);
    expect(new Set(WRITE_EXCLUDED_ITEM_IDS).size).toBe(WRITE_EXCLUDED_ITEM_IDS.length);
    for (const id of WRITE_EXCLUDED_ITEM_IDS) expect(getItem(id), id).toBeDefined();
  });

  it("Karten der Liste und Satzmuster kommen in keinem Fach als Schreiben oder Sag es laut, sondern als Erinnern", () => {
    const cannot = allItems.filter((item) => !isWritable(item));
    expect(cannot.length).toBeGreaterThanOrEqual(WRITE_EXCLUDED_ITEM_IDS.length);
    for (const item of cannot) {
      for (const box of [3, 4, 5] as const) {
        for (const writesSoFar of [0, MAX_WRITE_TASKS_PER_ROUND]) {
          expect(taskTypeForReview(item, box, env, writesSoFar), item.id).toBe("recall");
          const task = makeReviewTask(item.id, box, createRng(1), env, writesSoFar);
          expect(task.kind, item.id).toBe("choice");
          expect(task.type, item.id).toBe("recall");
        }
      }
      expect(makeItemTask(item, "write", createRng(1), env).type).toBe("recall");
      expect(makeItemTask(item, "say", createRng(1), env).type).toBe("recall");
    }
  });

  it("für jede Karte, die als Schreibaufgabe vorkommen kann, ist die getippte Lösung richtig, und keine Lösung enthält …, / oder Klammern", () => {
    const writable = allItems.filter(isWritable);
    expect(writable.length).toBeGreaterThan(100);
    for (const item of writable) {
      const task = makeItemTask(item, "write", createRng(1), env) as WriteTask;
      expect(task.kind, item.id).toBe("write");
      expect(task.solution, item.id).toBe(item.es);
      expect(evaluateWrite(task, task.solution), item.id).toMatchObject({ correct: true });
      expect(task.solution, `${item.id}: ${task.solution}`).not.toMatch(/…|\/|\(|\)/);
    }
  });
});

describe("Verteilung der Aufgabentypen ab Fach 3", () => {
  const word = allItems.find((item) => isWritable(item))!;

  it("bis zur Grenze „Schreiben“, danach „Sag es laut“; ausgeschaltet kommt „Erinnern“", () => {
    expect(SAY_TASK_ENABLED).toBe(true);
    expect(taskTypeForReview(word, 3, env, MAX_WRITE_TASKS_PER_ROUND - 1)).toBe("write");
    expect(taskTypeForReview(word, 3, env, MAX_WRITE_TASKS_PER_ROUND)).toBe("say");
    expect(taskTypeForReview(word, 5, env, MAX_WRITE_TASKS_PER_ROUND)).toBe("say");
    expect(taskTypeForReview(word, 3, { ...env, sayEnabled: false }, MAX_WRITE_TASKS_PER_ROUND)).toBe("recall");
    for (const box of [1, 2] as const) expect(taskTypeForReview(word, box, env, MAX_WRITE_TASKS_PER_ROUND)).not.toBe("say");
    // Ohne Stimme zählt Fach 2 wie bisher als „Erkennen“, „Sag es laut“ geht trotzdem.
    expect(taskTypeForReview(word, 3, { hasSpanishVoice: false }, MAX_WRITE_TASKS_PER_ROUND)).toBe("say");
  });

  it("die Aufgabe „Sag es laut“ trägt Deutsch als Frage, die spanische Lösung und den Hinweis der Karte", () => {
    const item = allItems.find((entry) => isWritable(entry) && entry.note_de)!;
    const task = makeItemTask(item, "say", createRng(1), env);
    expect(task).toMatchObject({ kind: "say", type: "say", itemId: item.id, prompt: item.de, promptLang: "de", solution: item.es, speak: item.es, note: item.note_de });
  });

  it("eine Wiederholrunde hat höchstens sechs Schreibaufgaben, die weiteren Wörter und Wendungen sind „Sag es laut“, Satzmuster „Erinnern“", () => {
    const progress = progressWith(80, () => 4);
    const round = buildReviewRound(progress, "2026-11-23", createRng(3), env);
    expect(round.total).toBe(REVIEW_ROUND.maxCards);
    const types = round.queue.map((task) => task.type);
    expect(types.filter((type) => type === "write")).toHaveLength(MAX_WRITE_TASKS_PER_ROUND);
    expect(types.filter((type) => type === "say").length).toBeGreaterThan(0);
    let writes = 0;
    for (const task of round.queue) {
      const item = getItem(task.itemId!)!;
      if (!isWritable(item)) expect(task.type).toBe("recall");
      else if (writes < MAX_WRITE_TASKS_PER_ROUND) {
        expect(task.type).toBe("write");
        writes++;
      } else expect(task.type).toBe("say");
    }
  });
});

describe("Falsche Karten für den Spickzettel", () => {
  it("höchstens zehn Karten mit mindestens zwei Fehlern, die mit den meisten zuerst", () => {
    const progress = progressWith(40, () => 2, (i) => (i % 4 === 0 ? 2 + (i % 7) : i % 4 === 1 ? 1 : 0));
    const list = oftenWrongCards(progress);
    expect(list.length).toBeLessThanOrEqual(OFTEN_WRONG.maxCards);
    expect(list.length).toBeGreaterThan(0);
    for (const row of list) expect(row.wrong).toBeGreaterThanOrEqual(OFTEN_WRONG.minWrong);
    for (let i = 1; i < list.length; i++) expect(list[i - 1]!.wrong).toBeGreaterThanOrEqual(list[i]!.wrong);
    expect(new Set(list.map((row) => row.item.id)).size).toBe(list.length);
  });

  it("eine einzige falsche Antwort genügt nicht; ohne Fehler ist die Liste leer", () => {
    expect(oftenWrongCards(progressWith(20, () => 2, () => 1))).toEqual([]);
    expect(oftenWrongCards(progressWith(20, () => 2, () => 0))).toEqual([]);
    const one = progressWith(20, () => 2, (i) => (i === 3 ? 2 : 0));
    expect(oftenWrongCards(one).map((row) => row.item.id)).toEqual([allItems[3]!.id]);
  });
});

describe("„10 Karten extra“", () => {
  it("wählt mit anderem Zufall andere Karten, mit demselben Startwert dieselben", () => {
    const progress = progressWith(60, () => 3);
    const pick = (seed: number) => extraRoundIds(progress, "2026-11-23", EXTRA_ROUND_CARDS, createRng(seed));
    expect(pick(1)).toHaveLength(EXTRA_ROUND_CARDS);
    expect(pick(1)).toEqual(pick(1));
    const picks = new Set([1, 2, 3, 4, 5].map((seed) => pick(seed).join(",")));
    expect(picks.size).toBeGreaterThan(1);
  });

  it("nimmt Karten in niedrigen Fächern zuerst", () => {
    const progress = progressWith(60, (i) => ((i % 5) + 1) as Box);
    for (const seed of [1, 2, 3]) {
      const ids = extraRoundIds(progress, "2026-11-23", EXTRA_ROUND_CARDS, createRng(seed));
      const used = ids.map((id) => progress.cards[id]!.box);
      expect(used).toEqual([...used].sort((a, b) => a - b));
      // Zwölf Karten liegen in Fach 1: Alle zehn stammen aus Fach 1.
      expect(new Set(used)).toEqual(new Set([1]));
    }
    const few = progressWith(60, (i) => (i < 4 ? 1 : 3));
    const ids = extraRoundIds(few, "2026-11-23", EXTRA_ROUND_CARDS, createRng(9));
    expect(ids.slice(0, 4).every((id) => few.cards[id]!.box === 1)).toBe(true);
    expect(ids.slice(4).every((id) => few.cards[id]!.box === 3)).toBe(true);
  });

  it("die freie Runde baut sich bei jedem Start neu, ohne Zufall zählt `extraRoundIds` nur", () => {
    const progress = progressWith(60, () => 3);
    const a = buildExtraRound(progress, "2026-11-23", createRng(1), env);
    const b = buildExtraRound(progress, "2026-11-23", createRng(2), env);
    expect(a.total).toBe(EXTRA_ROUND_CARDS);
    expect(a.queue.map((task) => task.itemId)).not.toEqual(b.queue.map((task) => task.itemId));
    expect(extraRoundIds(progress, "2026-11-23")).toHaveLength(EXTRA_ROUND_CARDS);
  });
});

describe("Nach der Endstation", () => {
  it("die Wiederholrunde hat höchstens 20 Karten, vorher 40; `sessionPlan` und `todayPlan` rechnen mit 20", () => {
    const before = progressWith(60, () => 2);
    expect(reviewLimit(before)).toBe(REVIEW_ROUND.maxCards);
    const after: Progress = { ...before, finalReview: { at: "2026-11-20T10:00:00.000Z", right: 20, total: 30 } };
    expect(reviewLimit(after)).toBe(REVIEW_ROUND_AFTER_FINAL);
    expect(REVIEW_ROUND_AFTER_FINAL).toBe(20);
    expect(reviewRoundIds(before, "2026-11-23")).toHaveLength(REVIEW_ROUND.maxCards);
    expect(reviewRoundIds(after, "2026-11-23")).toHaveLength(REVIEW_ROUND_AFTER_FINAL);
    expect(buildReviewRound(after, "2026-11-23", createRng(1), env).total).toBe(REVIEW_ROUND_AFTER_FINAL);
    expect(sessionPlan(after, null, "2026-11-23").reviewCount).toBe(REVIEW_ROUND_AFTER_FINAL);
    expect(todayPlan(after, "2026-11-23")).toMatchObject({ reviewPending: true, reviewCount: REVIEW_ROUND_AFTER_FINAL, dueCount: 60 });
    expect(todayPlan(before, "2026-11-23").reviewCount).toBe(REVIEW_ROUND.maxCards);
  });
});
