import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MAX_WRITE_TASKS_PER_ROUND } from "../../core/config";
import { allItems } from "../../core/content";
import { isWritable } from "../../core/tasks";
import { checkWritten } from "../../core/answer";
import type { Progress } from "../../core/types";
import type { SessionState, TaskScreen } from "./machine";
import { SessionScreen } from "./SessionScreen";
import { playUnit1, Run } from "./sessionKit";
import { insertAtCaret, SPECIAL_CHARS } from "./writeInput";

function decode(html: string): string {
  return html.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
}

function html(state: SessionState, progress: Progress): string {
  return decode(
    renderToStaticMarkup(
      <SessionScreen state={state} progress={progress} day="2026-11-24" hasVoice onEvent={() => {}} onSpeak={() => {}} onClose={() => {}} onExit={() => {}} />,
    ),
  );
}

/** Haltestelle 1 geschafft, am nächsten Tag stehen alle 16 Karten in `box` und sind fällig. */
function nextDayWithBox(box: 2 | 3 | 4 | 5) {
  const { clock, run } = playUnit1();
  clock.advance(1);
  const cards = Object.fromEntries(Object.entries(run.progress.cards).map(([id, card]) => [id, { ...card, box, due: "2026-11-24" }]));
  const progress: Progress = { ...run.progress, cards };
  return { clock, progress };
}

describe("Aufgabe „Schreiben“ in der Wiederholrunde", () => {
  it("eine Karte in Fach 3 kommt als Schreibaufgabe (höchstens sechs), ein Satzmuster nie", () => {
    const { clock, progress } = nextDayWithBox(3);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const round = run.task.round!;
    const tasks = round.queue;
    expect(tasks).toHaveLength(16);
    const byId = new Map(allItems.map((item) => [item.id, item]));
    let writes = 0;
    for (const task of tasks) {
      const item = byId.get(task.itemId!)!;
      if (!isWritable(item)) expect(task.type).toBe("recall");
      else if (writes < MAX_WRITE_TASKS_PER_ROUND) {
        expect(task.type).toBe("write");
        writes++;
      } else expect(task.type).toBe("say");
    }
    expect(writes).toBe(MAX_WRITE_TASKS_PER_ROUND);
    expect(tasks.some((task) => task.type === "recall")).toBe(true);
  });

  it("Fach 1 und 2 bleiben Erkennen und Hören", () => {
    const { clock, progress } = nextDayWithBox(2);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    expect(new Set(run.task.round!.queue.map((task) => task.type))).toEqual(new Set(["listen"]));
  });

  function firstWrite(run: Run): TaskScreen {
    for (let guard = 0; guard < 40; guard++) {
      const screen = run.task;
      if (screen.task.kind === "write" && screen.answer === null) return screen;
      if (screen.answer === null) run.send({ type: "choose", index: screen.task.kind === "choice" ? screen.task.correctIndex : 0 });
      run.send({ type: "next" });
    }
    throw new Error("Keine Schreibaufgabe");
  }

  it("richtig getippt: Fach steigt, Punkte; Leerzeichen und Großschreibung zählen nicht", () => {
    const { clock, progress } = nextDayWithBox(3);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const screen = firstWrite(run);
    const task = screen.task;
    if (task.kind !== "write") throw new Error("Schreiben erwartet");
    const points = run.progress.stats.points;
    run.send({ type: "submitText", text: `  ${task.solution.toUpperCase()} ` });
    expect(run.task.answer).toMatchObject({ correct: true });
    // Gewertet wird erst mit dem Weitergehen.
    expect(run.progress.cards[task.itemId]?.box).toBe(3);
    run.send({ type: "next" });
    expect(run.progress.cards[task.itemId]?.box).toBe(4);
    expect(run.progress.stats.points).toBe(points + 10);
  });

  it("falsch getippt: zurück in Fach 1, Rückmeldung nennt Lösung und getippte Antwort; leer tut nichts", () => {
    const { clock, progress } = nextDayWithBox(3);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    const screen = firstWrite(run);
    const task = screen.task;
    if (task.kind !== "write") throw new Error("Schreiben erwartet");
    run.send({ type: "submitText", text: "   " });
    expect(run.task.answer).toBeNull();
    run.send({ type: "submitText", text: "qqqq" });
    expect(run.task.answer).toMatchObject({ correct: false, solution: task.solution, chosen: "qqqq" });
    expect(run.progress.cards[task.itemId]).toMatchObject({ box: 3 });
    const page = html(run.state, run.progress);
    expect(page).toContain("Falsch. Richtig ist:");
    expect(page).toContain("Deine Antwort:");
    expect(page).toContain("qqqq");
    run.send({ type: "next" });
    expect(run.progress.cards[task.itemId]).toMatchObject({ box: 1, due: "2026-11-25" });
  });

  it("fehlender Akzent: richtig mit Hinweis „Richtig. Achte auf den Akzent: …“, Fach steigt", () => {
    const { clock, progress } = nextDayWithBox(3);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    // Eine Schreibaufgabe, deren Lösung einen Akzent (aber kein ñ) hat.
    let found: TaskScreen | null = null;
    for (let guard = 0; guard < 40 && !found; guard++) {
      const screen = run.task;
      if (screen.answer === null && screen.task.kind === "write" && /[áéíóú]/.test(screen.task.solution) && !/ñ/.test(screen.task.solution)) found = screen;
      else {
        if (screen.answer === null) {
          if (screen.task.kind === "choice") run.send({ type: "choose", index: screen.task.correctIndex });
          else run.send({ type: "submitText", text: screen.task.kind === "write" ? screen.task.solution : "" });
        }
        run.send({ type: "next" });
      }
    }
    if (!found || found.task.kind !== "write") throw new Error("Keine passende Schreibaufgabe");
    const task = found.task;
    const stripped = task.solution.normalize("NFD").replace(/[̀-ͯ]/g, "");
    run.send({ type: "submitText", text: stripped });
    expect(run.task.answer).toMatchObject({ correct: true, verdict: "accent", accentHint: task.solution });
    const page = html(run.state, run.progress);
    expect(page).toContain("Richtig. Achte auf den Akzent:");
    expect(page).toContain(task.solution);
    run.send({ type: "next" });
    expect(run.progress.cards[task.itemId]?.box).toBe(4);
  });

  it("„esta“ für „está“ ist richtig mit Hinweis, „manana“ für „mañana“ ist falsch", () => {
    expect(checkWritten("esta", "está")).toMatchObject({ correct: true, verdict: "accent" });
    expect(checkWritten("manana", "mañana")).toMatchObject({ correct: false, verdict: "wrong" });
  });
});

