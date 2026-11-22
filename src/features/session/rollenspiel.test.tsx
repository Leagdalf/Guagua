import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getUnit } from "../../core/content";
import type { Progress } from "../../core/types";
import { stopState } from "../../core/units";
import type { DialogueScreen, SessionState } from "./machine";
import { SessionScreen } from "./SessionScreen";
import { newDay1, play, Run, U01 } from "./sessionKit";

const unit01 = getUnit(U01)!;
const lines = unit01.dialogue.lines;
const FULL_POINTS = unit01.items.length * 10 + unit01.build.length * 10 + 20 + 100;

function decode(html: string): string {
  return html.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
}

function html(state: SessionState, progress: Progress): string {
  return decode(
    renderToStaticMarkup(
      <SessionScreen state={state} progress={progress} day="2026-11-23" hasVoice onEvent={() => {}} onSpeak={() => {}} onClose={() => {}} onExit={() => {}} />,
    ),
  );
}

/** Der Name aus dem Profil steht in den Zeilen anstelle von `{name}`. */
const spoken = (text: string, progress: Progress): string => text.replaceAll("{name}", progress.profile.name);

function dialogue(run: Run): DialogueScreen {
  if (run.state.screen.kind !== "dialogue") throw new Error(`Kein Dialog, sondern ${run.state.screen.kind}`);
  return run.state.screen;
}

/** Bis zum Anfang des Rollenspiels (nach dem Anhören der letzten Zeile) spielen. */
function atRoleStart(): Run {
  const { clock, progress } = newDay1();
  const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
  play(run, { stopWhen: (r) => r.state.screen.kind === "dialogue" });
  for (let i = 1; i < lines.length; i++) run.send({ type: "next" });
  expect(dialogue(run)).toMatchObject({ phase: "listen", shown: lines.length });
  run.send({ type: "next" });
  expect(dialogue(run).phase).toBe("role");
  return run;
}

/** Bis zur ersten eigenen Zeile (Zeile 2) des Rollenspiels. */
function atFirstOwnLine(): Run {
  const run = atRoleStart();
  run.send({ type: "next" });
  expect(lines[dialogue(run).shown - 1]!.learner).toBe(true);
  return run;
}

