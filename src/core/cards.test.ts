import { describe, expect, it } from "vitest";
import { dueCardIds, extraRoundIds, gradeCard, isRoundTimeUp, newCard, reviewRoundIds } from "./cards";
import { BOX_INTERVAL_DAYS, REVIEW_ROUND } from "./config";
import { allItems, units } from "./content";
import { buildFinalRound, buildReviewRound } from "./flow";
import { createRng } from "./random";
import { answerInRound, currentTask, isRoundDone } from "./round";
import type { RoundState } from "./round";
import { freshProgress, makeClock } from "./testkit";
import { addDays, today } from "./time";
import { completeStep, startUnit } from "./units";
import type { Box, CardProgress, Progress } from "./types";

describe("Karteikasten", () => {
  it("Abstände 0, 1, 3, 6, 12 Tage", () => {
    expect(BOX_INTERVAL_DAYS).toEqual({ 1: 0, 2: 1, 3: 3, 4: 6, 5: 12 });
    let card = newCard("2026-11-23");
    expect(card).toMatchObject({ box: 1, due: "2026-11-23" });
    const expected: [Box, string][] = [
      [2, "2026-11-24"],
      [3, "2026-11-26"],
      [4, "2026-11-29"],
      [5, "2026-12-05"],
      [5, "2026-12-05"],
    ];
    for (const [box, due] of expected) {
      card = gradeCard(card, true, "2026-11-23");
      expect(card.box).toBe(box);
      expect(card.due).toBe(due);
    }
    expect(card.right).toBe(5);
  });

  it("richtig hebt um ein Fach, falsch setzt auf Fach 1 mit Fälligkeit morgen", () => {
    const card: CardProgress = { box: 4, due: "2026-11-23", right: 3, wrong: 0, lastSeen: "2026-11-20" };
    expect(gradeCard(card, true, "2026-11-23")).toMatchObject({ box: 5, due: "2026-12-05", right: 4, lastSeen: "2026-11-23" });
    expect(gradeCard(card, false, "2026-11-23")).toMatchObject({ box: 1, due: "2026-11-24", wrong: 1, lastSeen: "2026-11-23" });
  });

  it("addDays rechnet über Monats-, Jahres- und Schaltjahresgrenzen", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

function progressWithCards(cards: Record<string, CardProgress>): Progress {
  const clock = makeClock();
  const base = freshProgress(clock);
  // Alle Haltestellen als abgeschlossen markieren, damit die Karten als gelernt gelten.
  const unitsDone = Object.fromEntries(units.map((u) => [u.id, { step: 6 as const, startedAt: "x", completedAt: "2026-11-20T10:00:00.000Z" }]));
  return { ...base, cards, units: unitsDone };
}

describe("Wiederholrunde", () => {
  it("sortiert nach Fach, dann Fälligkeit, und endet bei 40 Karten", () => {
    const cards: Record<string, CardProgress> = {};
    allItems.slice(0, 60).forEach((item, i) => {
      const box = ((i % 5) + 1) as Box;
      const due = addDays("2026-11-10", i % 7); // alle fällig
      cards[item.id] = { box, due, right: 0, wrong: 0, lastSeen: due };
    });
    const progress = progressWithCards(cards);
    const all = dueCardIds(progress, "2026-11-30");
    expect(all).toHaveLength(60);
    for (let i = 1; i < all.length; i++) {
      const a = cards[all[i - 1] as string] as CardProgress;
      const b = cards[all[i] as string] as CardProgress;
      expect(a.box < b.box || (a.box === b.box && a.due <= b.due)).toBe(true);
    }
    const round = reviewRoundIds(progress, "2026-11-30");
    expect(round).toHaveLength(REVIEW_ROUND.maxCards);
    expect(round).toEqual(all.slice(0, 40));
  });

  it("Karten mit späterer Fälligkeit und Karten unabgeschlossener Haltestellen sind nicht fällig", () => {
    const [a, b] = allItems as [(typeof allItems)[number], (typeof allItems)[number]];
    const progress = progressWithCards({
      [a.id]: { box: 2, due: "2026-11-24", right: 1, wrong: 0, lastSeen: "2026-11-23" },
      [b.id]: { box: 1, due: "2026-11-23", right: 0, wrong: 0, lastSeen: "2026-11-23" },
    });
    expect(dueCardIds(progress, "2026-11-23")).toEqual([b.id]);
    const open = { ...progress, units: {} };
    expect(dueCardIds(open, "2026-11-23")).toEqual([]);
  });

  it("die freie Runde nimmt erst fällige, dann die übrigen gelernten Karten", () => {
    const ids = allItems.slice(0, 12).map((item) => item.id);
    const cards: Record<string, CardProgress> = {};
    ids.forEach((id, i) => {
      cards[id] = { box: 2, due: i < 3 ? "2026-11-23" : "2026-12-01", right: 1, wrong: 0, lastSeen: "2026-11-22" };
    });
    const picked = extraRoundIds(progressWithCards(cards), "2026-11-23");
    expect(picked).toHaveLength(10);
    expect(picked.slice(0, 3)).toEqual(ids.slice(0, 3));
  });
});

describe("Simulation über elf Tage", () => {
  const env = { hasSpanishVoice: true };

  function drain(progress: Progress, round: RoundState, now: () => Date): Progress {
    let p = progress;
    let r = round;
    while (!isRoundDone(r)) {
      expect(currentTask(r)).not.toBeNull();
      ({ progress: p, round: r } = answerInRound(p, r, true, now));
    }
    return p;
  }

  function simulate(): number[] {
    const clock = makeClock("2026-11-23");
    const rng = createRng(7);
    let progress = freshProgress(clock);
    const reviewed: number[] = [];
    for (let dayIndex = 0; dayIndex < 11; dayIndex++) {
      const unit = units[dayIndex];
      const day = today(clock.now);
      if (unit) progress = startUnit(progress, unit.id, clock.now);
      const round = buildReviewRound(progress, day, rng, env);
      reviewed.push(round.total);
      progress = drain(progress, round, clock.now);
      if (unit) {
        if (progress.units[unit.id]?.step === 1) progress = completeStep(progress, unit.id, 1, clock.now);
        progress = completeStep(progress, unit.id, 2, clock.now);
        progress = completeStep(progress, unit.id, 3, clock.now);
        progress = completeStep(progress, unit.id, 4, clock.now);
        progress = drain(progress, buildFinalRound(progress, unit.id, rng, env), clock.now);
        progress = completeStep(progress, unit.id, 5, clock.now);
      }
      clock.advance(1);
    }
    return reviewed;
  }

  it("lauter richtige Antworten ergeben 0, 16, 15, 15, 32, 30, 31, 31, 31, 31, 40", () => {
    expect(simulate()).toEqual([0, 16, 15, 15, 32, 30, 31, 31, 31, 31, 40]);
  });

  it("stimmt mit einem Nachbau der Rechnung von tools/simulate-reviews.mjs bei Grenze 40 überein", () => {
    // Das Skript selbst läuft hier nicht (kein node:-Import in Tests). Der Nachbau rechnet: neue Karten nach der
    // Abschlussrunde in Fach 2 (richtig), niedrigstes Fach zuerst.
    const interval: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 6, 5: 12 };
    const cards: { box: number; due: number }[] = [];
    const reference: number[] = [];
    for (let day = 1; day <= units.length + 1; day++) {
      const due = cards.filter((c) => c.due <= day).sort((a, b) => a.box - b.box || a.due - b.due);
      const todo = due.slice(0, 40);
      for (const c of todo) {
        c.box = Math.min(c.box + 1, 5);
        c.due = day + (interval[c.box] as number);
      }
      for (let i = 0; i < (units[day - 1]?.items.length ?? 0); i++) cards.push({ box: 2, due: day + 1 });
      reference.push(todo.length);
    }
    expect(reference).toEqual([0, 16, 15, 15, 32, 30, 31, 31, 31, 31, 40]);
    expect(simulate()).toEqual(reference);
  });
});

describe("Zeitgrenze der Wiederholrunde", () => {
  it("isRoundTimeUp: nach 6 Minuten wahr, knapp davor falsch", () => {
    const start = 1_000_000;
    expect(isRoundTimeUp(start, start)).toBe(false);
    expect(isRoundTimeUp(start, start + REVIEW_ROUND.maxMinutes * 60_000 - 1)).toBe(false);
    expect(isRoundTimeUp(start, start + REVIEW_ROUND.maxMinutes * 60_000)).toBe(true);
    expect(isRoundTimeUp(start, start + 60 * 60_000)).toBe(true);
  });
});

