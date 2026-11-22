import { describe, expect, it } from "vitest";
import { getUnit, units } from "../../core/content";
import { speakTextOf } from "../../core/tasks";
import type { ChoiceTask } from "../../core/tasks";
import { missionState, stopState } from "../../core/units";
import { counterOf, reduce, stepNumberOf, summaryFacts, withBackground } from "./machine";
import { newDay1, play, playUnit1, Run, U01 } from "./sessionKit";

const MINUTE = 60_000;

const unit01 = getUnit(U01)!;
const FULL_POINTS = unit01.items.length * 10 + unit01.build.length * 10 + 20 + 100;

// ---------- Abnahme ----------

describe("Haltestelle 1 von Anfang bis Ende", () => {
  const { run } = playUnit1();

  it("schließt die Einheit ab, legt 16 Karten in Fach 2 an und öffnet Mission 1", () => {
    expect(stopState(run.progress, U01)).toBe("done");
    expect(missionState(run.progress, unit01.mission.id)).toBe("open");
    const boxes = unit01.items.map((item) => run.progress.cards[item.id]?.box);
    expect(boxes).toHaveLength(16);
    expect(boxes.every((box) => box === 1 || box === 2)).toBe(true);
    expect(run.progress.units[U01]?.answered).toBeUndefined();
    expect(run.progress.units[U01]?.step).toBe(6);
  });

  it("vergibt Punkte für Abschlussrunde, Dialog und Haltestelle genau einmal", () => {
    expect(run.progress.stats.points).toBe(FULL_POINTS);
    expect(run.progress.stats.streak).toBe(1);
  });

  it("endet in der Zusammenfassung mit Zahlen", () => {
    const facts = summaryFacts(run.state, run.progress, "2026-11-23");
    expect(facts).toMatchObject({ kind: "unit", stop: 1, newCards: 16, pointsGained: FULL_POINTS, streak: 1 });
    expect(facts.right).toBe(facts.answered);
    expect(facts.answered).toBe(unit01.items.length + unit01.build.length);
  });

  it("zeigt die Schritte in der Reihenfolge 2, 3, 4, 5, 6", () => {
    const fresh = newDay1();
    const r = new Run(fresh.progress, { kind: "day", unitId: U01 }, fresh.clock);
    const steps: number[] = [];
    const mark = () => {
      const n = stepNumberOf(r.state);
      if (n !== null && steps[steps.length - 1] !== n) steps.push(n);
    };
    mark();
    play(r, { stopWhen: () => (mark(), false) });
    mark();
    expect(steps).toEqual([2, 3, 4, 5, 6]);
  });
});

describe("Neu laden mitten in Schritt 3", () => {
  it("setzt bei Schritt 3 fort", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.role === "cloze" && r.state.screen.cloze?.index === 2 });
    expect(run.progress.units[U01]?.step).toBe(3);
    expect(run.state.screen.kind).toBe("task");

    run.reload({ kind: "day", unitId: U01 });
    expect(run.progress.units[U01]?.step).toBe(3);
    expect(run.state.screen.kind).toBe("grammar");
    expect(run.state.unitId).toBe(U01);
    expect(play(run)).toBe(true);
    expect(stopState(run.progress, U01)).toBe("done");
  });

  it("der Zwischenstand vor Schritt 3 steht schon: 16 Karten angelegt, Lücken ändern nichts", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "grammar" });
    expect(Object.keys(run.progress.cards)).toHaveLength(16);
    const before = run.progress;
    run.send({ type: "next" }); // erster Lückensatz
    run.send({ type: "choose", index: run.task.task.kind === "choice" ? run.task.task.correctIndex : 0 });
    run.send({ type: "next" });
    run.send({ type: "choose", index: 0 });
    expect(run.progress.cards).toEqual(before.cards);
    expect(run.progress.stats.points).toBe(before.stats.points);
  });
});

