// Kleiner Speicher für den Fortschritt, ohne React und ohne direkten Zugriff auf localStorage.
// Passt zu `useSyncExternalStore(store.subscribe, store.getSnapshot)`: `getSnapshot` liefert zwischen zwei Änderungen
// dasselbe Objekt.
//
// Unlesbare oder fremde Daten überschreibt der Speicher nie. Er geht in den Zustand „error“ und wartet, bis die
// Oberfläche `restart()` aufruft. Auch dann bleibt der alte Text unter einem Sicherungsschlüssel erhalten.
// Von den Sicherungen behält der Speicher die drei neuesten (`BACKUPS_KEPT`), sofern der Speicher `keys` und `removeItem` kann.

import { STORAGE_KEY } from "./config";
import { createProgress, parseProgress, serializeProgress, validateProgress } from "./progress";
import type { LoadErrorReason } from "./progress";
import type { Clock } from "./time";
import type { Progress } from "./types";

/** Teilmenge von `Storage`: `localStorage` oder ein Test-Doppel passt. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** Optional. Ohne `removeItem` löscht der Speicher nie etwas (alte Sicherungen bleiben dann liegen). */
  removeItem?(key: string): void;
  /** Optional. Alle Schlüssel des Speichers. Ohne `keys` kennt der Speicher keine Sicherungen und bietet keine zum Zurückholen an. */
  keys?(): string[];
}

/** So viele automatische Sicherungen bleiben erhalten, ältere werden gelöscht, sobald eine neue geschrieben ist. */
export const BACKUPS_KEPT = 3;

/** Eine automatische Sicherung, die sich lesen lässt. `at` ist der ISO-Zeitpunkt, an dem sie angelegt wurde. */
export interface BackupInfo {
  key: string;
  at: string;
  progress: Progress;
}

export type StoreState =
  /** Nichts gespeichert: erster Start, Profil fehlt. */
  | { status: "empty" }
  /** `saveFailed`: das letzte Speichern ist gescheitert (Speicher voll oder gesperrt). Die Daten leben dann nur im Arbeitsspeicher. */
  | { status: "ready"; progress: Progress; saveFailed: boolean }
  /** Gespeicherte Daten sind unbrauchbar. Es wird nichts überschrieben. `raw` ist der gelesene Text. */
  | { status: "error"; reason: LoadErrorReason; raw: string | null };

