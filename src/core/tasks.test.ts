import { describe, expect, it } from "vitest";
import { WRITE_TASK_ENABLED } from "./config";
import { allItems, units } from "./content";
import { buildBuildTasks, buildClozeTasks, buildFinalRoundTasks, buildNewCardBlocks, evaluateBuild, evaluateChoice, evaluateWrite, makeItemTask, makeReviewTask, taskTypeForReview } from "./tasks";
import type { ChoiceTask, WriteTask } from "./tasks";
import { createRng } from "./random";
import type { Box, TaskType } from "./types";

const env = { hasSpanishVoice: true };
const boxes: Box[] = [1, 2, 3, 4, 5];

function assertCleanChoice(task: ChoiceTask, answer: string): void {
  if (task.type !== "cloze") expect(task.options).toHaveLength(4);
  const keys = task.options.map((option) => option.trim().toLowerCase());
  expect(new Set(keys).size).toBe(keys.length);
  expect(task.options.filter((option) => option === answer)).toHaveLength(1);
  expect(task.options[task.correctIndex]).toBe(answer);
}

describe("Auswahlaufgaben", () => {
  it("haben vier verschiedene Antworten und die richtige genau einmal, für alle 154 Karten in beiden Richtungen", () => {
    expect(allItems).toHaveLength(154);
    for (const seed of [1, 2, 3]) {
      const rng = createRng(seed);
      for (const item of allItems) {
        // Erkennen und Hören fragen Deutsch ab, Erinnern fragt Spanisch ab.
        for (const type of ["recognize", "listen"] as const) {
          const task = makeItemTask(item, type, rng, env) as ChoiceTask;
          expect(task.type).toBe(type);
          assertCleanChoice(task, item.de);
        }
        const recall = makeItemTask(item, "recall", rng, env) as ChoiceTask;
        expect(recall.type).toBe("recall");
        assertCleanChoice(recall, item.es);
      }
    }
  });

  it("falsche Antworten stammen aus derselben Einheit, wenn sie genug Karten hat", () => {
    const rng = createRng(5);
    for (const unit of units) {
      const own = new Set(unit.items.map((item) => item.de));
      for (const item of unit.items) {
        const task = makeItemTask(item, "recognize", rng, env) as ChoiceTask;
        for (const option of task.options) expect(own.has(option)).toBe(true);
      }
    }
  });

  it("bei gleichem Startwert reproduzierbar", () => {
    const build = (seed: number) => allItems.slice(0, 30).map((item) => makeItemTask(item, "recall", createRng(seed), env));
    expect(build(42)).toEqual(build(42));
    expect(build(42)).not.toEqual(build(43));
  });

  it("Lückensätze: Antwort genau einmal in den Optionen, Lösung ist der volle Satz", () => {
    for (const unit of units) {
      const tasks = buildClozeTasks(unit.id, createRng(9));
      expect(tasks).toHaveLength(unit.cloze.length);
      tasks.forEach((task, i) => {
        const cloze = unit.cloze[i]!;
        assertCleanChoice(task, cloze.answer);
        expect(task.solution).toBe(cloze.es.replace("___", cloze.answer));
        expect(task.itemId).toBeNull();
      });
    }
  });
});

describe("Aufgabentyp beim Wiederholen", () => {
  const word = allItems.find((item) => item.kind === "word")!;
  const frame = allItems.find((item) => item.kind === "frame")!;

  it("folgt dem Fach: 1 Erkennen, 2 Hören, ab 3 Schreiben (Schalter WRITE_TASK_ENABLED ist an)", () => {
    expect(WRITE_TASK_ENABLED).toBe(true);
    const types = boxes.map((box) => taskTypeForReview(word, box, env));
    expect(types).toEqual(["recognize", "listen", "write", "write", "write"]);
  });

  it("ist Schreiben ausgeschaltet, springt „Erinnern“ ein", () => {
    const types = boxes.map((box) => taskTypeForReview(word, box, { ...env, writeEnabled: false }));
    expect(types).toEqual(["recognize", "listen", "recall", "recall", "recall"]);
  });

  it("eine Wendung in Fach 3 kommt als Schreibaufgabe mit der deutschen Frage", () => {
    const phrase = allItems.find((item) => item.kind === "phrase")!;
    const task = makeReviewTask(phrase.id, 3, createRng(1), env);
    expect(task).toMatchObject({ kind: "write", prompt: phrase.de, solution: phrase.es });
  });

  it("ohne spanische Stimme wird aus „listen“ „recognize“", () => {
    expect(taskTypeForReview(word, 2, { hasSpanishVoice: false })).toBe("recognize");
    const task = makeReviewTask(word.id, 2, createRng(1), { hasSpanishVoice: false });
    expect(task.type).toBe("recognize");
    expect(makeItemTask(word, "listen", createRng(1), { hasSpanishVoice: false }).type).toBe("recognize");
  });

  it("Satzmuster erscheinen nie als Schreibaufgabe", () => {
    const frames = allItems.filter((item) => item.kind === "frame");
    expect(frames.length).toBeGreaterThan(0);
    for (const item of frames) {
      for (const box of boxes) {
        for (const writeEnabled of [false, true]) {
          for (const hasSpanishVoice of [false, true]) {
            const task = makeReviewTask(item.id, box, createRng(3), { hasSpanishVoice, writeEnabled });
            expect(task.type).not.toBe("write");
            expect(task.kind).not.toBe("write");
          }
        }
      }
      expect(makeItemTask(item, "write", createRng(3), env).type).toBe("recall");
    }
  });

  it("Satzmuster zeigen ihren Beispielsatz und lesen ihn vor", () => {
    const recognize = makeItemTask(frame, "recognize", createRng(1), env) as ChoiceTask;
    expect(recognize.exampleHint).toEqual({ text: frame.example!.es, lang: "es" });
    expect(recognize.speak).toBe(frame.example!.es);
    const recall = makeItemTask(frame, "recall", createRng(1), env) as ChoiceTask;
    expect(recall.exampleHint).toEqual({ text: frame.example!.de, lang: "de" });
    expect(recall.example).toEqual(frame.example);
  });

  it("die Schreibaufgabe wird trotzdem fertig gebaut und geprüft", () => {
    const task = makeItemTask(word, "write", createRng(1), env) as WriteTask;
    expect(task).toMatchObject({ kind: "write", prompt: word.de, solution: word.es });
    expect(evaluateWrite(task, word.es).correct).toBe(true);
    expect(evaluateWrite(task, "qqq").correct).toBe(false);
  });
});

