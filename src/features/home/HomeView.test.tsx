import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { extraRoundIds } from "../../core/cards";
import { completeMission, completeStep, finishReviewRound, startUnit } from "../../core/units";
import { HomeView } from "./HomeView";
import { afterUnit1, completeUnit, newClock, newProgress } from "./testProgress";

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

  it("nur Mission offen: „Für heute fertig“ in Figtree, Erklärzeile mit spanischem Namen, Mission genau einmal", () => {
    const { clock, progress } = afterUnit1();
    const html = render(progress, clock.current());
    expect(html).toContain('<h1 class="today__title today__title--de">Für heute fertig</h1>');
    expect(html).toContain("Morgen geht es weiter mit Haltestelle 2, ");
    expect(html).toMatch(/<span lang="es" class="es es--inherit">En el café<\/span>\. Draußen wartet deine Mission\./);
    expect(html).toContain("Mission ansehen");
    expect(html.match(/Dreimal grüßen/g)).toHaveLength(1);
    expect(html).not.toContain("Mission offen</h1>");
  });

  it("Linie: die Haltestelle des Tages heißt „heute“, nach einer Haltestelle am selben Tag heißt die nächste „offen“", () => {
    const { clock, progress } = afterUnit1();
    const sameDay = render(progress, clock.current());
    expect(sameDay).toMatch(/<span class="stop__status">offen<\/span>/);
    expect(sameDay).not.toMatch(/<span class="stop__status">heute<\/span>/);
    clock.advance(1);
    const nextDay = render(progress, clock.current());
    expect(nextDay).toMatch(/<span class="stop__status">heute<\/span>/);
    expect(nextDay).not.toMatch(/<span class="stop__status">offen<\/span>/);
  });

  it("Linie: offene und laufende Haltestellen sind Knöpfe, gesperrte nicht und tragen „gesperrt“ für Screenreader", () => {
    const { clock, progress } = afterUnit1();
    const html = render(progress, clock.current());
    const items = html.split('<li class="stop ').slice(1);
    expect(items[1]).toContain('<button type="button" class="stop__body"');
    for (const locked of items.slice(2, 10)) {
      expect(locked).not.toContain("<button");
      expect(locked).toContain('<span class="vh"> gesperrt</span>');
    }
    expect(items[0]).not.toContain("gesperrt");
  });

  it("ohne offene Mission keine Missionszeile", () => {
    const { clock, progress } = afterUnit1();
    const html = render(completeMission(progress, "u01-m", clock.now), clock.current());
    expect(html).not.toContain("home__mission");
    expect(html).toContain("Für heute fertig");
    expect(html).toContain("Morgen: Haltestelle 2, ");
    expect(html).not.toContain("Draußen wartet deine Mission");
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

  it("„10 Karten extra“ fehlt, solange es nur Karten aus einer noch nicht abgeschlossenen Haltestelle gibt", () => {
    const clock = newClock();
    let p = startUnit(newProgress(clock), "u01", clock.now);
    p = completeStep(completeStep(p, "u01", 1, clock.now), "u01", 2, clock.now);
    expect(Object.keys(p.cards).length).toBeGreaterThan(0);
    expect(extraRoundIds(p, clock.current())).toHaveLength(0);
    expect(render(p, clock.current())).not.toContain("10 Karten extra");
  });

  it("die Endstation steht nicht zur Wahl und erklärt nichts, solange sie gesperrt ist", () => {
    const { clock, progress } = afterUnit1();
    const html = render(progress, clock.current());
    expect(html).toContain("Repaso final");
    expect(html).not.toContain("Die Endstation ist offen");
  });

  describe("Endstation", () => {
    function allDone() {
      const clock = newClock();
      let p = newProgress(clock);
      for (const id of ["u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "u09", "u10"]) p = completeUnit(p, id, clock.now);
      return { clock, progress: finishReviewRound(p, clock.current()) };
    }

    it("offen: im Block „Heute“ zu beginnen und in der Linie antippbar; der Satz „Die Endstation folgt“ entfällt", () => {
      const { clock, progress } = allDone();
      const html = render(progress, clock.current());
      expect(html).toContain("Heute · Endstation");
      expect(html).toContain("30 gemischte Aufgaben über alle Karten.");
      expect(html).toContain("Endstation beginnen");
      expect(html).not.toMatch(/Endstation folgt|noch nicht in der App/);
      const items = html.split('<li class="stop ');
      const last = items[items.length - 1] ?? "";
      expect(last).toContain("stop--terminus");
      expect(last).toContain('<button type="button" class="stop__body"');
      expect(last).toContain("heute");
    });

    it("geschafft: „Linie geschafft“ mit dem Ergebnis, „Deine Linie ansehen“, die Linie zeigt „abgeschlossen“", () => {
      const { clock, progress } = allDone();
      const done = { ...progress, finalReview: { at: clock.now().toISOString(), right: 26, total: 30 } };
      const html = render(done, clock.current());
      expect(html).toContain('<h1 class="today__title today__title--de">Linie geschafft</h1>');
      expect(html).toContain("26 von 30 richtig an der Endstation.");
      expect(html).toContain("Deine Linie ansehen");
      const items = html.split('<li class="stop ');
      const last = items[items.length - 1] ?? "";
      expect(last).toContain("stop--done");
      expect(last).toContain('<button type="button" class="stop__body"');
      expect(last).toContain("abgeschlossen");
    });

    it("vor Haltestelle 10 ist die Endstation in der Linie gesperrt und kein Knopf", () => {
      const { clock, progress } = afterUnit1();
      const html = render(progress, clock.current());
      const items = html.split('<li class="stop ');
      const last = (items[items.length - 1] ?? "").split("</li>")[0] ?? "";
      expect(last).toContain("stop--locked");
      expect(last).not.toContain("<button");
    });
  });

  it("jede spanische Zeile trägt lang=es", () => {
    const { clock, progress } = afterUnit1();
    const html = render(progress, clock.current());
    for (const name of ["¡Hola!", "En el café", "Los números", "Repaso final"]) {
      expect(html, name).toMatch(new RegExp(`lang="es"[^>]*>(<span class="marker">)?${name}`));
    }
  });
});
