import { describe, expect, it } from "vitest";
import { allItems } from "./content";
import { createRng } from "./random";
import { answerInRound, createRound, currentTask, isRepeat, isRoundDone } from "./round";
import type { RoundState } from "./round";
import { makeItemTask } from "./tasks";
import type { RoundTask } from "./tasks";
import { freshProgress, makeClock } from "./testkit";
import type { Progress } from "./types";

const clock = makeClock("2026-11-23");
const env = { hasSpanishVoice: true };

function tasks(n: number): RoundTask[] {
  return allItems.slice(0, n).map((item) => makeItemTask(item, "recognize", createRng(1), env));
}

function run(answers: boolean[], n: number): { order: string[]; progress: Progress; round: RoundState } {
  let progress = freshProgress(clock);
  let round = createRound(tasks(n));
  const order: string[] = [];
  for (const correct of answers) {
    const task = currentTask(round);
    if (!task) break;
    order.push(task.id);
    ({ progress, round } = answerInRound(progress, round, correct, clock.now));
  }
  return { order, progress, round };
}

describe("Wiederholrunde mit Wiedervorlage", () => {
  const ids = tasks(10).map((task) => task.id);

  it("eine falsche Karte kommt frühestens nach drei anderen erneut", () => {
    const { order } = run([false, true, true, true, true], 10);
    expect(order[0]).toBe(ids[0]);
    expect(order.slice(1, 4)).toEqual([ids[1], ids[2], ids[3]]);
    expect(order[4]).toBe(ids[0]);
  });

  it("höchstens zweimal, danach nicht mehr", () => {
    const answers = new Array<boolean>(40).fill(false);
    const { order, round } = run(answers, 5);
    const first = tasks(5)[0]!.id;
    expect(order.filter((id) => id === first)).toHaveLength(3);
    expect(isRoundDone(round)).toBe(true);
  });

  it("Wiedervorlagen ändern Fach und Punkte nicht, nur die erste Antwort zählt", () => {
    const first = allItems[0]!.id;
    let progress = freshProgress(clock);
    let round = createRound(tasks(5));
    ({ progress, round } = answerInRound(progress, round, false, clock.now));
    expect(progress.cards[first]).toMatchObject({ box: 1, due: "2026-11-24", wrong: 1, right: 0 });
    expect(progress.stats.points).toBe(0);
    // Wiedervorlage erreichen und richtig beantworten
    for (let i = 0; i < 3; i++) ({ progress, round } = answerInRound(progress, round, true, clock.now));
    const pointsBefore = progress.stats.points;
    expect(pointsBefore).toBe(30);
    expect(isRepeat(round)).toBe(true);
    ({ progress, round } = answerInRound(progress, round, true, clock.now));
    expect(progress.cards[first]).toMatchObject({ box: 1, due: "2026-11-24", wrong: 1, right: 0 });
    expect(progress.stats.points).toBe(pointsBefore);
  });

  it("Zähler: total ohne Wiedervorlagen, completed nur erste Antworten", () => {
    const { round } = run([false, true, true], 6);
    expect(round.total).toBe(6);
    expect(round.completed).toBe(3);
    expect(round.right).toBe(2);
    expect(round.wrong).toBe(1);
    expect(round.queue).toHaveLength(4);
  });

  it("richtige erste Antwort: ein Fach höher und 10 Punkte", () => {
    const { progress } = run([true], 3);
    expect(progress.cards[allItems[0]!.id]).toMatchObject({ box: 2, due: "2026-11-24", right: 1 });
    expect(progress.stats.points).toBe(10);
  });
});
