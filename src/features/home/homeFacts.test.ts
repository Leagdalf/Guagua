import { describe, expect, it } from "vitest";
import { EXTRA_ROUND_CARDS, FINAL_REVIEW } from "../../core/config";
import { units } from "../../core/content";
import { finishReviewRound, completeMission, skipMission, todayPlan } from "../../core/units";
import type { TodayPlan } from "../../core/units";
import type { Progress } from "../../core/types";
import { formatDayMonthDe, weekdayDe } from "./dateText";
import { finalDoneToday, nextReview, nextReviewSentence, pinnedMissionId, planSentence, waitingSentence } from "./homeFacts";
import { completeUnit, newClock, newProgress } from "./testProgress";
import { plainText, todayBlock } from "./todayBlock";

/** Haltestelle 1 am ersten Tag, Haltestelle 2 drei Tage später (der Tag zählt für die Mission von Haltestelle 2). */
function twoUnits() {
  const clock = newClock("2026-11-23");
  let p = completeUnit(newProgress(clock), "u01", clock.now);
  clock.set("2026-11-26");
  p = completeUnit(p, "u02", clock.now);
  return { clock, progress: p };
}

describe("Angeheftete Mission", () => {
  it("nur die Mission der zuletzt abgeschlossenen Haltestelle, am Tag des Abschlusses, am Tag danach und am übernächsten", () => {
    const { progress } = twoUnits();
    expect(pinnedMissionId(progress, "2026-11-26")).toBe("u02-m");
    expect(pinnedMissionId(progress, "2026-11-27")).toBe("u02-m");
    expect(pinnedMissionId(progress, "2026-11-28")).toBe("u02-m");
    // Am dritten Tag ist sie nicht mehr angeheftet.
    expect(pinnedMissionId(progress, "2026-11-29")).toBeNull();
  });

  it("die ältere offene Mission (Haltestelle 1) steht nie auf der Startseite, ist aber weiter offen", () => {
    const { progress } = twoUnits();
    expect(pinnedMissionId(progress, "2026-11-26")).not.toBe("u01-m");
    expect(todayPlan(progress, "2026-11-26").openMissionId).toBe("u02-m");
    const withoutNewest = completeMission(progress, "u02-m", () => new Date(2026, 10, 26, 12));
    expect(pinnedMissionId(withoutNewest, "2026-11-26")).toBeNull();
    expect(todayPlan(withoutNewest, "2026-11-26").openMissionId).toBe("u01-m");
  });

  it("erledigt oder übersprungen: nichts angeheftet", () => {
    const clock = newClock("2026-11-23");
    const p = completeUnit(newProgress(clock), "u01", clock.now);
    expect(pinnedMissionId(p, "2026-11-23")).toBe("u01-m");
    expect(pinnedMissionId(skipMission(p, "u01-m", clock.now), "2026-11-23")).toBeNull();
    expect(pinnedMissionId(completeMission(p, "u01-m", clock.now), "2026-11-23")).toBeNull();
  });

  it("ohne abgeschlossene Haltestelle nichts", () => {
    expect(pinnedMissionId(newProgress(newClock()), "2026-11-23")).toBeNull();
  });

  it("Nur Mission offen richtet sich danach: ist die offene Mission nicht angeheftet, heißt der Zustand „Alles erledigt“", () => {
    const { progress } = twoUnits();
    const done = finishReviewRound(completeMission(progress, "u02-m", () => new Date(2026, 10, 26, 12)), "2026-11-26");
    const plan = todayPlan(done, "2026-11-26");
    expect(plan.kind).toBe("missionOnly");
    const unpinned = todayBlock(plan, true, { missionPinned: pinnedMissionId(done, "2026-11-26") !== null });
    expect(plainText(unpinned.text)).toBe("Morgen: Haltestelle 3, Los números");
    expect(unpinned.button).toBe(`${EXTRA_ROUND_CARDS} Karten extra`);
    const pinned = todayBlock(todayPlan(finishReviewRound(progress, "2026-11-26"), "2026-11-26"), true, { missionPinned: true });
    expect(pinned.button).toBe("Mission ansehen");
  });
});