/** Ergebnis von `replaceProgress`. Bei jedem Fehler bleibt der alte Stand unverändert. */
export type ReplaceResult =
  | { ok: true; backupKey: string | null }
  /** `invalid`: der neue Fortschritt besteht `validateProgress` nicht. `backup-failed`: die Sicherung des alten Standes ließ sich nicht schreiben. `save-failed`: das Schreiben des neuen Standes scheiterte. */
  | { ok: false; reason: "invalid" | "backup-failed" | "save-failed" };

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
   * Scheitert das Sichern, bleibt der Zustand „error“ und nichts wird überschrieben. Gibt zurück, ob der Neustart geklappt hat
   * (`false` auch, wenn der Zustand gar nicht „error“ ist).
   */
  restart(): boolean;
  /**
   * Ersetzt den Fortschritt (Import einer Sicherung). Prüft zuerst mit `validateProgress`, legt dann eine Sicherung
   * des aktuellen Standes unter `<Schlüssel>:backup-<Zeitpunkt>` an und schreibt erst danach den neuen Stand.
   * Scheitert eine der Stufen, bleiben Zustand und gespeicherter Text unverändert. Im Zustand „empty“ gibt es nichts
   * zu sichern (`backupKey: null`), im Zustand „error“ wird der unlesbare Text gesichert.
   */
  replaceProgress(next: Progress): ReplaceResult;
  /**
   * Die neueste automatische Sicherung, die sich als gültiger Fortschritt lesen lässt, oder `null`
   * (keine vorhanden, oder der Speicher kann seine Schlüssel nicht auflisten). Ändert nichts.
   * Zurückholen: `replaceProgress(info.progress)`; das sichert vorher den aktuellen Stand.
   */
  latestBackup(): BackupInfo | null;
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

  /** Sicherungsschlüssel `<Schlüssel>:backup-<ISO-Zeitpunkt>` mit optionalem Zähler `-2`, `-3` für denselben Zeitpunkt. */
  const backupPattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:backup-(\\d{4}-\\d{2}-\\d{2}T[\\d:.]+Z)(?:-(\\d+))?$`);

  /** Alle Sicherungen, neueste zuerst. Leer, wenn der Speicher keine Schlüssel auflisten kann. */
  function listBackups(): { key: string; at: string; n: number }[] {
    if (!storage.keys) return [];
    let all: string[];
    try {
      all = storage.keys();
    } catch {
      return [];
    }
    const found: { key: string; at: string; n: number }[] = [];
    for (const candidate of all) {
      const match = backupPattern.exec(candidate);
      if (match) found.push({ key: candidate, at: match[1] as string, n: match[2] === undefined ? 1 : Number(match[2]) });
    }
    found.sort((a, b) => (a.at === b.at ? b.n - a.n : a.at < b.at ? 1 : -1));
    return found;
  }

  /** Löscht alle Sicherungen außer den neuesten `BACKUPS_KEPT`, nie die Schlüssel in `protect`. Ohne `removeItem` passiert nichts. */
  function pruneBackups(protect: string): void {
    const remove = storage.removeItem;
    if (!remove) return;
    for (const old of listBackups().slice(BACKUPS_KEPT)) {
      if (old.key === protect) continue;
      try {
        remove.call(storage, old.key);
      } catch {
        // Eine Sicherung zu viel ist unschädlich.
      }
    }
  }

  /** Schreibt `text` unter einen freien Sicherungsschlüssel und liest ihn zurück, räumt danach auf. `null`, wenn das scheitert. */
  function writeBackup(text: string): string | null {
    const at = now().toISOString();
    const base = `${key}:backup-${at}`;
    // Nummer über der höchsten desselben Zeitpunkts, damit eine spätere Sicherung auch nach dem Aufräumen die höhere bleibt.
    const highest = Math.max(0, ...listBackups().filter((entry) => entry.at === at).map((entry) => entry.n));
    let backupKey = highest === 0 ? base : `${base}-${highest + 1}`;
    try {
      for (let n = highest + 2; storage.getItem(backupKey) !== null; n++) backupKey = `${base}-${n}`;
      storage.setItem(backupKey, text);
      if (storage.getItem(backupKey) !== text) return null;
    } catch {
      return null;
    }
    pruneBackups(backupKey);
    return backupKey;
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
      if (state.status !== "error") return false;
      // Ohne Sicherung des alten Textes bleibt der Fehlerzustand bestehen, damit nichts verloren geht.
      if (state.raw !== null && writeBackup(state.raw) === null) return false;
      emit({ status: "empty" });
      return true;
    },

    replaceProgress(next) {
      const valid = validateProgress(next);
      if (valid === null) return { ok: false, reason: "invalid" };
      let backupKey: string | null = null;
      const old = state.status === "ready" ? serializeProgress(state.progress) : state.status === "error" ? state.raw : null;
      if (old !== null) {
        backupKey = writeBackup(old);
        if (backupKey === null) return { ok: false, reason: "backup-failed" };
      }
      if (!save(valid)) return { ok: false, reason: "save-failed" };
      emit({ status: "ready", progress: valid, saveFailed: false });
      return { ok: true, backupKey };
    },

    latestBackup() {
      for (const entry of listBackups()) {
        let text: string | null;
        try {
          text = storage.getItem(entry.key);
        } catch {
          return null;
        }
        const parsed = parseProgress(text);
        if (parsed.status === "ok") return { key: entry.key, at: entry.at, progress: parsed.progress };
      }
      return null;
    },
  };
}
