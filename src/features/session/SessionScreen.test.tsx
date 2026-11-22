import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getUnit } from "../../core/content";
import type { Progress } from "../../core/types";
import { createSession } from "./machine";
import type { SessionState } from "./machine";
import { SessionScreen } from "./SessionScreen";
import { newDay1, play, playUnit1, Run, U01 } from "./sessionKit";

function decode(html: string): string {
  return html
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function render(state: SessionState, progress: Progress, hasVoice = true): string {
  return decode(
    renderToStaticMarkup(
      <SessionScreen
        state={state}
        progress={progress}
        day="2026-11-23"
        hasVoice={hasVoice}
        onEvent={() => {}}
        onSpeak={() => {}}
        onClose={() => {}}
        onExit={() => {}}
      />,
    ),
  );
}

/** Alle Bildschirme eines Durchlaufs, jeder Zustand einmal gerendert. */
function renderWholeRun(run: Run, hasVoice = true): string[] {
  const pages: string[] = [];
  play(run, {
    stopWhen: (r) => {
      pages.push(render(r.state, r.progress, hasVoice));
      return false;
    },
  });
  pages.push(render(run.state, run.progress, hasVoice));
  return pages;
}

describe("SessionScreen (Server-Render, ohne DOM)", () => {
  it("rendert jeden Bildschirm von Haltestelle 1 ohne Fehler und ohne ungefüllten Namen", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    const pages = renderWholeRun(run);
    expect(pages.length).toBeGreaterThan(50);
    for (const html of pages) {
      expect(html).not.toContain("{name}");
      expect(html).toContain("Schließen");
    }
  });

  it("der Dialog zeigt den Namen aus dem Profil im Spanischen und trägt lang=es", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "dialogue" });
    run.send({ type: "next" });
    const html = render(run.state, run.progress);
    expect(html).toContain('lang="es"');
    expect(html).toContain("Buenas tardes. Me llamo Ana.");
    expect(html).toContain("Übersetzung zeigen");
    expect(html).not.toContain("Guten Tag. Ich heiße Ana.");
    run.send({ type: "reveal", line: 1 });
    expect(render(run.state, run.progress)).toContain("Guten Tag. Ich heiße Ana.");
  });

  it("Tonknöpfe sind ohne Stimme deaktiviert, mit Stimme nicht", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    const withVoice = render(run.state, run.progress, true);
    const without = render(run.state, run.progress, false);
    expect(withVoice).toContain("Anhören");
    expect(withVoice).not.toMatch(/<button[^>]*disabled=""[^>]*>[^<]*<svg[^>]*>[\s\S]*?Anhören/);
    expect(without).toMatch(/disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Anhören/);
  });

  it("neue Karte: Spanisch mit Marker und lang=es, Deutsch, Hinweis, Anhören und Langsam, Zähler im Kopf", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    const html = render(run.state, run.progress);
    expect(html).toContain('lang="es"');
    expect(html).toContain('class="marker">hola</span>');
    expect(html).toContain("hallo");
    expect(html).toContain("Das h ist stumm.");
    expect(html).toContain("Anhören");
    expect(html).toContain("Langsam");
    expect(html).toContain("Karte 1 von 16");
    expect(html).toContain("Schritt 2 von 6");
  });

  it("Zusammenfassung nach der Haltestelle: Berg, Liste, Punkte und Serie, außer im Ruhemodus", () => {
    const { run } = playUnit1();
    const html = render(run.state, run.progress);
    expect(html).toContain("Haltestelle 1 ist geschafft.");
    expect(html).toContain("<svg");
    expect(html).toContain("Neue Karten");
    expect(html).toContain("Richtige Antworten");
    expect(html).toContain("Punkte");
    expect(html).toContain("Serie");
    expect(html).toContain("Zur Linie");
    expect(html).toContain("1 von 10 Haltestellen abgeschlossen.");

    const calm: Progress = { ...run.progress, profile: { ...run.progress.profile, calm: true } };
    const calmHtml = render(run.state, calm);
    expect(calmHtml).not.toContain("Punkte");
    expect(calmHtml).not.toContain("Serie");
    expect(calmHtml).toContain("Neue Karten");
  });

  it("Mission: Sätze zum Mitnehmen mit Ton und die Kanaren-Notiz", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "mission" });
    const html = render(run.state, run.progress);
    const unit = getUnit(U01)!;
    for (const sentence of unit.mission.say) expect(html).toContain(sentence);
    expect(html).toContain("Hasta luego");
    expect(html).toContain("Kanaren");
  });

  it("freie Runde ohne Karten: Zusammenfassung mit Erklärung, ohne Punkte", () => {
    const { clock, progress } = newDay1();
    const created = createSession(progress, { kind: "extra" }, { now: clock.now, rng: () => 0.5, hasSpanishVoice: true });
    const html = render(created.state, created.progress);
    expect(html).toContain("Noch nichts zu üben.");
    expect(html).not.toContain("Punkte</dt>");
  });

  it("Aufgabe nach einem Fehler: Kreuz-Zeile „deine Antwort“, Lösung und Hinweis der Karte", () => {
    const { clock, run: day1 } = playUnit1();
    clock.advance(1);
    const day2 = new Run(day1.progress, { kind: "day", unitId: "u02" }, clock);
    const task = day2.task.task;
    if (task.kind !== "choice") throw new Error("Auswahl erwartet");
    day2.send({ type: "choose", index: (task.correctIndex + 1) % task.options.length });
    const html = render(day2.state, day2.progress);
    expect(html).toContain("deine Antwort");
    expect(html).toContain("richtig");
    expect(html).toContain("Falsch. Richtig ist:");
    expect(html).toContain("Weiter");
  });
});