describe("Nach der Endstation", () => {
  function afterFinal(finalAt: string, day: string, dues: Record<string, number>): { progress: Progress; day: string } {
    const clock = newClock("2026-11-23");
    let p = newProgress(clock);
    for (const unit of units) p = completeUnit(p, unit.id, clock.now);
    p = { ...p, finalReview: { at: finalAt, right: 26, total: 30 } };
    // Karten auf Tage verteilen: die ersten n auf den ersten Tag, die nächsten auf den zweiten; die letzte Angabe nimmt den Rest.
    const plan = Object.entries(dues);
    const cards = { ...p.cards };
    Object.keys(cards).forEach((id, index) => {
      let sum = 0;
      let chosen = plan[plan.length - 1]![0];
      for (const [d, n] of plan) {
        sum += n;
        if (index < sum) {
          chosen = d;
          break;
        }
      }
      cards[id] = { ...cards[id]!, due: chosen };
    });
    return { progress: finishReviewRound({ ...p, cards }, day), day };
  }

  it("nächste Wiederholung mit Wochentag und Zahl der Karten", () => {
    const { progress, day } = afterFinal("2026-11-23T10:00:00.000Z", "2026-11-24", { "2026-11-28": 12, "2026-12-20": 999 });
    expect(nextReview(progress, day)).toEqual({ day: "2026-11-28", count: 12 });
    const b = todayBlock(todayPlan(progress, day), true, { day, nextReview: nextReview(progress, day), finalDoneToday: finalDoneToday(progress, day) });
    expect(b.title).toBe("Für heute fertig");
    expect(plainText(b.text)).toBe("Nächste Wiederholung: Samstag, 12 Karten.");
    expect(b.button).toBe("Deine Linie ansehen");
    expect(b.action).toEqual({ type: "final-line" });
  });

  it("am Tag der Endstation bleibt das Ergebnis, danach folgt die nächste Wiederholung", () => {
    const day = "2026-11-23";
    const { progress } = afterFinal(new Date(2026, 10, 23, 12).toISOString(), day, { "2026-11-26": 154 });
    expect(finalDoneToday(progress, day)).toBe(true);
    const b = todayBlock(todayPlan(progress, day), true, { day, nextReview: nextReview(progress, day), finalDoneToday: true });
    expect(b.title).toBe("Linie geschafft");
    expect(plainText(b.text)).toBe("26 von 30 richtig an der Endstation. Nächste Wiederholung: Donnerstag, 154 Karten.");
  });

  it("ab einer Woche Abstand steht das Datum dabei, eine einzelne Karte heißt „1 Karte“", () => {
    expect(nextReviewSentence({ day: "2026-12-05", count: 3 }, "2026-11-24")).toBe("Nächste Wiederholung: Samstag, 5. Dezember, 3 Karten.");
    expect(nextReviewSentence({ day: "2026-11-30", count: 1 }, "2026-11-24")).toBe("Nächste Wiederholung: Montag, 1 Karte.");
  });

  it("bleiben nach der heutigen Runde Karten fällig, sagt der Block, wie viele warten und dass morgen die nächsten kommen", () => {
    const { progress, day } = afterFinal("2026-11-20T10:00:00.000Z", "2026-11-24", { "2026-11-24": 40, "2026-12-20": 999 });
    const plan = todayPlan(progress, day);
    expect(plan.kind).not.toBe("work");
    expect(plan.dueCount).toBe(40);
    const b = todayBlock(plan, true, { day, nextReview: nextReview(progress, day), finalDoneToday: false });
    expect(plainText(b.text)).toBe("40 Karten warten, morgen kommen die nächsten.");
    expect(b.button).toBe("Deine Linie ansehen");
    expect(waitingSentence(1)).toBe("1 Karte wartet, morgen kommen die nächsten.");
  });

  it("nur Karten aus abgeschlossenen Haltestellen zählen", () => {
    const clock = newClock();
    const p = completeUnit(newProgress(clock), "u01", clock.now);
    const withOther = { ...p, cards: { ...p.cards, "u02-i01": { box: 1 as const, due: "2026-11-24", right: 0, wrong: 0, lastSeen: "2026-11-23" } } };
    expect(nextReview(withOther, "2026-11-23")?.day).not.toBe("2026-11-24");
  });
});

