// Der Weg zwischen Maschine und Speicher. Die Ansicht (`SessionView.tsx`) und die Tests gehen genau durch diese beiden
// Funktionen: Jeder Fortschritt, den die Maschine liefert, wird hier gespeichert und nirgends sonst verworfen.
// Kein React, kein Browser: der Speicher kommt als Parameter.

import type { ProgressStore } from "../../core/store";
import type { Progress } from "../../core/types";
import { createSession, reduce } from "./machine";
import type { SessionContext, SessionEvent, SessionState, SpeakRequest } from "./machine";
import type { SessionRequest } from "./types";

export interface StartedSession {
  state: SessionState;
  /**
   * Speichert, was das Anlegen am Fortschritt geändert hat. Die Ansicht ruft es nach dem ersten Zeichnen auf (nicht
   * beim Rechnen des Zustands). Mehrfaches Aufrufen schadet nicht.
   */
  commit: () => void;
}

/** Legt die Sitzung an. `base` ist der Fortschritt, aus dem sie gebaut wird (der gerade gespeicherte). */
export function startSession(store: ProgressStore, base: Progress, request: SessionRequest, ctx: SessionContext): StartedSession {
  const created = createSession(base, request, ctx);
  return {
    state: created.state,
    commit: () => store.update((current) => (current === base && created.progress !== base ? created.progress : current)),
  };
}

export interface SentEvent {
  state: SessionState;
  /** Text für das Tippen, das dieses Ereignis ausgelöst hat. Die Ansicht spricht ihn dort. */
  speak: SpeakRequest | null;
}

/** Ein Ereignis durch die Maschine rechnen und den Fortschritt speichern. `null`, wenn der Speicher nicht bereit ist. */
export function sendEvent(store: ProgressStore, state: SessionState, event: SessionEvent, ctx: SessionContext): SentEvent | null {
  const snapshot = store.getSnapshot();
  if (snapshot.status !== "ready") return null;
  const result = reduce(state, event, snapshot.progress, ctx);
  store.update(() => result.progress);
  return { state: result.state, speak: result.speak };
}