describe("Folgetag", () => {
  it("beginnt mit „Wiederholen“ und zeigt 16 Karten", () => {
    const { clock, run } = playUnit1();
    clock.advance(1);
    const next = new Run(run.progress, { kind: "day", unitId: "u02" }, clock);
    expect(next.state.screen.kind).toBe("task");
    expect(next.task.role).toBe("review");
    expect(next.task.round?.total).toBe(16);
    expect(counterOf(next.state)).toBe("1 von 16");
    expect(stepNumberOf(next.state)).toBe(1);
  });

  it("nach der Wiederholrunde: Schritt 1 abgeschlossen, Schritt 2 (neue Karten), Runde für heute beendet", () => {
    const { clock, run } = playUnit1();
    clock.advance(1);
    const next = new Run(run.progress, { kind: "day", unitId: "u02" }, clock);
    play(next, { stopWhen: (r) => r.state.screen.kind === "cards" });
    expect(next.state.screen.kind).toBe("cards");
    expect(next.progress.stats.lastReviewDay).toBe("2026-11-24");
    expect(next.progress.units["u02"]?.step).toBe(2);
    expect(next.state.tally.answered).toBe(16);
    expect(next.state.tally.reviewed).toBe(16);
  });

  it("eine Haltestelle, die bei Schritt 3 liegen blieb, beginnt mit der Wiederholrunde und geht bei Schritt 3 weiter", () => {
    const { clock, run } = playUnit1();
    clock.advance(1);
    // Tag 2: Wiederholen mit zwei Fehlern (die kommen am Tag 3 wieder), neue Karten, dann bei Schritt 3 abbrechen.
    const day2 = new Run(run.progress, { kind: "day", unitId: "u02" }, clock);
    play(day2, { wrongInReview: 2, stopWhen: (r) => r.state.screen.kind === "grammar" });
    expect(day2.progress.units["u02"]?.step).toBe(3);

    clock.advance(1);
    day2.reload({ kind: "day", unitId: "u02" });
    expect(day2.state.screen.kind).toBe("task");
    expect(day2.task.role).toBe("review");
    expect(day2.task.round?.total).toBe(2);
    play(day2, { stopWhen: (r) => r.state.screen.kind !== "task" });
    expect(day2.state.screen.kind).toBe("grammar");
    expect(day2.progress.units["u02"]?.step).toBe(3);
    expect(day2.progress.stats.lastReviewDay).toBe("2026-11-25");
  });

  it("ohne Fälliges geht es gleich bei Schritt 3 weiter", () => {
    const { clock, run } = playUnit1();
    clock.advance(1);
    const day2 = new Run(run.progress, { kind: "day", unitId: "u02" }, clock);
    play(day2, { stopWhen: (r) => r.state.screen.kind === "grammar" });
    day2.reload({ kind: "day", unitId: "u02" }); // derselbe Tag: Runde ist beendet
    expect(day2.state.screen.kind).toBe("grammar");
  });

  it("ein Abbruch in der Wiederholrunde beendet die Runde nicht: kein lastReviewDay, Schritt bleibt 1", () => {
    const { clock, run } = playUnit1();
    clock.advance(1);
    const day2 = new Run(run.progress, { kind: "day", unitId: "u02" }, clock);
    for (let i = 0; i < 3; i++) {
      const task = day2.task.task as ChoiceTask;
      day2.send({ type: "choose", index: task.correctIndex });
      day2.send({ type: "next" });
    }
    day2.reload({ kind: "day", unitId: "u02" });
    expect(day2.progress.stats.lastReviewDay).toBeUndefined();
    expect(day2.progress.units["u02"]?.step).toBe(1);
    expect(day2.task.role).toBe("review");
    expect(day2.task.round?.total).toBe(13);
  });

  it("ohne Haltestelle gibt es nur die Wiederholrunde, danach die Zusammenfassung", () => {
    const { clock, run } = playUnit1();
    clock.advance(1);
    const review = new Run(run.progress, { kind: "day", unitId: null }, clock);
    expect(review.state.unitId).toBeNull();
    expect(play(review)).toBe(true);
    const screen = review.state.screen;
    expect(screen.kind === "summary" && screen.summary).toBe("review");
    expect(review.progress.stats.lastReviewDay).toBe("2026-11-24");
    expect(summaryFacts(review.state, review.progress, "2026-11-24")).toMatchObject({ kind: "review", reviewed: 16, answered: 16 });
  });

  it("die Wiederholrunde endet nach 6 Minuten aktiver Zeit, der Rest bleibt fällig", () => {
    const { clock, run } = playUnit1();
    clock.advance(1);
    const day2 = new Run(run.progress, { kind: "day", unitId: "u02" }, clock);
    // Alle 50 Sekunden ein Tippen: nach dem siebten Tippen sind es 350 s, nach dem achten 400 s (Grenze 360 s).
    let taps = 0;
    while (day2.state.screen.kind === "task" && taps < 40) {
      day2.extraMs += 50_000;
      taps++;
      const screen = day2.task;
      day2.send(screen.answer === null ? { type: "choose", index: (screen.task as ChoiceTask).correctIndex } : { type: "next" });
    }
    expect(taps).toBe(8);
    expect(day2.state.activeMs).toBe(400_000);
    expect(day2.state.screen.kind).toBe("cards");
    expect(day2.progress.stats.lastReviewDay).toBe("2026-11-24");
    expect(day2.state.tally.answered).toBe(4);
  });

  it("Pausen über 60 Sekunden zählen für die Grenze von 6 Minuten nicht", () => {
    const { clock, run } = playUnit1();
    clock.advance(1);
    const day2 = new Run(run.progress, { kind: "day", unitId: "u02" }, clock);
    day2.send({ type: "choose", index: (day2.task.task as ChoiceTask).correctIndex });
    day2.extraMs = 7 * MINUTE; // eine lange Pause: zählt höchstens 60 s
    day2.send({ type: "next" });
    expect(day2.state.activeMs).toBe(60_000);
    expect(day2.state.screen.kind).toBe("task");
    expect(day2.task.role).toBe("review");
    expect(day2.progress.stats.lastReviewDay).toBeUndefined();
  });

  it("Zeit im Hintergrund zählt für die Grenze von 6 Minuten nicht", () => {
    const { clock, run } = playUnit1();
    clock.advance(1);
    const day2 = new Run(run.progress, { kind: "day", unitId: "u02" }, clock);
    for (let i = 0; i < 6; i++) {
      day2.send({ type: "background" });
      day2.extraMs += 10 * MINUTE;
      const screen = day2.task;
      day2.send(screen.answer === null ? { type: "choose", index: (screen.task as ChoiceTask).correctIndex } : { type: "next" });
    }
    expect(day2.state.activeMs).toBe(0);
    expect(day2.task.role).toBe("review");
    expect(day2.progress.stats.lastReviewDay).toBeUndefined();
  });
});