describe("Eingabefeld und Zeichenknöpfe", () => {
  function writePage(): string {
    const { clock, progress } = nextDayWithBox(3);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    for (let guard = 0; guard < 40; guard++) {
      const screen = run.task;
      if (screen.task.kind === "write") return html(run.state, run.progress);
      run.send({ type: "choose", index: screen.task.kind === "choice" ? screen.task.correctIndex : 0 });
      run.send({ type: "next" });
    }
    throw new Error("Keine Schreibaufgabe");
  }

  it("das Feld schaltet Autokorrektur, Großschreibung und Rechtschreibprüfung ab und trägt lang=es", () => {
    const page = writePage();
    const input = page.match(/<input[^>]*>/)?.[0] ?? "";
    expect(input).toContain('lang="es"');
    expect(input).toContain('autoCapitalize="none"');
    expect(input).toContain('autoCorrect="off"');
    expect(input).toContain('spellCheck="false"');
    expect(input).toContain('enterKeyHint="go"');
  });

  it("neun Zeichenknöpfe mit lang=es, „Prüfen“ gesperrt bei leerem Feld und unter dem Feld", () => {
    const page = writePage();
    for (const char of SPECIAL_CHARS) expect(page).toContain(`lang="es" class="sx-char es" aria-label="${char} einfügen">${char}</button>`);
    expect(SPECIAL_CHARS.join("")).toBe("áéíóúñü¿¡");
    expect(page).toMatch(/<button type="button" class="btn" disabled="">Prüfen<\/button>/);
    expect(page.indexOf("sx-chars")).toBeLessThan(page.indexOf(">Prüfen<"));
    // „Prüfen“ steht im Inhalt, nicht in der festen Leiste unten.
    expect(page).not.toContain("action-bar");
  });

  it("die Eingabetaste löst „Prüfen“ aus: Das Feld sitzt in einem Formular, dessen Absenden prüft", () => {
    const page = writePage();
    expect(page).toMatch(/<form[^>]*>.*<input/s);
  });

  it("Zeichen werden an der Schreibmarke eingefügt, eine Auswahl wird ersetzt", () => {
    expect(insertAtCaret("manana", 2, 3, "ñ")).toEqual({ value: "mañana", caret: 3 });
    expect(insertAtCaret("maana", 2, 2, "ñ")).toEqual({ value: "mañana", caret: 3 });
    expect(insertAtCaret("", 0, 0, "¿")).toEqual({ value: "¿", caret: 1 });
    expect(insertAtCaret("xyz", 0, 3, "á")).toEqual({ value: "á", caret: 1 });
    expect(insertAtCaret("abc", 99, 99, "ü")).toEqual({ value: "abcü", caret: 4 });
    expect(insertAtCaret("abc", 2, 1, "é")).toEqual({ value: "aéc", caret: 2 });
  });

  it("nach der Antwort ist das Feld gesperrt und „Weiter“ steht in der Leiste", () => {
    const { clock, progress } = nextDayWithBox(3);
    const run = new Run(progress, { kind: "day", unitId: null }, clock);
    for (let guard = 0; guard < 40 && run.task.task.kind !== "write"; guard++) {
      const screen = run.task;
      run.send({ type: "choose", index: screen.task.kind === "choice" ? screen.task.correctIndex : 0 });
      run.send({ type: "next" });
    }
    run.send({ type: "submitText", text: "qqq" });
    const page = html(run.state, run.progress);
    expect(page).toMatch(/<input[^>]*disabled=""/);
    expect(page).toContain("action-bar");
    expect(page).toContain(">Weiter<");
    expect(page).not.toContain(">Prüfen<");
  });
});
