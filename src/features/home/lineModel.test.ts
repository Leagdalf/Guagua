import { describe, expect, it } from "vitest";
import { stopStates } from "../../core/units";
import { formatDateDe } from "./dateText";
import { FINAL_STOP_ID, lineModel } from "./lineModel";
import { afterUnit1, newClock, newProgress, completeUnit } from "./testProgress";

describe("Linie", () => {
  it("vor dem ersten Start: Haltestelle 1 offen, neun gesperrt, Endstation gesperrt", () => {
    const m = lineModel(newProgress(newClock()));
    expect(m.stops).toHaveLength(11);
    expect(m.stops.map((s) => s.state)).toEqual(["open", ...Array(9).fill("locked"), "locked"]);
    expect(m.summary).toBe("0 von 10 abgeschlossen");
    expect(m.finalNote).toBeNull();
  });

  it("nach Haltestelle 1: erster Punkt abgeschlossen, zweiter offen", () => {
    const { progress } = afterUnit1();
    const m = lineModel(progress);
    expect(m.stops[0]).toMatchObject({ id: "u01", name: "¡Hola!", state: "done", selectable: true });
    expect(m.stops[1]).toMatchObject({ id: "u02", name: "En el café", state: "open", selectable: false });
    expect(m.stops[2]?.state).toBe("locked");
    expect(m.summary).toBe("1 von 10 abgeschlossen");
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

  it("Endstation nach Haltestelle 10: gesperrt gezeichnet, aber mit Satz, dass sie folgt", () => {
    const clock = newClock();
    let p = newProgress(clock);
    for (const id of ["u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "u09", "u10"]) p = completeUnit(p, id, clock.now);
    const m = lineModel(p);
    const final = m.stops[10];
    expect(final).toMatchObject({ id: FINAL_STOP_ID, terminus: true, state: "locked" });
    expect(m.finalNote).toContain("folgt");
    expect(m.summary).toBe("10 von 10 abgeschlossen");
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