describe("Ton im selben Tippen", () => {
  it("die Sitzung beginnt auf dem Fahrplan und schweigt; erst das Tippen auf den Hauptknopf spricht", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock, true, 1, false);
    expect(run.state.screen.kind).toBe("plan");
    expect(run.spoken).toEqual([]);
    const speak = run.send({ type: "begin" });
    expect(run.state.screen.kind).toBe("cards");
    expect(speak).toEqual({ text: speakTextOf(unit01.items[0]!) });
  });

  it("Wiederholen mit Hören an erster Stelle: das Tippen auf „Beginnen“ spricht die erste Aufgabe", () => {
    const { clock, run: day1 } = playUnit1();
    clock.advance(1);
    const day2 = new Run(day1.progress, { kind: "day", unitId: "u02" }, clock, true, 5, false);
    expect(day2.spoken).toEqual([]);
    const speak = day2.send({ type: "begin" });
    const task = day2.task.task;
    expect(task.kind === "choice" && task.type).toBe("listen");
    expect(speak).toEqual({ text: task.kind === "choice" ? task.speak : "" });
  });

  it("neue Karten: „Weiter“ zeigt die nächste Karte und liefert ihren Ton mit demselben Ergebnis", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    const items = unit01.items;
    for (let i = 1; i < 4; i++) {
      const speak = run.send({ type: "next" });
      const screen = run.state.screen;
      expect(screen.kind === "cards" && screen.card).toBe(i);
      expect(speak).toEqual({ text: speakTextOf(items[i]!) });
    }
    expect(run.send({ type: "next" })).toBeNull(); // Wechsel zu den Paaren
    expect(run.state.screen.kind === "cards" && run.state.screen.stage).toBe("pairs");
  });

  it("neuer Block: der Ton der ersten Karte kommt mit dem Tippen auf „Weiter“ nach den Paaren", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "cards" && r.state.screen.stage === "pairs" });
    for (const item of unit01.items.slice(0, 4)) {
      run.send({ type: "pair", side: "left", id: item.id });
      run.send({ type: "pair", side: "right", id: item.id });
    }
    const speak = run.send({ type: "next" });
    const screen = run.state.screen;
    expect(screen.kind === "cards" && [screen.block, screen.stage, screen.card]).toEqual([1, "look", 0]);
    expect(speak).toEqual({ text: speakTextOf(unit01.items[4]!) });
  });

  it("Dialog: der Wechsel in den Dialog und jedes „Weiter“ sprechen die Zeile, die sie zeigen", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    // Alles bis zur letzten Lücke spielen, dann das „Weiter“, das den Dialog öffnet.
    play(run, { stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.role === "cloze" && r.state.screen.cloze?.index === 3 });
    run.send({ type: "choose", index: (run.task.task as ChoiceTask).correctIndex });
    const speak = run.send({ type: "next" });
    const lines = unit01.dialogue.lines;
    expect(run.state.screen).toMatchObject({ kind: "dialogue", shown: 1 });
    expect(speak).toEqual({ text: lines[0]!.es });
    for (let i = 1; i < lines.length; i++) {
      expect(run.send({ type: "next" })).toEqual({ text: lines[i]!.es });
      expect(run.state.screen).toMatchObject({ kind: "dialogue", shown: i + 1 });
    }
    // Nach dem Anhören beginnt das Rollenspiel (kein Punkt, Schritt 4 läuft weiter), erst danach die Abschlussrunde.
    const before = run.progress.stats.points;
    const first = run.send({ type: "next" });
    expect(run.state.screen).toMatchObject({ kind: "dialogue", phase: "role", shown: 1 });
    expect(first).toEqual(lines[0]!.learner ? null : { text: lines[0]!.es });
    expect(run.progress.stats.points).toBe(before);
    expect(run.progress.units[U01]?.step).toBe(4);
  });

  it("Dialog: die Übersetzung deckt sich erst beim Antippen auf, nur für sichtbare Zeilen", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "dialogue" });
    expect(run.state.screen).toMatchObject({ kind: "dialogue", shown: 1, revealed: [] });
    run.send({ type: "reveal", line: 3 });
    expect(run.state.screen).toMatchObject({ revealed: [] });
    run.send({ type: "reveal", line: 0 });
    expect(run.state.screen).toMatchObject({ revealed: [0] });
  });

  it("Hören: das „Weiter“ zu einer Hörenaufgabe liefert den Ton dieser Aufgabe", () => {
    const { clock, run: day1 } = playUnit1();
    clock.advance(1);
    const day2 = new Run(day1.progress, { kind: "day", unitId: "u02" }, clock, true, 5);
    let listenSeen = 0;
    play(day2, {
      stopWhen: (r) => {
        const screen = r.state.screen;
        if (screen.kind === "task" && screen.answer !== null) {
          const probe = reduce(r.state, { type: "next" }, r.progress, r.ctx());
          const nextScreen = probe.state.screen;
          if (nextScreen.kind === "task" && nextScreen.task.kind === "choice" && nextScreen.task.type === "listen") {
            listenSeen++;
            expect(probe.speak).toEqual({ text: nextScreen.task.speak });
          } else if (nextScreen.kind === "task") {
            expect(probe.speak).toBeNull();
          }
        }
        return r.state.screen.kind === "cards";
      },
    });
    // Alle 16 Karten liegen nach Tag 1 in Fach 2 (Hören). Die erste Aufgabe kam ohne Ton, alle weiteren mit.
    expect(listenSeen).toBe(15);
  });
});

