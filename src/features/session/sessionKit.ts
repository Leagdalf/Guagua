// Hilfen für die Tests der Lerneinheit: eine Sitzung treiben wie eine Lernende. Nicht Teil der App.

import { createRng } from "../../core/random";
import type { Rng } from "../../core/random";
import { isRepeat } from "../../core/round";
import { STORAGE_KEY } from "../../core/config";
import { serializeProgress } from "../../core/progress";
import { createProgressStore } from "../../core/store";
import type { ProgressStore, StorageLike } from "../../core/store";
import { freshProgress, makeClock } from "../../core/testkit";
import type { Progress } from "../../core/types";
import type { SessionContext, SessionEvent, SessionState, SpeakRequest, TaskScreen } from "./machine";
import { sendEvent, startSession } from "./sessionDriver";
import type { SessionRequest } from "./types";

export const U01 = "u01";

export type Clock = ReturnType<typeof makeClock>;

/** Speicher im Arbeitsspeicher wie `localStorage`. `failing`: `setItem` wirft (Speicher voll oder gesperrt). */
export class MemoryStorage implements StorageLike {
  items = new Map<string, string>();
  failing = false;

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failing) throw new Error("Speicher voll");
    this.items.set(key, value);
  }
}

/**
 * Eine Sitzung treiben wie die App: durch `startSession` und `sendEvent` aus `sessionDriver.ts` mit einem echten
 * `ProgressStore` über einem Speicher im Arbeitsspeicher. `progress` ist immer das, was gespeichert ist. Neuladen baut
 * einen neuen Speicher über denselben Text.
 */
export class Run {
  storage = new MemoryStorage();
  store: ProgressStore;
  state: SessionState;
  /** Jede Ausgabe des Tons mit dem Zustand, den dasselbe Tippen gezeigt hat. */
  spoken: { text: string; after: SessionState }[] = [];
  /** Aufgabentypen, die ein Durchlauf gezeigt hat. */
  types = new Set<string>();
  /** Zusätzliche Zeit in Millisekunden auf der Uhr des Tages. */
  extraMs = 0;
  rng: Rng;

  /** `begin`: gleich auf den Hauptknopf des Fahrplans tippen. `false` lässt die Sitzung auf dem Fahrplan stehen. */
  constructor(
    progress: Progress,
    request: SessionRequest,
    public clock: Clock,
    public hasSpanishVoice = true,
    seed = 1,
    begin = true,
  ) {
    this.rng = createRng(seed);
    this.storage.setItem(STORAGE_KEY, serializeProgress(progress));
    this.store = this.openStore();
    this.state = this.open(request, begin);
  }

  private openStore(): ProgressStore {
    return createProgressStore({ storage: this.storage, now: () => this.ctx().now() });
  }

  private open(request: SessionRequest, begin: boolean): SessionState {
    const started = startSession(this.store, this.progress, request, this.ctx());
    started.commit();
    this.state = started.state;
    this.note();
    if (begin) this.send({ type: "begin" });
    return this.state;
  }

  ctx(): SessionContext {
    return {
      now: () => new Date(this.clock.now().getTime() + this.extraMs),
      rng: this.rng,
      hasSpanishVoice: this.hasSpanishVoice,
    };
  }

  /** Der gespeicherte Fortschritt. */
  get progress(): Progress {
    const snapshot = this.store.getSnapshot();
    if (snapshot.status !== "ready") throw new Error("Speicher nicht bereit");
    return snapshot.progress;
  }

  private note(): void {
    if (this.state.screen.kind === "task") this.types.add(this.state.screen.task.type);
  }

  send(event: SessionEvent): SpeakRequest | null {
    const sent = sendEvent(this.store, this.state, event, this.ctx());
    if (!sent) throw new Error("Speicher nicht bereit");
    this.state = sent.state;
    if (sent.speak) this.spoken.push({ text: sent.speak.text, after: sent.state });
    this.note();
    return sent.speak;
  }

  get task(): TaskScreen {
    if (this.state.screen.kind !== "task") throw new Error(`Keine Aufgabe, sondern ${this.state.screen.kind}`);
    return this.state.screen;
  }

  /** Neuladen: neuer Speicher über dem gespeicherten Text, Sitzung neu aufgebaut (mit dem Tippen auf den Fahrplan, wenn `begin`). */
  reload(request: SessionRequest, seed = 99, begin = true): void {
    this.rng = createRng(seed);
    this.store = this.openStore();
    this.spoken = [];
    this.open(request, begin);
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
      case "plan":
        run.send({ type: "begin" });
        break;
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
