import { describe, expect, it } from "vitest";
import { stopStates, todayPlan } from "../../core/units";
import { formatDateDe } from "./dateText";
import { FINAL_STOP_ID, lineModel, stopTap } from "./lineModel";
import { afterUnit1, newClock, newProgress, completeUnit } from "./testProgress";

describe("Linie", () => {
  it("vor dem ersten Start: Haltestelle 1 offen, neun gesperrt, Endstation gesperrt", () => {
    const m = lineModel(newProgress(newClock()));
    expect(m.stops).toHaveLength(11);
    expect(m.stops.map((s) => s.state)).toEqual(["open", ...Array(9).fill("locked"), "locked"]);
    expect(m.summary).toBe("0 von 10 abgeschlossen");
    expect(m.stops[10]).toMatchObject({ selectable: false });
  });

  it("nach Haltestelle 1: erster Punkt abgeschlossen, zweiter offen", () => {
    const { progress } = afterUnit1();
    const m = lineModel(progress);
    expect(m.stops[0]).toMatchObject({ id: "u01", name: "¡Hola!", state: "done", selectable: true });
    expect(m.stops[1]).toMatchObject({ id: "u02", name: "En el café", state: "open", selectable: true });
    expect(m.stops[2]).toMatchObject({ state: "locked", selectable: false });
    expect(m.summary).toBe("1 von 10 abgeschlossen");
  });

  it("die offene Haltestelle heißt „heute“, solange todayPlan sie anbietet, sonst „offen“", () => {
    const { clock, progress } = afterUnit1();
    clock.advance(1);
    const offered = todayPlan(progress, clock.current());
    expect(offered.unitId).toBe("u02");
    expect(lineModel(progress, offered.unitId).stops[1]?.statusText).toBe("heute");
    expect(lineModel(progress, null).stops[1]?.statusText).toBe("offen");
  });

  it("heute schon eine geschafft: Haltestelle 2 heißt „offen“, bleibt aber antippbar", () => {
    const { clock, progress } = afterUnit1();
    const plan = todayPlan(progress, clock.current());
    expect(plan.unitId).toBeNull();
    const stop = lineModel(progress, plan.unitId).stops[1];
    expect(stop).toMatchObject({ state: "open", statusText: "offen", selectable: true });
  });

  it("Tippen: abgeschlossen öffnet die Übersicht, offen und laufend beginnen die Lerneinheit, gesperrt und Endstation nichts", () => {
    const clock = newClock();
    const { progress } = afterUnit1(clock);
    const m = lineModel(progress, null);
    expect(stopTap(m.stops, "u01")).toEqual({ type: "overview", unitId: "u01" });
    // Heute ist schon eine geschafft, die offene Haltestelle 2 lässt sich trotzdem beginnen.
    expect(stopTap(m.stops, "u02")).toEqual({ type: "session", unitId: "u02" });
    expect(stopTap(m.stops, "u03")).toEqual({ type: "none" });
    expect(stopTap(m.stops, FINAL_STOP_ID)).toEqual({ type: "none" }); // gesperrt bis Haltestelle 10
    const started = { ...progress, units: { ...progress.units, u02: { step: 3 as const, startedAt: clock.now().toISOString() } } };
    expect(stopTap(lineModel(started, "u02").stops, "u02")).toEqual({ type: "session", unitId: "u02" });
  });

  it("der Berg zeigt denselben Stand wie die Linie", () => {
    const { progress } = afterUnit1();
    const m = lineModel(progress);
    expect(m.mountain).toEqual(m.stops.slice(0, 10).map((s) => s.state));
    expect(m.mountain).toEqual(stopStates(progress).map((s) => s.state));
  });

  it("begonnene Haltestelle läuft", () => {
    const clock = newClock();
    const { progress } = afterUnit1(clock);
    const started = { ...progress, units: { ...progress.units, u02: { step: 3 as const, startedAt: clock.now().toISOString() } } };
    expect(lineModel(started).stops[1]?.state).toBe("running");
  });

  it("Endstation: gesperrt vor Haltestelle 10, danach offen und antippbar, mit gewählten Karten „läuft“, geschafft „abgeschlossen“", () => {
    const clock = newClock();
    let p = newProgress(clock);
    for (const id of ["u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "u09"]) p = completeUnit(p, id, clock.now);
    expect(lineModel(p).stops[10]).toMatchObject({ id: FINAL_STOP_ID, terminus: true, state: "locked", selectable: false });
    p = completeUnit(p, "u10", clock.now);
    const m = lineModel(p);
    expect(m.stops[10]).toMatchObject({ id: FINAL_STOP_ID, terminus: true, state: "open", selectable: true });
    expect(m.summary).toBe("10 von 10 abgeschlossen");
    expect(stopTap(m.stops, FINAL_STOP_ID)).toEqual({ type: "final" });

    const running = { ...p, finalRun: { ids: ["u01-i01"], answered: [], right: 0 } };
    expect(lineModel(running).stops[10]?.state).toBe("running");
    expect(stopTap(lineModel(running).stops, FINAL_STOP_ID)).toEqual({ type: "final" });

    const done = { ...p, finalReview: { at: "2026-12-03T10:00:00.000Z", right: 26, total: 30 } };
    const doneModel = lineModel(done);
    expect(doneModel.stops[10]).toMatchObject({ state: "done", selectable: true });
    expect(stopTap(doneModel.stops, FINAL_STOP_ID)).toEqual({ type: "final-line" });
    expect(doneModel.mountain).toEqual(Array(10).fill("done"));
  });
});

describe("Datum in Worten", () => {
  it("nennt Wochentag, Tag und Monat", () => {
    expect(formatDateDe("2026-11-24")).toBe("Dienstag, 24. November");
    expect(formatDateDe("2026-11-22")).toBe("Sonntag, 22. November");
    expect(formatDateDe("2026-12-03")).toBe("Donnerstag, 3. Dezember");
    expect(formatDateDe("2027-03-01")).toBe("Montag, 1. März");
  });

  it("gibt Ungültiges unverändert zurück", () => {
    expect(formatDateDe("gestern")).toBe("gestern");
  });
});
