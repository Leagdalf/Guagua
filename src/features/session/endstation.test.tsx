import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { allItems, units } from "../../core/content";
import { parseProgress } from "../../core/progress";
import { MAX_WRITE_TASKS_PER_ROUND, STORAGE_KEY } from "../../core/config";
import { taskTypeForReview } from "../../core/tasks";
import type { Box, Progress, Step } from "../../core/types";
import { completeStep, finalStationState, startUnit } from "../../core/units";
import { counterOf } from "./machine";
import type { SessionState } from "./machine";
import { SessionScreen } from "./SessionScreen";
import { newDay1, play, playUnit1, Run } from "./sessionKit";

const FINAL: { kind: "final" } = { kind: "final" };

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

/** Alle zehn Haltestellen geschafft, die Karten in den Fächern `boxOf(Index)`, alle erst am 30.12. fällig (nichts zu wiederholen). */
function atStation(boxOf: (index: number) => Box = () => 2, due = "2026-12-30") {
  const { clock, progress } = newDay1();
  let p = progress;
  for (const unit of units) {
    p = startUnit(p, unit.id, clock.now);
    for (const step of [1, 2, 3, 4, 5] as Step[]) p = completeStep(p, unit.id, step, clock.now);
  }
  const cards = Object.fromEntries(allItems.map((item, i) => [item.id, { ...p.cards[item.id]!, box: boxOf(i), due }]));
  return { clock, progress: { ...p, cards } satisfies Progress };
}

describe("Endstation: gesperrt und offen", () => {
  it("gesperrt vor Haltestelle 10: die Anfrage wird zu einer Sitzung nur zum Wiederholen und die Endstation bleibt zu", () => {
    const { clock, run: day1 } = playUnit1();
    expect(finalStationState(day1.progress)).toBe("locked");
    clock.advance(1);
    const run = new Run(day1.progress, FINAL, clock, true, 1, false);
    expect(run.state.request).toEqual({ kind: "day", unitId: null });
    expect(run.state.screen).toMatchObject({ kind: "plan", label: "Heute", title: { text: "Wiederholen" } });
    expect(play(run)).toBe(true);
    expect(run.state.screen.kind).toBe("summary");
    expect(run.progress.finalReview).toBeUndefined();
    expect(run.progress.finalRun).toBeUndefined();
  });

  it("offen nach Haltestelle 10: Fahrplan mit Endstation und 30 Aufgaben, erst das Tippen baut die Runde", () => {
    const { clock, progress } = atStation();
    expect(finalStationState(progress)).toBe("open");
    const run = new Run(progress, FINAL, clock, true, 1, false);
    expect(run.state.screen).toMatchObject({
      kind: "plan",
      label: "Heute · Endstation",
      title: { text: "Repaso final", spanish: true },
      button: "Beginnen",
      rows: [{ step: null, name: "Endstation", detail: "30 Aufgaben", done: false }],
    });
    expect(run.progress.finalRun).toBeUndefined();
    run.send({ type: "begin" });
    expect(run.task.role).toBe("station");
    expect(run.task.round?.total).toBe(30);
    expect(counterOf(run.state)).toBe("1 von 30");
    expect(run.progress.finalRun?.ids).toHaveLength(30);
  });

  it("steht Wiederholen aus, kommt es zuerst; die Auswahl der 30 Karten folgt erst danach", () => {
    const { clock, progress } = atStation(() => 2, "2026-11-23");
    const run = new Run(progress, FINAL, clock, true, 1, false);
    expect(run.state.screen).toMatchObject({ kind: "plan", rows: [{ step: 1, name: "Wiederholen", detail: "40 Karten" }, { name: "Endstation", detail: "30 Aufgaben" }] });
    run.send({ type: "begin" });
    expect(run.task.role).toBe("review");
    expect(run.progress.finalRun).toBeUndefined();
    play(run, { stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.role === "station" });
    expect(run.task.role).toBe("station");
    expect(run.progress.stats.lastReviewDay).toBe("2026-11-23");
    expect(run.progress.finalRun?.ids).toHaveLength(30);
  });
});

