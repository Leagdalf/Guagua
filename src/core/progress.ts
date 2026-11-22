// Fortschritt: anlegen, prüfen, aus Text lesen, in Text schreiben (docs/02-spezifikation.md, 4.2).
// Kein Zugriff auf localStorage. Das Speichern übernimmt store.ts über eine hineingereichte Schnittstelle.

import { NAME_MAX_LENGTH, SCHEMA_VERSION } from "./config";
import { isDay } from "./time";
import type { Clock } from "./time";
import type { Progress, SpeechRate } from "./types";

/** Name bereinigt (Ränder weg) oder `null`, wenn leer oder zu lang. */
export function normalizeName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0 || Array.from(trimmed).length > NAME_MAX_LENGTH) return null;
  return trimmed;
}

/** Leerer Fortschritt für ein neues Profil. Gibt `null` zurück, wenn der Name ungültig ist. */
export function createProgress(name: string, now: Clock): Progress | null {
  const clean = normalizeName(name);
  if (clean === null) return null;
  return {
    schema: SCHEMA_VERSION,
    profile: { name: clean, createdAt: now().toISOString(), voiceURI: null, rate: "normal", calm: false },
    cards: {},
    units: {},
    missions: {},
    stats: { points: 0, streak: 0, lastActiveDay: null, activeMsByDay: {} },
    favorites: [],
  };
}

export interface ProfilePatch {
  name?: string;
  voiceURI?: string | null;
  rate?: SpeechRate;
  calm?: boolean;
}

/** Einstellungen ändern. Ein ungültiger Name wird ignoriert. */
export function updateProfile(progress: Progress, patch: ProfilePatch): Progress {
  const profile = { ...progress.profile };
  if (patch.name !== undefined) {
    const clean = normalizeName(patch.name);
    if (clean !== null) profile.name = clean;
  }
  if (patch.voiceURI !== undefined) profile.voiceURI = patch.voiceURI;
  if (patch.rate !== undefined) profile.rate = patch.rate;
  if (patch.calm !== undefined) profile.calm = patch.calm;
  return { ...progress, profile };
}

/** Satz im Sprachführer merken oder wieder entfernen. */
export function toggleFavorite(progress: Progress, id: string): Progress {
  const favorites = progress.favorites.includes(id)
    ? progress.favorites.filter((entry) => entry !== id)
    : [...progress.favorites, id];
  return { ...progress, favorites };
}

// ---------- Prüfen und Laden ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

function inRange(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function validCard(value: unknown): boolean {
  return (
    isRecord(value) &&
    inRange(value.box, 1, 5) &&
    isDay(value.due) &&
    isNonNegativeNumber(value.right) &&
    isNonNegativeNumber(value.wrong) &&
    isDay(value.lastSeen)
  );
}

function validUnit(value: unknown): boolean {
  return (
    isRecord(value) &&
    inRange(value.step, 1, 6) &&
    typeof value.startedAt === "string" &&
    (value.completedAt === undefined || typeof value.completedAt === "string") &&
    (value.answered === undefined || (Array.isArray(value.answered) && value.answered.every((id) => typeof id === "string")))
  );
}

function validMission(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.state === "done" || value.state === "skipped") &&
    typeof value.at === "string" &&
    (value.feeling === undefined || value.feeling === "leicht" || value.feeling === "mittel" || value.feeling === "schwer") &&
    (value.note === undefined || typeof value.note === "string")
  );
}

function allValues(value: unknown, test: (entry: unknown) => boolean): boolean {
  return isRecord(value) && Object.values(value).every(test);
}

/** Prüft die Form eines Fortschritts (Schema 1). Gibt das Objekt zurück oder `null`. */
export function validateProgress(value: unknown): Progress | null {
  if (!isRecord(value) || value.schema !== SCHEMA_VERSION) return null;
  const { profile, stats } = value;
  if (
    !isRecord(profile) ||
    typeof profile.name !== "string" ||
    normalizeName(profile.name) === null ||
    typeof profile.createdAt !== "string" ||
    !(profile.voiceURI === null || typeof profile.voiceURI === "string") ||
    !(profile.rate === "normal" || profile.rate === "slow") ||
    typeof profile.calm !== "boolean"
  ) {
    return null;
  }
  if (
    !isRecord(stats) ||
    !isNonNegativeNumber(stats.points) ||
    !isNonNegativeNumber(stats.streak) ||
    !(stats.lastActiveDay === null || isDay(stats.lastActiveDay)) ||
    !(stats.lastReviewDay === undefined || isDay(stats.lastReviewDay)) ||
    !allValues(stats.activeMsByDay, isNonNegativeNumber)
  ) {
    return null;
  }
  if (!allValues(value.cards, validCard) || !allValues(value.units, validUnit) || !allValues(value.missions, validMission)) {
    return null;
  }
  if (!Array.isArray(value.favorites) || !value.favorites.every((entry) => typeof entry === "string")) return null;
  const review = value.finalReview;
  if (
    review !== undefined &&
    !(
      isRecord(review) &&
      typeof review.at === "string" &&
      isNonNegativeNumber(review.right) &&
      isNonNegativeNumber(review.total) &&
      review.right <= review.total
    )
  ) {
    return null;
  }
  const run = value.finalRun;
  if (
    run !== undefined &&
    !(
      isRecord(run) &&
      Array.isArray(run.ids) &&
      run.ids.every((id) => typeof id === "string") &&
      Array.isArray(run.answered) &&
      run.answered.every((id) => typeof id === "string") &&
      inRange(run.right, 0, run.answered.length)
    )
  ) {
    return null;
  }
  return value as unknown as Progress;
}

export type LoadErrorReason = "unreadable" | "foreign-schema" | "invalid";

/**
 * Ergebnis des Ladens.
 * empty: nichts gespeichert (erster Start).
 * error: unlesbar (kein JSON oder Speicher nicht lesbar), fremdes Schema (anderes oder fehlendes `schema`) oder
 * ungültige Form. `raw` ist der gelesene Text, damit nichts verloren geht.
 */
export type LoadResult =
  | { status: "empty" }
  | { status: "ok"; progress: Progress }
  | { status: "error"; reason: LoadErrorReason; raw: string | null };

export function parseProgress(raw: string | null): LoadResult {
  if (raw === null) return { status: "empty" };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: "error", reason: "unreadable", raw };
  }
  if (!isRecord(value) || value.schema !== SCHEMA_VERSION) return { status: "error", reason: "foreign-schema", raw };
  const progress = validateProgress(value);
  return progress ? { status: "ok", progress } : { status: "error", reason: "invalid", raw };
}

export function serializeProgress(progress: Progress): string {
  return JSON.stringify(progress);
}