describe("Abgleich mit dem Plan", () => {
  it("liegt der Kurs im Plan, steht nichts", () => {
    const clock = newClock("2026-11-23");
    const one = completeUnit(newProgress(clock), "u01", clock.now);
    // 23.11.: 9 offen, 9 Tage von morgen bis zum 2.12.
    expect(planSentence(one, "2026-11-23")).toBeNull();
    // 24.11. mit zwei geschafften: 8 offen, 8 Tage.
    expect(planSentence(completeUnit(one, "u02", clock.now), "2026-11-24")).toBeNull();
  });

  it("mehr offene Haltestellen als Tage bis zum letzten Haltestellentag (heute eingeschlossen): der Satz mit dem Datum in Worten", () => {
    const clock = newClock("2026-11-27");
    const one = completeUnit(newProgress(clock), "u01", clock.now);
    expect(planSentence(one, "2026-11-27")).toBe("Bis zum 2. Dezember sind es noch 9 Haltestellen in 5 Tagen.");
    // Fehlt genau eine Haltestelle gegenüber dem Plan, steht der Satz; eine weniger, und er entfällt.
    expect(planSentence(one, "2026-11-30")).toBe("Bis zum 2. Dezember sind es noch 9 Haltestellen in 2 Tagen.");
    expect(planSentence(one, "2026-12-01")).toBe("Bis zum 2. Dezember sind es noch 9 Haltestellen in 1 Tag.");
    const sixOpen = ["u02", "u03", "u04"].reduce((acc, id) => completeUnit(acc, id, clock.now), one);
    expect(planSentence(sixOpen, "2026-11-27")).toBe("Bis zum 2. Dezember sind es noch 6 Haltestellen in 5 Tagen.");
    const fiveOpen = completeUnit(sixOpen, "u05", clock.now);
    expect(planSentence(fiveOpen, "2026-11-27")).toBeNull();
  });

  it("am letzten Plantag mit offenen Haltestellen steht kein „in 0 Tagen“, sondern dass der Plan heute endet", () => {
    const clock = newClock("2026-12-02");
    const one = completeUnit(newProgress(clock), "u01", clock.now);
    expect(planSentence(one, "2026-12-02")).toBe("Der Plan endet heute, es sind noch 9 Haltestellen offen.");
    expect(planSentence(one, "2026-12-02")).not.toContain("0 Tagen");
  });

  it("ist der Plan vorbei, steht nichts", () => {
    const clock = newClock("2026-12-05");
    expect(planSentence(newProgress(clock), "2026-12-05")).toBeNull();
    expect(planSentence(newProgress(clock), "2026-12-03")).toBeNull();
  });

  it("Datum in Worten", () => {
    expect(formatDayMonthDe("2026-12-02")).toBe("2. Dezember");
    expect(weekdayDe("2026-11-28")).toBe("Samstag");
  });

  it("im Zustand „Für heute fertig“ steht der Satz in der Erklärzeile und der Textknopf „Noch eine Haltestelle“ beginnt die nächste offene Haltestelle", () => {
    const clock = newClock("2026-11-27");
    const p = finishReviewRound(completeUnit(newProgress(clock), "u01", clock.now), clock.current());
    const plan = todayPlan(p, clock.current());
    const sentence = planSentence(p, clock.current());
    expect(sentence).not.toBeNull();
    const mission = todayBlock(plan, true, { planSentence: sentence });
    expect(plainText(mission.text)).toBe(
      "Morgen geht es weiter mit Haltestelle 2, En el café. Draußen wartet deine Mission. Bis zum 2. Dezember sind es noch 9 Haltestellen in 5 Tagen.",
    );
    expect(mission.secondary).toEqual({ label: "Noch eine Haltestelle", action: { type: "session", request: { kind: "day", unitId: "u02" } } });
    const done = todayBlock(todayPlan(completeMission(p, "u01-m", clock.now), clock.current()), true, { planSentence: sentence });
    expect(plainText(done.text)).toBe("Morgen: Haltestelle 2, En el café. Bis zum 2. Dezember sind es noch 9 Haltestellen in 5 Tagen.");
    expect(done.secondary?.label).toBe("Noch eine Haltestelle");
    // Im Plan: kein Satz, kein Knopf.
    const quiet = todayBlock(plan, true, { planSentence: null });
    expect(quiet.secondary).toBeNull();
    expect(plainText(quiet.text)).not.toContain("Bis zum");
  });

  it("nur im Zustand „Für heute fertig“, nicht bei Arbeit", () => {
    const clock = newClock("2026-11-27");
    const p = newProgress(clock);
    const b = todayBlock(todayPlan(p, clock.current()), true, { planSentence: "Bis zum 2. Dezember sind es noch 10 Haltestellen in 6 Tagen." });
    expect(b.secondary).toBeNull();
    expect(plainText(b.text)).not.toContain("Bis zum");
  });
});

