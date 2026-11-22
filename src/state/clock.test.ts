import { describe, expect, it } from "vitest";
import { today } from "../core/time";
import { createClock, readDayOffset } from "./clock";

describe("Uhr der App", () => {
  it("liest die Verschiebung in Tagen aus der Adresse", () => {
    expect(readDayOffset("")).toBe(0);
    expect(readDayOffset("?tage=1")).toBe(1);
    expect(readDayOffset("?preview&tage=3")).toBe(3);
    expect(readDayOffset("?tage=-2")).toBe(-2);
  });

  it("ignoriert alles Ungültige", () => {
    expect(readDayOffset("?tage=")).toBe(0);
    expect(readDayOffset("?tage=morgen")).toBe(0);
    expect(readDayOffset("?tage=1.5")).toBe(0);
    expect(readDayOffset("?tage=9999")).toBe(0);
  });

  it("verschiebt den heutigen Tag um ganze Tage", () => {
    const base = () => new Date(2026, 10, 23, 9, 0, 0).getTime();
    expect(today(createClock(0, base))).toBe("2026-11-23");
    expect(today(createClock(1, base))).toBe("2026-11-24");
    expect(today(createClock(10, base))).toBe("2026-12-03");
  });
});
