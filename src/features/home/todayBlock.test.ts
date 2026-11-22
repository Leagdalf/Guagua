import { describe, expect, it } from "vitest";
import { completeMission, completeStep, finishReviewRound, startUnit, todayPlan } from "../../core/units";
import { afterUnit1, completeUnit, newClock, newProgress } from "./testProgress";
import { plainText, todayBlock } from "./todayBlock";

function blockOf(progress: Parameters<typeof todayPlan>[0], day: string) {
  return todayBlock(todayPlan(progress, day));
}

describe("Block „Heute“: erste Tabelle im Design-Dokument", () => {
  it("Wiederholungen fällig, Haltestelle offen", () => {
    const { clock, progress } = afterUnit1();
    clock.advance(1);
    const b = blockOf(progress, clock.current());
    expect(b.label).toBe("Heute · Haltestelle 2");
    expect(b.title).toBe("En el café");
    expect(b.titleLang).toBe("es");
    expect(plainText(b.text)).toBe("Getränke bestellen. Erst 16 Karten wiederholen, dann 15 neue.");
    expect(b.button).toBe("Mit Wiederholen beginnen");
    expect(b.action).toEqual({ type: "session", request: { kind: "day", unitId: "u02" } });
  });

  it("nur Mission offen", () => {
    const { clock, progress } = afterUnit1();
    const b = blockOf(progress, clock.current());
    expect(b.label).toBe("Heute");
    expect(b.title).toBe("Für heute fertig");
    expect(b.titleLang).toBe("de");
    expect(plainText(b.text)).toBe("Morgen geht es weiter mit Haltestelle 2, En el café. Draußen wartet deine Mission.");
    expect(b.text).toContainEqual({ es: "En el café" });
    expect(b.button).toBe("Mission ansehen");
    expect(b.action).toEqual({ type: "missions" });
  });

  it("nur Mission offen: der Titel der Mission steht nicht im Block, sie steht nur in der angehefteten Zeile", () => {
    const { clock, progress } = afterUnit1();
    const b = blockOf(progress, clock.current());
    expect(JSON.stringify(b)).not.toContain("Dreimal grüßen");
  });

  it("nur Mission offen, keine nächste Haltestelle: die Endstation steht im Block, die Mission nur in der angehefteten Zeile", () => {
    const clock = newClock();
    const p = finishReviewRound(allUnitsDone(clock), clock.current());
    const b = blockOf(p, clock.current());
    expect(b.title).toBe("Repaso final");
    expect(JSON.stringify(b)).not.toMatch(/Mission|Morgen/);
  });

  it("alles erledigt ohne Karten aus abgeschlossenen Haltestellen: kein Knopf „10 Karten extra“", () => {
    const { clock, progress } = afterUnit1();
    const done = completeMission(progress, "u01-m", clock.now);
    const b = todayBlock(todayPlan(done, clock.current()), false);
    expect(b.button).toBeNull();
    expect(b.action).toBeNull();
  });

  it("alles erledigt", () => {
    const { clock, progress } = afterUnit1();
    const done = completeMission(progress, "u01-m", clock.now);
    const b = blockOf(done, clock.current());
    expect(b.label).toBe("Heute");
    expect(b.title).toBe("Für heute fertig");
    expect(b.titleLang).toBe("de");
    expect(plainText(b.text)).toBe("Morgen: Haltestelle 2, En el café");
    expect(b.text).toContainEqual({ es: "En el café" });
    expect(b.button).toBe("10 Karten extra");
    expect(b.action).toEqual({ type: "extra" });
  });
});

