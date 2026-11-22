import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { completeMission } from "../../core/units";
import { HomeView } from "./HomeView";
import { afterUnit1, newClock, newProgress } from "./testProgress";

const noop = () => {};

function render(progress: Parameters<typeof HomeView>[0]["progress"], day: string): string {
  return renderToStaticMarkup(<HomeView progress={progress} day={day} onStartSession={noop} onOpenMissions={noop} />);
}

describe("HomeView (Server-Render)", () => {
  it("Kopf: Datum in Worten, „Tag n“ ohne „von 10“, Berg; Punkte und Serie fehlen", () => {
    const clock = newClock("2026-11-23");
    const html = render(newProgress(clock), "2026-11-24");
    expect(html).toContain("Dienstag, 24. November");
    expect(html).toContain("Tag 2");
    expect(html).not.toContain("von 10</p>");
    expect(html).toContain('class="mountain"');
    expect(html).not.toMatch(/Punkte|Serie/);
  });

  it("zeigt alle elf Punkte der Linie und die Zeile „1 von 10 abgeschlossen“ nach Haltestelle 1", () => {
    const { clock, progress } = afterUnit1();
    const html = render(progress, clock.current());
    expect(html.match(/<li class="stop /g)).toHaveLength(11);
    expect(html).toContain("1 von 10 abgeschlossen");
    const lis = [...html.matchAll(/<li class="stop (stop--\w+)/g)].map((m) => m[1]);
    expect(lis[0]).toBe("stop--done");
    expect(lis[1]).toBe("stop--open");
    expect(lis.slice(2, 10).every((s) => s === "stop--locked")).toBe(true);
  });

  it("Berg und Linie zeigen denselben Stand", () => {
    const { clock, progress } = afterUnit1();
    const html = render(progress, clock.current());
    const mountain = [...html.matchAll(/<g data-state="(\w+)"/g)].map((m) => m[1]);
    const line = [...html.matchAll(/<li class="stop stop--(\w+)/g)].map((m) => m[1]).slice(0, 10);
    expect(mountain).toHaveLength(10);
    expect(mountain).toEqual(line);
  });

  it("Block „Heute“ und Hauptknopf stehen im Raster, die Linie in einer eigenen Spalte", () => {
    const { clock, progress } = afterUnit1();
    clock.advance(1);
    const html = render(progress, clock.current());
    expect(html).toContain("Heute · Haltestelle 2");
    expect(html).toContain("Mit Wiederholen beginnen");
    expect(html.indexOf("home__today")).toBeLessThan(html.indexOf("home__line"));
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).not.toContain("<main");
  });

  it("die offene Mission bleibt angeheftet, mit „Abhaken“ und den Sätzen zum Mitnehmen", () => {
    const { clock, progress } = afterUnit1();
    const html = render(progress, clock.current());
    expect(html).toContain("Mission offen");
    expect(html).toContain("Dreimal grüßen");
    expect(html).toContain("Abhaken");
    expect(html).toContain("Buenos días.");
  });

  it("ohne offene Mission keine Missionszeile", () => {
    const { clock, progress } = afterUnit1();
    const html = render(completeMission(progress, "u01-m", clock.now), clock.current());
    expect(html).not.toContain("home__mission");
    expect(html).toContain("Für heute fertig");
    expect(html).toContain("Morgen: Haltestelle 2, ");
    expect(html).toMatch(/<span lang="es" class="es es--inherit">En el café<\/span>/);
  });

  it("„10 Karten extra“ gibt es erst, wenn es Karten gibt, und nicht doppelt zum Hauptknopf", () => {
    const clock = newClock();
    expect(render(newProgress(clock), clock.current())).not.toContain("10 Karten extra");
    const { clock: c2, progress } = afterUnit1();
    expect(render(progress, c2.current()).match(/10 Karten extra/g)).toHaveLength(1);
    const allDone = completeMission(progress, "u01-m", c2.now);
    expect(render(allDone, c2.current()).match(/10 Karten extra/g)).toHaveLength(1);
  });

  it("die Endstation steht nicht zur Wahl und erklärt nichts, solange sie gesperrt ist", () => {
    const { clock, progress } = afterUnit1();
    const html = render(progress, clock.current());
    expect(html).toContain("Repaso final");
    expect(html).not.toContain("Die Endstation ist offen");
  });

  it("jede spanische Zeile trägt lang=es", () => {
    const { clock, progress } = afterUnit1();
    const html = render(progress, clock.current());
    for (const name of ["¡Hola!", "En el café", "Los números", "Repaso final"]) {
      expect(html, name).toMatch(new RegExp(`lang="es"[^>]*>(<span class="marker">)?${name}`));
    }
  });
});