describe("Ohne spanische Stimme", () => {
  it("wird aus „Hören“ die Aufgabe „Erkennen“, und die Einheit bleibt durchspielbar", () => {
    const { clock, run: day1 } = playUnit1();
    clock.advance(1);

    const withVoice = new Run(day1.progress, { kind: "day", unitId: "u02" }, clock, true, 3);
    expect(play(withVoice)).toBe(true);
    expect(withVoice.types.has("listen")).toBe(true);

    const noVoice = new Run(day1.progress, { kind: "day", unitId: "u02" }, clock, false, 3);
    expect(noVoice.task.task.type).toBe("recognize");
    expect(play(noVoice)).toBe(true);
    expect(noVoice.types.has("listen")).toBe(false);
    expect(noVoice.types.has("recognize")).toBe(true);
    expect(stopState(noVoice.progress, "u02")).toBe("done");
    expect(missionState(noVoice.progress, units[1]!.mission.id)).toBe("open");
  });
});

describe("Neuladen mitten in der Abschlussrunde", () => {
  it("wertet keine Aufgabe doppelt", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    const total = unit01.items.length + unit01.build.length;
    play(run, { stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.role === "final" && r.state.screen.answer === null && r.state.screen.round?.completed === 5 });
    expect(run.progress.units[U01]?.answered).toHaveLength(5);
    const pointsBefore = run.progress.stats.points;
    const cardsBefore = run.progress.cards;

    run.reload({ kind: "day", unitId: U01 });
    expect(run.task.role).toBe("final");
    expect(run.task.round?.total).toBe(total - 5);
    expect(run.progress.stats.points).toBe(pointsBefore);
    expect(run.progress.cards).toEqual(cardsBefore);
    expect(counterOf(run.state)).toBe(`6 von ${total}`);

    expect(play(run)).toBe(true);
    expect(run.progress.stats.points).toBe(FULL_POINTS);
    expect(stopState(run.progress, U01)).toBe("done");
    for (const item of unit01.items) {
      const card = run.progress.cards[item.id]!;
      expect(card.right).toBe(1);
      expect(card.wrong).toBe(0);
    }
  });

  it("ein Fehler vor dem Neuladen zählt einmal, die Wiedervorlage danach nicht erneut", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.role === "final" });
    const first = run.task.task as ChoiceTask;
    run.send({ type: "choose", index: (first.correctIndex + 1) % first.options.length });
    const id = first.itemId!;
    expect(run.progress.cards[id]?.wrong).toBe(1);
    run.send({ type: "next" });
    run.reload({ kind: "day", unitId: U01 });
    expect(play(run)).toBe(true);
    expect(run.progress.cards[id]?.wrong).toBe(1);
    expect(run.progress.cards[id]?.right).toBe(0);
    expect(run.progress.cards[id]?.box).toBe(1);
  });
});

