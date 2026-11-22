import { describe, expect, it } from "vitest";
import { updateProfile } from "../../core/progress";
import { freshProgress, makeClock } from "../../core/testkit";
import { aboutRows, formatMinutes, learningTime, median, targetText } from "./aboutModel";

const clock = makeClock("2026-11-23");
const min = (n: number) => n * 60_000;

function withTimes(times: Record<string, number>) {
  const p = freshProgress(clock);
  return { ...p, stats: { ...p.stats, activeMsByDay: times } };
}

describe("Median der Lernzeit", () => {
  it("ungerade Zahl von Tagen: der mittlere Wert", () => {
    expect(median([min(30), min(10), min(20)])).toBe(min(20));
    expect(learningTime(withTimes({ "2026-11-23": min(12), "2026-11-24": min(40), "2026-11-25": min(18) })).medianMs).toBe(min(18));
    expect(median([min(7)])).toBe(min(7));
  });

  it("gerade Zahl von Tagen: Mittelwert der beiden mittleren Werte", () => {
    expect(median([min(10), min(30), min(20), min(40)])).toBe(min(25));
    const t = learningTime(withTimes({ "2026-11-23": min(10), "2026-11-24": min(15), "2026-11-25": min(17), "2026-11-26": min(60) }));
    expect(t.medianMs).toBe(min(16));
    expect(median([min(5), min(6)])).toBe(min(5.5));
  });

  it("ohne Tage kein Median", () => {
    expect(median([])).toBeNull();
    expect(learningTime(withTimes({})).medianMs).toBeNull();
  });
});

describe("Lernzeit je Tag", () => {
  it("Summe, neuester Tag zuerst, Tage ohne Zeit zählen nicht", () => {
    const t = learningTime(withTimes({ "2026-11-23": min(10), "2026-11-25": min(20), "2026-11-24": 0 }));
    expect(t.days.map((d) => d.day)).toEqual(["2026-11-25", "2026-11-23"]);
    expect(t.totalMs).toBe(min(30));
    expect(t.medianMs).toBe(min(15));
  });

  it("Minuten für die Anzeige", () => {
    expect(formatMinutes(min(17))).toBe("17 min");
    expect(formatMinutes(min(17) + 20_000)).toBe("17 min");
    expect(formatMinutes(min(17) + 40_000)).toBe("18 min");
    expect(formatMinutes(10_000)).toBe("unter 1 min");
    expect(formatMinutes(0)).toBe("0 min");
  });

  it("der Zielwert kommt aus dem Kurs", () => {
    expect(targetText()).toBe("Zielwert: Median zwischen 15 und 20 Minuten pro Tag.");
  });
});

describe("Angaben unter „Über die App“", () => {
  it("Punkte und Serie fehlen im Ruhemodus, die Berechnung läuft weiter", () => {
    const p = freshProgress(clock);
    expect(aboutRows(p, "2026-11-23").map((r) => r.label)).toEqual(["Version", "Stand der Inhalte", "Punkte", "Serie"]);
    const calm = updateProfile({ ...p, stats: { ...p.stats, points: 50 } }, { calm: true });
    expect(aboutRows(calm, "2026-11-23").map((r) => r.label)).toEqual(["Version", "Stand der Inhalte"]);
    expect(calm.stats.points).toBe(50);
  });
});