describe("Block „Heute“: zweite Tabelle im Design-Dokument", () => {
  it("nichts fällig, Haltestelle offen (erster Tag)", () => {
    const clock = newClock();
    const b = blockOf(newProgress(clock), clock.current());
    expect(b.label).toBe("Heute · Haltestelle 1");
    expect(b.title).toBe("¡Hola!");
    expect(plainText(b.text)).toBe("Begrüßen und vorstellen. 16 neue Karten.");
    expect(b.button).toBe("Haltestelle beginnen");
    expect(b.action).toEqual({ type: "session", request: { kind: "day", unitId: "u01" } });
  });

  it("Wiederholen fällig, Haltestelle läuft schon", () => {
    const { clock, progress } = afterUnit1();
    clock.advance(1);
    let p = startUnit(progress, "u02", clock.now);
    p = completeStep(completeStep(p, "u02", 1, clock.now), "u02", 2, clock.now);
    const b = blockOf(p, clock.current());
    expect(b.label).toBe("Heute · Haltestelle 2");
    expect(b.title).toBe("En el café");
    expect(plainText(b.text)).toMatch(/^Erst \d+ Karten wiederholen, dann weiter bei Schritt 3 von 6\.$/);
    expect(b.button).toBe("Mit Wiederholen beginnen");
  });

  it("nichts fällig, Haltestelle läuft schon", () => {
    const { clock, progress } = afterUnit1();
    clock.advance(1);
    let p = startUnit(progress, "u02", clock.now);
    p = completeStep(completeStep(p, "u02", 1, clock.now), "u02", 2, clock.now);
    p = finishReviewRound(p, clock.current());
    const b = blockOf(p, clock.current());
    expect(plainText(b.text)).toBe("Weiter bei Schritt 3 von 6: Grammatik.");
    expect(b.button).toBe("Haltestelle fortsetzen");
    expect(b.action).toEqual({ type: "session", request: { kind: "day", unitId: "u02" } });
  });

  it("nur Wiederholen, alle Haltestellen und die Endstation geschafft", () => {
    const clock = newClock();
    let p = newProgress(clock);
    for (const id of ["u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "u09", "u10"]) p = completeUnit(p, id, clock.now);
    p = { ...p, finalReview: { at: clock.now().toISOString(), right: 26, total: 30 } };
    clock.advance(1);
    const plan = todayPlan(p, clock.current());
    expect(plan.unitId).toBeNull();
    expect(plan.nextUnitId).toBeNull();
    const b = todayBlock(plan);
    expect(b.label).toBe("Heute");
    expect(b.title).toBe("Wiederholen");
    expect(b.titleLang).toBe("de");
    expect(plainText(b.text)).toBe("154 Karten sind fällig. Heute kommen 40 dran.");
    expect(b.button).toBe("Mit Wiederholen beginnen");
    expect(b.action).toEqual({ type: "session", request: { kind: "day", unitId: null } });
  });

  it("alles geschafft, Endstation offen: kein Verweis auf eine nächste Haltestelle, der Satz „Die Endstation folgt“ entfällt", () => {
    const clock = newClock();
    let p = allUnitsDone(clock);
    for (let n = 1; n <= 10; n++) p = completeMission(p, `u${String(n).padStart(2, "0")}-m`, clock.now);
    p = finishReviewRound(p, clock.current());
    const b = blockOf(p, clock.current());
    expect(JSON.stringify(b)).not.toMatch(/folgt|Morgen/);
  });
});

function allUnitsDone(clock: ReturnType<typeof newClock>) {
  let p = newProgress(clock);
  for (const id of ["u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "u09", "u10"]) p = completeUnit(p, id, clock.now);
  return p;
}

describe("Block „Heute“: die Endstation (drei Zeilen der zweiten Tabelle)", () => {
  it("Endstation offen, nichts fällig", () => {
    const clock = newClock();
    const b = blockOf(finishReviewRound(allUnitsDone(clock), clock.current()), clock.current());
    expect(b.label).toBe("Heute · Endstation");
    expect(b.title).toBe("Repaso final");
    expect(b.titleLang).toBe("es");
    expect(plainText(b.text)).toBe("30 gemischte Aufgaben über alle Karten.");
    expect(b.button).toBe("Endstation beginnen");
    expect(b.action).toEqual({ type: "session", request: { kind: "final" } });
  });

  it("Endstation offen, Wiederholen fällig", () => {
    const clock = newClock();
    const p = allUnitsDone(clock);
    clock.advance(1);
    const plan = todayPlan(p, clock.current());
    expect(plan.reviewPending).toBe(true);
    const b = todayBlock(plan);
    expect(b.label).toBe("Heute · Endstation");
    expect(b.title).toBe("Repaso final");
    expect(plainText(b.text)).toBe(`Erst ${plan.reviewCount} Karten wiederholen, dann 30 gemischte Aufgaben.`);
    expect(b.button).toBe("Mit Wiederholen beginnen");
    expect(b.action).toEqual({ type: "session", request: { kind: "final" } });
  });

  it("Endstation geschafft", () => {
    const clock = newClock();
    const p = finishReviewRound({ ...allUnitsDone(clock), finalReview: { at: clock.now().toISOString(), right: 26, total: 30 } }, clock.current());
    const b = blockOf(p, clock.current());
    expect(b.label).toBe("Heute");
    expect(b.title).toBe("Linie geschafft");
    expect(b.titleLang).toBe("de");
    expect(plainText(b.text)).toBe("26 von 30 richtig an der Endstation.");
    expect(b.button).toBe("Deine Linie ansehen");
    expect(b.action).toEqual({ type: "final-line" });
  });

  it("vor Haltestelle 10 steht die Endstation nirgends im Block", () => {
    const clock = newClock();
    let p = newProgress(clock);
    for (const id of ["u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "u09"]) p = completeUnit(p, id, clock.now);
    const plan = todayPlan(p, clock.current());
    expect(plan.finalStationOpen).toBe(false);
    expect(JSON.stringify(todayBlock(plan))).not.toMatch(/Endstation|Repaso/);
  });
});