describe("Freie Runde „10 Karten extra“", () => {
  it("ändert keine Fächer und keine Punkte und endet in der Zusammenfassung", () => {
    const { clock, run: day1 } = playUnit1();
    const before = day1.progress;
    const extra = new Run(before, { kind: "extra" }, clock);
    expect(extra.task.role).toBe("extra");
    expect(extra.task.round?.total).toBe(10);
    expect(extra.task.round?.practice).toBe(true);
    // Mit Fehlern spielen: Auch Fehler ändern nichts.
    let wrong = 3;
    while (extra.state.screen.kind === "task") {
      const screen = extra.task;
      if (screen.answer === null) {
        const task = screen.task as ChoiceTask;
        const index = wrong-- > 0 ? (task.correctIndex + 1) % task.options.length : task.correctIndex;
        extra.send({ type: "choose", index });
      } else {
        extra.send({ type: "next" });
      }
    }
    expect(extra.state.screen).toMatchObject({ kind: "summary", summary: "extra" });
    expect(extra.progress.stats.points).toBe(before.stats.points);
    for (const [id, card] of Object.entries(before.cards)) {
      expect(extra.progress.cards[id]?.box).toBe(card.box);
      expect(extra.progress.cards[id]?.due).toBe(card.due);
      expect(extra.progress.cards[id]?.right).toBe(card.right);
      expect(extra.progress.cards[id]?.wrong).toBe(card.wrong);
    }
    expect(summaryFacts(extra.state, extra.progress, "2026-11-23")).toMatchObject({ kind: "extra", pointsGained: 0 });
  });

  it("ohne abgeschlossene Haltestelle gibt es nichts zu üben: gleich die Zusammenfassung", () => {
    const { clock, progress } = newDay1();
    const extra = new Run(progress, { kind: "extra" }, clock);
    expect(extra.state.screen).toMatchObject({ kind: "summary", summary: "extra" });
  });
});