describe("Rollenspiel im Dialog", () => {
  it("auf das Anhören folgt das Rollenspiel; die Zeile der anderen Person wird im selben Tippen gesprochen", () => {
    const run = atRoleStart();
    const screen = dialogue(run);
    expect(screen).toMatchObject({ phase: "role", shown: 1, uncovered: false, again: [], sat: [] });
    // Die erste Zeile kam mit dem Tippen auf „Rollenspiel beginnen“.
    expect(run.spoken[run.spoken.length - 1]).toMatchObject({ text: lines[0]!.es });
    // Zur eigenen Zeile: kein Ton, solange sie verdeckt ist.
    const speak = run.send({ type: "next" });
    expect(speak).toBeNull();
    expect(dialogue(run)).toMatchObject({ shown: 2, uncovered: false });
  });

  it("eigene Zeilen zeigen vor „Aufdecken“ kein Spanisch, nur die deutsche Vorgabe", () => {
    const run = atFirstOwnLine();
    const own = lines[1]!;
    const before = html(run.state, run.progress);
    expect(before).toContain(spoken(own.de, run.progress));
    expect(before).not.toContain(spoken(own.es, run.progress));
    expect(before).not.toContain(own.es);
    expect(before).toContain("Aufdecken");
    expect(before).not.toContain("Saß");
    // Die Zeile davor (andere Person) steht auf Spanisch da.
    expect(before).toContain(spoken(lines[0]!.es, run.progress));

    run.send({ type: "uncover" });
    const after = html(run.state, run.progress);
    expect(after).toContain(spoken(own.es, run.progress));
    expect(after).toContain("Saß");
    expect(after).toContain("Noch mal");
    expect(after).not.toContain(">Aufdecken<");
  });

  it("„Aufdecken“ spricht die Lösung im selben Tippen", () => {
    const run = atFirstOwnLine();
    expect(run.send({ type: "uncover" })).toEqual({ text: lines[1]!.es });
    expect(dialogue(run).uncovered).toBe(true);
    // Ein zweites „Aufdecken“ ändert nichts und spricht nichts.
    expect(run.send({ type: "uncover" })).toBeNull();
  });

  it("„Noch mal“ verdeckt die Zeile wieder, aber höchstens einmal je Zeile", () => {
    const run = atFirstOwnLine();
    const own = lines[1]!;
    run.send({ type: "uncover" });
    run.send({ type: "again" });
    expect(dialogue(run)).toMatchObject({ uncovered: false, again: [1] });
    expect(html(run.state, run.progress)).not.toContain(spoken(own.es, run.progress));

    run.send({ type: "uncover" });
    const second = html(run.state, run.progress);
    expect(second).toContain(spoken(own.es, run.progress));
    expect(second).toContain("Saß");
    expect(second).not.toContain("Noch mal");
    run.send({ type: "again" }); // nicht mehr möglich
    expect(dialogue(run)).toMatchObject({ uncovered: true, again: [1] });
  });

  it("„Saß“ geht zur nächsten Zeile; eine Zeile der anderen Person wird dabei gesprochen", () => {
    const run = atFirstOwnLine();
    run.send({ type: "uncover" });
    const speak = run.send({ type: "sat" });
    expect(speak).toEqual({ text: lines[2]!.es });
    expect(dialogue(run)).toMatchObject({ shown: 3, uncovered: false, sat: [1] });
  });

  it("vor „Aufdecken“ tun „Saß“, „Noch mal“ und „Weiter“ nichts; die Übersetzung eigener Zeilen lässt sich nicht aufdecken", () => {
    const run = atFirstOwnLine();
    const before = run.state.screen;
    run.send({ type: "sat" });
    run.send({ type: "again" });
    run.send({ type: "next" });
    run.send({ type: "reveal", line: 1 });
    expect(run.state.screen).toEqual(before);
  });

  it("ändert keine Karten und gibt keine Punkte; die 20 Punkte kommen einmal mit dem Ende von Schritt 4", () => {
    const run = atRoleStart();
    const cards = run.progress.cards;
    const points = run.progress.stats.points;
    // Das Rollenspiel bis vor die letzte Zeile spielen, einmal mit „Noch mal“.
    let againUsed = false;
    for (let guard = 0; guard < 40; guard++) {
      const screen = dialogue(run);
      const line = lines[screen.shown - 1]!;
      if (screen.shown === lines.length && line.learner && screen.uncovered) break;
      if (line.learner) {
        if (!screen.uncovered) run.send({ type: "uncover" });
        else if (!againUsed) {
          againUsed = true;
          run.send({ type: "again" });
        } else run.send({ type: "sat" });
      } else run.send({ type: "next" });
    }
    expect(againUsed).toBe(true);
    expect(run.state.screen.kind).toBe("dialogue");
    expect(run.progress.cards).toEqual(cards);
    expect(run.progress.stats.points).toBe(points);
    expect(run.progress.units[U01]?.step).toBe(4);

    run.send({ type: "sat" });
    expect(run.progress.stats.points).toBe(points + 20);
    expect(run.progress.units[U01]?.step).toBe(5);
    expect(run.task.role).toBe("final");
    expect(run.progress.cards).toEqual(cards);
    // Weitere Ereignisse des Rollenspiels wirken nicht mehr.
    run.send({ type: "sat" });
    expect(run.progress.stats.points).toBe(points + 20);
  });

  it("ein Neuladen mitten im Rollenspiel beginnt Schritt 4 von vorn und wertet nichts doppelt", () => {
    const run = atFirstOwnLine();
    run.send({ type: "uncover" });
    run.send({ type: "sat" });
    const points = run.progress.stats.points;
    const cards = run.progress.cards;

    run.reload({ kind: "day", unitId: U01 }, 5, false);
    expect(run.state.screen).toMatchObject({ kind: "plan", button: "Weiter bei Schritt 4" });
    run.send({ type: "begin" });
    expect(dialogue(run)).toMatchObject({ phase: "listen", shown: 1, uncovered: false, again: [], sat: [] });
    expect(run.progress.stats.points).toBe(points);
    expect(run.progress.cards).toEqual(cards);

    expect(play(run)).toBe(true);
    expect(run.progress.stats.points).toBe(FULL_POINTS);
    expect(stopState(run.progress, U01)).toBe("done");
  });

  it("das Rollenspiel zeigt den Zähler „Zeile n von m“ und das Anhören bleibt unverändert", () => {
    const run = atFirstOwnLine();
    expect(html(run.state, run.progress)).toContain(`Zeile 2 von ${lines.length}`);
    expect(html(run.state, run.progress)).toContain("Dialog · Rollenspiel");
  });
});