describe("Satzzeichen nach Namen auf „?“ oder „!“ und feste Zahlen", () => {
  const base: Omit<TodayPlan, "kind" | "nextUnitId" | "openMissionId"> = {
    dueCount: 0,
    reviewPending: false,
    reviewCount: 0,
    unitId: null,
    unitState: null,
    unitStep: null,
    newCardCount: 0,
    finalStationOpen: false,
    finalResult: null,
  };
  const sentence = "Bis zum 2. Dezember sind es noch 6 Haltestellen in 5 Tagen.";

  it("alle zehn Namen, in allen Sätzen des Blocks: kein „?.“, kein „!.“, kein „..“, jeder Satz endet mit Satzzeichen oder ist der Namenszusatz der Tabelle", () => {
    for (const unit of units) {
      const variants: string[] = [];
      for (const planLine of [null, sentence]) {
        for (const kind of ["missionOnly", "allDone"] as const) {
          const plan: TodayPlan = { ...base, kind, nextUnitId: unit.id, openMissionId: kind === "missionOnly" ? "x" : null };
          variants.push(plainText(todayBlock(plan, true, { planSentence: planLine }).text));
        }
      }
      for (const text of variants) {
        expect(text, unit.id).not.toMatch(/[?!]\./);
        expect(text, unit.id).not.toMatch(/\.\./);
        expect(text, unit.id).toContain(unit.title_es);
      }
      const ends = /[?!]$/.test(unit.title_es);
      expect(variants[0], unit.id).toBe(`Morgen geht es weiter mit Haltestelle ${unit.stop}, ${unit.title_es}${ends ? "" : "."} Draußen wartet deine Mission.`);
      expect(variants[1], unit.id).toBe(`Morgen: Haltestelle ${unit.stop}, ${unit.title_es}`);
      expect(variants[2], unit.id).toBe(`Morgen geht es weiter mit Haltestelle ${unit.stop}, ${unit.title_es}${ends ? "" : "."} Draußen wartet deine Mission. ${sentence}`);
      expect(variants[3], unit.id).toBe(`Morgen: Haltestelle ${unit.stop}, ${unit.title_es}${ends ? "" : "."} ${sentence}`);
    }
    expect(units.filter((unit) => /[?!]$/.test(unit.title_es))).toHaveLength(3);
  });

  it("das Beispiel aus der Spezifikation", () => {
    const unit = units.find((u) => u.stop === 5)!;
    const plan: TodayPlan = { ...base, kind: "missionOnly", nextUnitId: unit.id, openMissionId: "x" };
    expect(plainText(todayBlock(plan).text)).toBe("Morgen geht es weiter mit Haltestelle 5, ¿Dónde está? Draußen wartet deine Mission.");
  });

  it("die Zahlen 30 und 10 kommen aus config.ts", () => {
    const plan: TodayPlan = { ...base, kind: "work", nextUnitId: null, openMissionId: null, finalStationOpen: true };
    expect(plainText(todayBlock(plan).text)).toBe(`${FINAL_REVIEW.taskCount} gemischte Aufgaben über alle Karten.`);
    const done: TodayPlan = { ...base, kind: "allDone", nextUnitId: "u02", openMissionId: null };
    expect(todayBlock(done).button).toBe(`${EXTRA_ROUND_CARDS} Karten extra`);
  });

  it("im Quelltext von Block, Startseite und Linie steht weder 30 noch 10 als Zahl im Text", () => {
    const raw = import.meta.glob(["./todayBlock.ts", "./HomeView.tsx", "./lineModel.ts", "./homeFacts.ts"], {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const names = Object.keys(raw);
    expect(names).toHaveLength(4);
    for (const [name, text] of Object.entries(raw)) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
      expect(code, name).not.toMatch(/["'`][^"'`\n]*\b(30|10)\b[^"'`\n]*["'`]/);
    }
  });
});
