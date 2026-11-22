import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createProgressStore } from "../../core/store";
import type { StorageLike } from "../../core/store";
import { completeMission, missionState, skipMission, startUnit, stopState, stopStates, todayPlan } from "../../core/units";
import { lineModel, stopTap } from "../home/lineModel";
import { afterUnit1 } from "../home/testProgress";
import { MissionsView } from "./MissionsView";
import { missionList } from "./missionsModel";

const noop = () => {};

function render(progress: Parameters<typeof MissionsView>[0]["progress"], focus: string | null = null): string {
  return renderToStaticMarkup(<MissionsView progress={progress} focusMissionId={focus} onComplete={noop} onSkip={noop} />);
}

describe("Missionen: Liste", () => {
  it("alle zehn Missionen, gesperrte zuerst nach Haltestelle 1", () => {
    const { progress } = afterUnit1();
    const list = missionList(progress);
    expect(list).toHaveLength(10);
    expect(list[0]).toMatchObject({ missionId: "u01-m", state: "open", title: "Dreimal grüßen" });
    expect(list.slice(1).every((m) => m.state === "locked")).toBe(true);
  });

  it("zeigt Zustände als Text: gesperrt, offen, erledigt, übersprungen", () => {
    const { clock, progress } = afterUnit1();
    expect(render(progress)).toContain("Haltestelle 1 · offen");
    expect(render(progress)).toContain("Haltestelle 2 · gesperrt, wird mit Haltestelle 2 offen");
    expect(render(skipMission(progress, "u01-m", clock.now))).toContain("Haltestelle 1 · übersprungen");
    expect(render(completeMission(progress, "u01-m", clock.now))).toContain("Haltestelle 1 · erledigt");
  });

  it("offene und übersprungene zeigen Aufgabe und Sätze mit Ton, gesperrte und erledigte nicht", () => {
    const { clock, progress } = afterUnit1();
    const open = render(progress);
    expect(open).toContain("Grüße heute drei Menschen");
    expect(open).toContain("Sätze zum Mitnehmen");
    expect(open.match(/class="text-btn audio-btn/g)).toHaveLength(3);
    expect(open).toMatch(/lang="es"[^>]*>Buenos días\./);
    const skipped = render(skipMission(progress, "u01-m", clock.now));
    expect(skipped).toContain("Grüße heute drei Menschen");
    expect(skipped).toContain("Nachholen");
    const done = render(completeMission(progress, "u01-m", clock.now));
    expect(done).not.toContain("Grüße heute drei Menschen");
    expect(done).not.toContain("audio-btn");
  });

  it("offene Mission bietet „Abhaken“ und „Überspringen“, ohne Fokus ist das Formular zu", () => {
    const { progress } = afterUnit1();
    const html = render(progress);
    expect(html).toContain("Abhaken");
    expect(html).toContain("Überspringen");
    expect(html).not.toContain("Wie lief es?");
  });

  it("mit Fokus ist die Mission geöffnet: „Wie lief es?“ mit drei Antworten, Notiz, beides freiwillig", () => {
    const { progress } = afterUnit1();
    const html = render(progress, "u01-m");
    expect(html).toContain("Wie lief es? (freiwillig)");
    for (const answer of ["leicht", "ging so", "schwer"]) expect(html).toContain(`<span class="choice__text">${answer}</span>`);
    expect(html).toContain("Notiz (freiwillig)");
    expect(html).toContain("Mission erledigt");
    expect(html.match(/class="btn"/g)).toHaveLength(1);
  });

  it("eine gesperrte Mission lässt sich nicht öffnen, auch mit Fokus", () => {
    const { progress } = afterUnit1();
    expect(render(progress, "u02-m")).not.toContain("Wie lief es?");
  });

  it("erledigt zeigt Gefühl und Notiz", () => {
    const { clock, progress } = afterUnit1();
    const done = completeMission(progress, "u01-m", clock.now, { feeling: "mittel", note: "Zweimal geklappt" });
    expect(render(done)).toContain("Wie lief es: ging so. Zweimal geklappt");
  });
});

describe("Missionen: Punkte und Überspringen", () => {
  it("Mission erledigen vergibt 50 Punkte genau einmal", () => {
    const { clock, progress } = afterUnit1();
    const before = progress.stats.points;
    const once = completeMission(progress, "u01-m", clock.now);
    const twice = completeMission(once, "u01-m", clock.now);
    expect(once.stats.points - before).toBe(50);
    expect(twice.stats.points).toBe(once.stats.points);
    expect(missionState(twice, "u01-m")).toBe("done");
  });

  it("überspringen, später erledigen: 50 Punkte, einmal", () => {
    const { clock, progress } = afterUnit1();
    const skipped = skipMission(progress, "u01-m", clock.now);
    expect(missionState(skipped, "u01-m")).toBe("skipped");
    expect(skipped.stats.points).toBe(progress.stats.points);
    const done = completeMission(skipped, "u01-m", clock.now, { feeling: "leicht" });
    expect(missionState(done, "u01-m")).toBe("done");
    expect(done.stats.points - progress.stats.points).toBe(50);
  });

  it("Überspringen sperrt keine Haltestelle: Haltestelle 2 ist offen, wird am nächsten Tag angeboten und lässt sich beginnen", () => {
    const { clock, progress } = afterUnit1();
    const skipped = skipMission(progress, "u01-m", clock.now);
    expect(missionList(skipped)[0]?.state).toBe("skipped");
    // Haltestelle 2 ist offen, nicht gesperrt.
    expect(stopState(skipped, "u02")).toBe("open");
    expect(stopStates(skipped).find((s) => s.unitId === "u02")?.state).toBe("open");
    // Die Linie bietet sie zum Antippen an und der Plan des nächsten Tages schlägt sie vor.
    expect(stopTap(lineModel(skipped, null).stops, "u02")).toEqual({ type: "session", unitId: "u02" });
    clock.advance(1);
    const plan = todayPlan(skipped, clock.current());
    expect(plan.unitId).toBe("u02");
    expect(plan.unitState).toBe("open");
    // Beginnen: Die Haltestelle läuft danach.
    const begun = startUnit(skipped, "u02", clock.now);
    expect(stopState(begun, "u02")).toBe("running");
    expect(begun.units.u02).toBeDefined();
    // Die übersprungene Mission bleibt nachholbar.
    expect(missionState(begun, "u01-m")).toBe("skipped");
    expect(render(skipped)).toContain("Nachholen");
  });

  it("gespeichert und nach dem Neuladen wieder da", () => {
    const { clock, progress } = afterUnit1();
    const data = new Map<string, string>();
    const storage: StorageLike = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
    const store = createProgressStore({ storage, now: clock.now });
    store.createProfile("Ana");
    store.update(() => progress);
    store.update((p) => completeMission(p, "u01-m", clock.now, { note: "ok" }));
    const reloaded = createProgressStore({ storage, now: clock.now }).getSnapshot();
    expect(reloaded.status).toBe("ready");
    if (reloaded.status === "ready") expect(missionState(reloaded.progress, "u01-m")).toBe("done");
  });

});