describe("Endstation: 30 Aufgaben", () => {
  it("Karten aus Fach 1 bis 3 kommen zuerst, der Rest danach; der Aufgabentyp folgt dem Fach", () => {
    const low = new Set(allItems.slice(0, 12).map((item) => item.id));
    const { clock, progress } = atStation((i) => (i < 12 ? ((1 + (i % 3)) as Box) : ((4 + (i % 2)) as Box)));
    const run = new Run(progress, FINAL, clock);
    const ids = run.progress.finalRun!.ids;
    expect(ids).toHaveLength(30);
    expect(ids.slice(0, 12).every((id) => low.has(id))).toBe(true);
    expect(ids.slice(12).every((id) => !low.has(id))).toBe(true);
    expect(new Set(ids).size).toBe(30);
    const queue = run.task.round!.queue;
    expect(queue.map((task) => task.itemId)).toEqual(ids);
    // Der Typ folgt dem Fach; die ersten sechs Schreibaufgaben bleiben, weitere Karten ab Fach 3 kommen als „Sag es laut“.
    let writes = 0;
    for (const task of queue) {
      const item = allItems.find((entry) => entry.id === task.itemId)!;
      expect(task.type).toBe(taskTypeForReview(item, progress.cards[item.id]!.box, { hasSpanishVoice: true }, writes));
      if (task.type === "write") writes++;
    }
    expect(writes).toBeLessThanOrEqual(MAX_WRITE_TASKS_PER_ROUND);
    expect(queue.some((task) => task.type === "write")).toBe(true);
    expect(queue.some((task) => task.type === "listen")).toBe(true);
  });

  it("sind weniger als 30 Karten in Fach 1 bis 3, füllt der Rest zufällig auf", () => {
    const { clock, progress } = atStation((i) => (i < 5 ? 1 : 5));
    const run = new Run(progress, FINAL, clock);
    expect(run.progress.finalRun!.ids).toHaveLength(30);
    expect(run.task.round?.queue.slice(0, 5).every((task) => progress.cards[task.itemId!]!.box === 1)).toBe(true);
  });

  it("alles richtig: Ergebnis in finalReview, Endstation geschafft, „Deine Linie“, 10 Punkte je Aufgabe", () => {
    const { clock, progress } = atStation();
    const run = new Run(progress, FINAL, clock);
    const points = run.progress.stats.points;
    expect(play(run)).toBe(true);
    expect(run.state.screen.kind).toBe("line");
    expect(run.progress.finalReview).toMatchObject({ right: 30, total: 30 });
    expect(run.progress.finalRun).toBeUndefined();
    expect(finalStationState(run.progress)).toBe("done");
    expect(run.progress.stats.points).toBe(points + 300);
    // Im Speicher, nicht nur im Zustand.
    const reread = parseProgress(run.storage.getItem(STORAGE_KEY));
    if (reread.status !== "ok") throw new Error("Fortschritt nicht lesbar");
    expect(reread.progress.finalReview).toMatchObject({ right: 30, total: 30 });
  });

  it("vier Fehler: 26 von 30, jede erste Antwort zählt einmal, die Wiedervorlage nicht", () => {
    const { clock, progress } = atStation();
    const run = new Run(progress, FINAL, clock);
    play(run, { wrongInStation: 4 });
    expect(run.progress.finalReview).toMatchObject({ right: 26, total: 30 });
    const wrongCards = Object.values(run.progress.cards).filter((card) => card.wrong === 1);
    expect(wrongCards).toHaveLength(4);
    expect(wrongCards.every((card) => card.box === 1)).toBe(true);
  });

  it("die Endstation ändert die Fächer der gewählten Karten", () => {
    const { clock, progress } = atStation(() => 2);
    const run = new Run(progress, FINAL, clock);
    const ids = new Set(run.progress.finalRun!.ids);
    play(run);
    for (const item of allItems) {
      const box = run.progress.cards[item.id]!.box;
      expect(box).toBe(ids.has(item.id) ? 3 : 2);
    }
  });
});

