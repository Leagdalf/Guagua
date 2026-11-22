// Kleiner Speicher für den Fortschritt, ohne React und ohne direkten Zugriff auf localStorage.
// Passt zu `useSyncExternalStore(store.subscribe, store.getSnapshot)`: `getSnapshot` liefert zwischen zwei Änderungen
// dasselbe Objekt.
//
// Unlesbare oder fremde Daten überschreibt der Speicher nie. Er geht in den Zustand „error“ und wartet, bis die
// Oberfläche `restart()` aufruft. Auch dann bleibt der alte Text unter einem Sicherungsschlüssel erhalten.

import { STORAGE_KEY } from "./config";
import { createProgress, parseProgress, serializeProgress } from "./progress";
import type { LoadErrorReason } from "./progress";
import type { Clock } from "./time";
import type { Progress } from "./types";

/** Teilmenge von `Storage`: `localStorage` oder ein Test-Doppel passt. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type StoreState =
  /** Nichts gespeichert: erster Start, Profil fehlt. */
  | { status: "empty" }
  /** `saveFailed`: das letzte Speichern ist gescheitert (Speicher voll oder gesperrt). Die Daten leben dann nur im Arbeitsspeicher. */
  | { status: "ready"; progress: Progress; saveFailed: boolean }
  /** Gespeicherte Daten sind unbrauchbar. Es wird nichts überschrieben. `raw` ist der gelesene Text. */
  | { status: "error"; reason: LoadErrorReason; raw: string | null };

export interface ProgressStore {
  getSnapshot(): StoreState;
  subscribe(listener: () => void): () => void;
  /** Ändert den Fortschritt und speichert sofort. Wirkt nur im Zustand „ready“. Gibt `fn` dasselbe Objekt zurück, passiert nichts. */
  update(fn: (progress: Progress) => Progress): void;
  /** Legt im Zustand „empty“ das Profil an. Gibt `false` zurück bei ungültigem Namen oder anderem Zustand. */
  createProfile(name: string): boolean;
  /**
   * Ausdrücklicher Neustart nach einem Fehler: Der alte Text wird unter `<Schlüssel>:backup-<Zeitpunkt>` gesichert,
   * der Zustand wird „empty“. Erst `createProfile` schreibt wieder unter den eigentlichen Schlüssel.
   */
  restart(): void;
}

export interface ProgressStoreOptions {
  storage: StorageLike;
  now: Clock;
  /** Standard: `STORAGE_KEY`. */
  key?: string;
}

export function createProgressStore({ storage, now, key = STORAGE_KEY }: ProgressStoreOptions): ProgressStore {
  const listeners = new Set<() => void>();

  function load(): StoreState {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return { status: "error", reason: "unreadable", raw: null };
    }
    const result = parseProgress(raw);
    if (result.status === "ok") return { status: "ready", progress: result.progress, saveFailed: false };
    return result;
  }

  let state: StoreState = load();

  function emit(next: StoreState): void {
    state = next;
    for (const listener of [...listeners]) listener();
  }

  function save(progress: Progress): boolean {
    try {
      storage.setItem(key, serializeProgress(progress));
      return true;
    } catch {
      return false;
    }
  }

  return {
    getSnapshot: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    update(fn) {
      if (state.status !== "ready") return;
      const next = fn(state.progress);
      if (next === state.progress) return;
      emit({ status: "ready", progress: next, saveFailed: !save(next) });
    },

    createProfile(name) {
      if (state.status !== "empty") return false;
      const progress = createProgress(name, now);
      if (!progress) return false;
      emit({ status: "ready", progress, saveFailed: !save(progress) });
      return true;
    },

    restart() {
      if (state.status !== "error") return;
      if (state.raw !== null) {
        try {
          storage.setItem(`${key}:backup-${now().toISOString()}`, state.raw);
        } catch {
          // Sicherung ist best effort. Der alte Text bleibt unter dem Hauptschlüssel, bis das neue Profil ihn ersetzt.
        }
      }
      emit({ status: "empty" });
    },
  };
}