describe("Paare", () => {
  it("ein falsches Paar bleibt markiert, bis die nächste Zeile angetippt wird; Paare ändern keine Fächer", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "cards" && r.state.screen.stage === "pairs" });
    const [a, b, c] = unit01.items;
    const pairs = () => (run.state.screen.kind === "cards" ? run.state.screen.pairs : null)!;

    run.send({ type: "pair", side: "left", id: a!.id });
    expect(pairs().selected).toEqual({ side: "left", id: a!.id });
    run.send({ type: "pair", side: "right", id: b!.id });
    expect(pairs().wrong).toEqual({ left: a!.id, right: b!.id });
    expect(pairs().found).toEqual([]);

    // „Weiter“ geht erst mit vier gefundenen Paaren.
    const before = run.state;
    run.send({ type: "next" });
    expect(run.state.screen).toEqual(before.screen);

    run.send({ type: "pair", side: "left", id: c!.id });
    expect(pairs().wrong).toBeNull();
    expect(pairs().selected).toEqual({ side: "left", id: c!.id });
    run.send({ type: "pair", side: "right", id: c!.id });
    expect(pairs().found).toEqual([c!.id]);
    expect(run.progress.cards).toEqual({});
  });
});

describe("Lernzeit", () => {
  it("zählt die Zeit zwischen Eingaben, höchstens 60 Sekunden, und nichts nach dem Hintergrund", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    const day = "2026-11-23";
    run.extraMs = 5_000;
    run.send({ type: "next" });
    expect(run.progress.stats.activeMsByDay[day]).toBe(5_000);
    run.extraMs = 5_000 + 200_000; // lange Pause: höchstens 60 s
    run.send({ type: "next" });
    expect(run.progress.stats.activeMsByDay[day]).toBe(65_000);
    run.state = withBackground(run.state);
    expect(run.state.lastInputMs).toBeNull();
    run.extraMs += 30_000;
    run.send({ type: "next" });
    expect(run.progress.stats.activeMsByDay[day]).toBe(65_000);
    run.extraMs += 10_000;
    run.send({ type: "next" });
    expect(run.progress.stats.activeMsByDay[day]).toBe(75_000);
  });

  it("das Ereignis „background“ setzt die Uhr auf null, ohne etwas zu speichern", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    const before = run.progress;
    run.send({ type: "background" });
    expect(run.state.lastInputMs).toBeNull();
    expect(run.progress).toBe(before);
  });
});

describe("Aufgaben", () => {
  it("Weiter vor der Antwort tut nichts, eine zweite Antwort auf dieselbe Aufgabe zählt nicht", () => {
    const { clock, run: day1 } = playUnit1();
    clock.advance(1);
    const day2 = new Run(day1.progress, { kind: "day", unitId: "u02" }, clock);
    const first = day2.state;
    day2.send({ type: "next" });
    expect(day2.state.screen).toEqual(first.screen);
    const task = day2.task.task as ChoiceTask;
    day2.send({ type: "choose", index: task.correctIndex });
    const points = day2.progress.stats.points;
    day2.send({ type: "choose", index: (task.correctIndex + 1) % task.options.length });
    expect(day2.progress.stats.points).toBe(points);
    expect(day2.task.answer?.correct).toBe(true);
  });

  it("die Rückmeldung nennt bei einem Fehler die gewählte Antwort und die Lösung", () => {
    const { clock, run: day1 } = playUnit1();
    clock.advance(1);
    const day2 = new Run(day1.progress, { kind: "day", unitId: "u02" }, clock);
    const task = day2.task.task as ChoiceTask;
    const wrongIndex = (task.correctIndex + 1) % task.options.length;
    day2.send({ type: "choose", index: wrongIndex });
    expect(day2.task.answer).toMatchObject({ correct: false, solution: task.solution, chosen: task.options[wrongIndex] });
    expect(day2.task.chosen).toBe(wrongIndex);
    // Fach 2 falsch: zurück in Fach 1, fällig morgen.
    expect(day2.progress.cards[task.itemId!]).toMatchObject({ box: 1, due: "2026-11-25" });
  });

  it("Satzbau: erst prüfbar, wenn alle Bausteine gesetzt sind; zurücknehmen geht", () => {
    const { clock, progress } = newDay1();
    const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.task.kind === "build" });
    const task = run.task.task;
    if (task.kind !== "build") throw new Error("Satzbau erwartet");
    run.send({ type: "place", index: 0 });
    run.send({ type: "check" });
    expect(run.task.answer).toBeNull();
    run.send({ type: "unplace", index: 0 });
    expect(run.task.placed).toEqual([]);
    for (let i = 0; i < task.tokens.length; i++) run.send({ type: "place", index: i });
    run.send({ type: "check" });
    expect(run.task.answer?.chosen).toBe(task.tokens.join(" "));
  });
});
