// Hilfen für die Tests der Lerneinheit: eine Sitzung treiben wie eine Lernende. Nicht Teil der App.

import { createRng } from "../../core/random";
import type { Rng } from "../../core/random";
import { isRepeat } from "../../core/round";
import { parseProgress, serializeProgress } from "../../core/progress";
import { freshProgress, makeClock } from "../../core/testkit";
import type { Progress } from "../../core/types";
import { createSession, reduce } from "./machine";
import type { SessionContext, SessionEvent, SessionState, SpeakRequest, TaskScreen } from "./machine";
import type { SessionRequest } from "./types";

export const U01 = "u01";

export type Clock = ReturnType<typeof makeClock>;

export class Run {
  progress: Progress;
  state: SessionState;
  /** Jede Ausgabe des Tons mit dem Zustand, den dasselbe Tippen gezeigt hat. */
  spoken: { text: string; after: SessionState }[] = [];
  /** Aufgabentypen, die ein Durchlauf gezeigt hat. */
  types = new Set<string>();
  /** Zusätzliche Zeit in Millisekunden auf der Uhr des Tages. */
  extraMs = 0;
  rng: Rng;

  constructor(
    progress: Progress,
    request: SessionRequest,
    public clock: Clock,
    public hasSpanishVoice = true,
    seed = 1,
  ) {
    this.rng = createRng(seed);
    const created = createSession(progress, request, this.ctx());
    if (created.speak !== null) throw new Error("Die Sitzung darf beim Start nicht sprechen");
    this.progress = created.progress;
    this.state = created.state;
    this.note();
  }

  ctx(): SessionContext {
    return {
      now: () => new Date(this.clock.now().getTime() + this.extraMs),
      rng: this.rng,
      hasSpanishVoice: this.hasSpanishVoice,
    };
  }

  private note(): void {
    if (this.state.screen.kind === "task") this.types.add(this.state.screen.task.type);
  }

  send(event: SessionEvent): SpeakRequest | null {
    const result = reduce(this.state, event, this.progress, this.ctx());
    this.state = result.state;
    this.progress = result.progress;
    if (result.speak) this.spoken.push({ text: result.speak.text, after: result.state });
    this.note();
    return result.speak;
  }

  get task(): TaskScreen {
    if (this.state.screen.kind !== "task") throw new Error(`Keine Aufgabe, sondern ${this.state.screen.kind}`);
    return this.state.screen;
  }

  /** Neuladen: Fortschritt serialisieren, lesen und die Sitzung neu aufbauen. */
  reload(request: SessionRequest, seed = 99): void {
    const parsed = parseProgress(serializeProgress(this.progress));
    if (parsed.status !== "ok") throw new Error("Fortschritt nicht lesbar");
    this.rng = createRng(seed);
    const created = createSession(parsed.progress, request, this.ctx());
    this.progress = created.progress;
    this.state = created.state;
    this.note();
  }
}

export interface Bot {
  /** Hält an, sobald das wahr wird (vor der nächsten Handlung). */
  stopWhen?: (run: Run) => boolean;
  /** Erste Antworten in der Wiederholrunde, die falsch sein sollen (Anzahl). */
  wrongInReview?: number;
}

/** Spielt die Sitzung durch wie eine Lernende, die alles richtig macht (außer den verlangten Fehlern). `true`: Zusammenfassung erreicht. */
export function play(run: Run, bot: Bot = {}): boolean {
  let wrongLeft = bot.wrongInReview ?? 0;
  for (let guard = 0; guard < 3000; guard++) {
    if (bot.stopWhen?.(run)) return false;
    const screen = run.state.screen;
    switch (screen.kind) {
      case "summary":
        return true;
      case "grammar":
      case "mission":
      case "dialogue":
        run.send({ type: "next" });
        break;
      case "cards": {
        if (screen.stage === "look") {
          run.send({ type: "next" });
          break;
        }
        const items = screen.blocks[screen.block]?.items ?? [];
        for (const item of items) {
          run.send({ type: "pair", side: "left", id: item.id });
          run.send({ type: "pair", side: "right", id: item.id });
        }
        run.send({ type: "next" });
        break;
      }
      case "task": {
        if (screen.answer !== null) {
          run.send({ type: "next" });
          break;
        }
        const task = screen.task;
        if (task.kind === "choice") {
          let index = task.correctIndex;
          if (screen.role === "review" && wrongLeft > 0 && screen.round && !isRepeat(screen.round)) {
            wrongLeft--;
            index = (task.correctIndex + 1) % task.options.length;
          }
          run.send({ type: "choose", index });
        } else if (task.kind === "build") {
          const used = new Set<number>();
          for (const token of task.answer) {
            const index = task.tokens.findIndex((t, i) => t === token && !used.has(i));
            used.add(index);
            run.send({ type: "place", index });
          }
          run.send({ type: "check" });
        } else {
          run.send({ type: "submitText", text: task.solution });
        }
        break;
      }
    }
  }
  throw new Error("Die Sitzung endet nicht");
}

export function newDay1(): { clock: Clock; progress: Progress } {
  const clock = makeClock("2026-11-23");
  return { clock, progress: freshProgress(clock) };
}

/** Haltestelle 1 an Tag 1 ganz durchgespielt. */
export function playUnit1(): { clock: Clock; run: Run } {
  const { clock, progress } = newDay1();
  const run = new Run(progress, { kind: "day", unitId: U01 }, clock);
  if (!play(run)) throw new Error("Haltestelle 1 endet nicht");
  return { clock, run };
}