describe("Rückmeldung", () => {
  it("Auswahl nennt Lösung, gewählte Antwort und Hinweis der Karte", () => {
    const item = allItems.find((entry) => entry.note_de)!;
    const task = makeItemTask(item, "recognize", createRng(1), env) as ChoiceTask;
    const wrongIndex = task.correctIndex === 0 ? 1 : 0;
    const wrong = evaluateChoice(task, wrongIndex);
    expect(wrong).toMatchObject({ correct: false, solution: item.de, chosen: task.options[wrongIndex], note: item.note_de });
    expect(evaluateChoice(task, task.correctIndex).correct).toBe(true);
  });

  it("Schreiben mit fehlendem Akzent: richtig mit Hinweis", () => {
    const task: WriteTask = { kind: "write", id: "w", type: "write", itemId: "x", prompt: "ist", promptLang: "de", speak: "está", solution: "está" };
    expect(evaluateWrite(task, "esta")).toMatchObject({ correct: true, verdict: "accent", accentHint: "está" });
    expect(evaluateWrite(task, "está")).toMatchObject({ verdict: "correct", accentHint: null });
  });

  it("Schreiben: „manana“ für „mañana“ ist falsch, die Lösung und die getippte Antwort stehen in der Rückmeldung", () => {
    const task: WriteTask = { kind: "write", id: "w", type: "write", itemId: "x", prompt: "morgen", promptLang: "de", speak: "mañana", solution: "mañana" };
    expect(evaluateWrite(task, "manana")).toMatchObject({ correct: false, verdict: "wrong", solution: "mañana", chosen: "manana", accentHint: null });
    expect(evaluateWrite(task, "Mañana.")).toMatchObject({ correct: true, verdict: "correct" });
  });
});

describe("Blöcke, Satzbau, Abschlussrunde", () => {
  it("neue Karten kommen in Blöcken zu vier mit Paare-Aufgabe über dieselben Karten", () => {
    for (const unit of units) {
      const blocks = buildNewCardBlocks(unit.id, createRng(1));
      expect(blocks.flatMap((block) => block.items.map((item) => item.id))).toEqual(unit.items.map((item) => item.id));
      for (const block of blocks.slice(0, -1)) expect(block.items).toHaveLength(4);
      for (const block of blocks) {
        const ids = block.items.map((item) => item.id).sort();
        expect([...block.pairs.esOrder].sort()).toEqual(ids);
        expect([...block.pairs.deOrder].sort()).toEqual(ids);
      }
    }
  });

  it("Satzbau: gleiche Bausteine, nicht schon in der Lösungsreihenfolge, Lösung prüfbar", () => {
    for (const unit of units) {
      const tasks = buildBuildTasks(unit.id, createRng(2));
      tasks.forEach((task, i) => {
        const source = unit.build[i]!;
        expect([...task.tokens].sort()).toEqual([...source.tokens].sort());
        expect(task.tokens).not.toEqual(source.tokens);
        expect(evaluateBuild(task, source.tokens).correct).toBe(true);
        expect(evaluateBuild(task, task.tokens).correct).toBe(false);
      });
    }
  });

  it("Abschlussrunde: jede neue Karte einmal, dazu die Satzbau-Aufgaben", () => {
    for (const unit of units) {
      const tasks = buildFinalRoundTasks(unit.id, createRng(4), env);
      const cardTasks = tasks.filter((task) => task.kind !== "build");
      expect(cardTasks.map((task) => task.itemId).sort()).toEqual(unit.items.map((item) => item.id).sort());
      expect(cardTasks.every((task) => task.type === ("recognize" as TaskType))).toBe(true);
      expect(tasks.filter((task) => task.kind === "build")).toHaveLength(unit.build.length);
      expect(unit.build.length).toBe(3);
    }
  });
});