describe("Endstation: Neuladen mitten in der Runde", () => {
  it("wertet keine Aufgabe doppelt: dieselben Karten, Rest der Runde, Zähler über alle 30, Ergebnis stimmt", () => {
    const { clock, progress } = atStation();
    const run = new Run(progress, FINAL, clock);
    const ids = run.progress.finalRun!.ids;
    play(run, { wrongInStation: 2, stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.role === "station" && r.state.screen.answer === null && r.state.screen.round?.completed === 12 });
    const stored = run.progress.finalRun!;
    expect(stored.answered).toHaveLength(12);
    const points = run.progress.stats.points;
    const cards = run.progress.cards;

    run.reload(FINAL, 7, false);
    expect(run.state.screen).toMatchObject({ kind: "plan", button: "Weiter bei Aufgabe 13", rows: [{ name: "Endstation", detail: "30 Aufgaben" }] });
    expect(run.progress.finalRun).toEqual(stored);
    run.send({ type: "begin" });
    expect(run.task.role).toBe("station");
    expect(run.task.round?.total).toBe(18);
    expect(run.task.round?.queue.map((task) => task.itemId)).toEqual(ids.filter((id) => !stored.answered.includes(id)));
    expect(counterOf(run.state)).toBe("13 von 30");
    expect(run.progress.stats.points).toBe(points);
    expect(run.progress.cards).toEqual(cards);

    expect(play(run)).toBe(true);
    expect(run.progress.finalReview).toMatchObject({ total: 30 });
    // 18 weitere richtige erste Antworten, dazu die richtigen von vor dem Neuladen (zwei der ersten zwölf waren falsch).
    expect(stored.right).toBe(10);
    expect(run.progress.finalReview?.right).toBe(18 + stored.right);
    for (const id of ids) {
      const card = run.progress.cards[id]!;
      expect(card.right + card.wrong, id).toBe(1);
    }
  });

  it("Ergebnis nach dem Neuladen: frühere Fehler bleiben Fehler", () => {
    const { clock, progress } = atStation();
    const run = new Run(progress, FINAL, clock);
    play(run, { wrongInStation: 3, stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.role === "station" && r.state.screen.answer === null && r.state.screen.round?.completed === 10 });
    // Die drei Fehler lagen unter den ersten zehn Aufgaben und stehen im Merker.
    expect(run.progress.finalRun?.right).toBe(7);
    run.reload(FINAL, 3);
    play(run);
    expect(run.progress.finalReview).toMatchObject({ right: 27, total: 30 });
  });

  it("nach der letzten Antwort, vor „Weiter“, beendet ein Neuladen die Endstation beim Tippen auf den Fahrplan", () => {
    const { clock, progress } = atStation();
    const run = new Run(progress, FINAL, clock);
    play(run, { stopWhen: (r) => r.state.screen.kind === "task" && r.state.screen.role === "station" && r.state.screen.answer !== null && r.state.screen.round?.queue.length === 0 });
    expect(run.progress.finalReview).toBeUndefined();
    expect(run.progress.finalRun?.answered).toHaveLength(30);
    run.reload(FINAL, 3, false);
    run.send({ type: "begin" });
    expect(run.state.screen.kind).toBe("line");
    expect(run.progress.finalReview).toMatchObject({ right: 30, total: 30 });
    expect(run.progress.finalRun).toBeUndefined();
  });
});

describe("Deine Linie", () => {
  function finished(calm = false) {
    const { clock, progress } = atStation();
    const run = new Run({ ...progress, profile: { ...progress.profile, calm } }, FINAL, clock);
    run.extraMs = 0;
    play(run, { wrongInStation: 4 });
    return run;
  }

  it("nach der Endstation erreichbar: Karten je Fach, Missionen, aktive Tage, Lernzeit, Ergebnis, Berg im Endzustand", () => {
    const run = finished();
    expect(run.state.screen.kind).toBe("line");
    const page = html(run.state, run.progress);
    expect(page).toContain("Deine Linie");
    for (let box = 1; box <= 5; box++) expect(page).toContain(`Fach ${box}`);
    expect(page).toContain("Missionen erledigt");
    expect(page).toContain("0 von 10");
    expect(page).toContain("Aktive Tage");
    expect(page).toContain("Lernzeit");
    expect(page).toContain("26 von 30 richtig");
    expect(page).toContain("Zur Linie");
    expect(page.match(/<g data-state="done"/g)).toHaveLength(10);
    // Die Karten je Fach ergeben alle 154.
    const total = [1, 2, 3, 4, 5].reduce((sum, box) => sum + Number(new RegExp(`Fach ${box}</dt><dd[^>]*>(\\d+) Karte`).exec(page)?.[1] ?? 0), 0);
    expect(total).toBe(154);
  });

  it("zeigt Punkte und Serie, im Ruhemodus nicht", () => {
    const normal = finished(false);
    const normalPage = html(normal.state, normal.progress);
    expect(normalPage).toContain("Punkte");
    const calm = finished(true);
    const calmPage = html(calm.state, calm.progress);
    expect(calmPage).not.toContain("Punkte");
    expect(calmPage).not.toContain("Serie");
    expect(calmPage).toContain("26 von 30 richtig");
  });

  it("die Sitzung hält auf „Deine Linie“; ein neuer Start der Endstation wird zur Wiederholung, die Endstation bleibt geschafft", () => {
    const run = finished();
    const result = run.progress.finalReview;
    const before = run.state.screen;
    run.send({ type: "next" });
    run.send({ type: "begin" });
    expect(run.state.screen).toEqual(before);
    run.reload(FINAL, 3, false);
    expect(run.state.request).toEqual({ kind: "day", unitId: null });
    expect(run.progress.finalReview).toEqual(result);
  });
});
