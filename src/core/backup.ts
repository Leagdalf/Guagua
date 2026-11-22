// Fortschritt sichern: Exporttext bauen, Importtext prüfen, Zusammenfassung ableiten (docs/02-spezifikation.md, 2.7).
// Reine Funktionen ohne Browser, ohne echte Uhr. Das Ersetzen im Speicher macht `store.replaceProgress`.

import { SCHEMA_VERSION } from "./config";
import { units } from "./content";
import { validateProgress } from "./progress";
import { dayOfIso, toDay } from "./time";
import type { Clock } from "./time";
import type { Day, Progress } from "./types";
import { isUnitDone } from "./units";

/** Kennung im Exporttext: Daran erkennt die App eine eigene Sicherung. */
export const EXPORT_FORMAT = "guagua-sicherung";

/** Aufbau der Sicherungsdatei. `schema` ist das Schema des enthaltenen Fortschritts. */
export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  schema: number;
  /** ISO-Zeitpunkt des Exports. */
  exportedAt: string;
  progress: Progress;
}

/** Exporttext (JSON) mit Kennung, Schema und Datum. */
export function buildExport(progress: Progress, now: Clock): string {
  const file: ExportFile = { format: EXPORT_FORMAT, schema: SCHEMA_VERSION, exportedAt: now().toISOString(), progress };
  return JSON.stringify(file, null, 2);
}

/** Dateiname mit Datum, ohne den Namen der Lernenden. */
export function exportFileName(now: Clock): string {
  return `guagua-sicherung-${toDay(now())}.json`;
}

/** Was eine Sicherung enthält, für die Rückfrage vor dem Import. */
export interface ImportSummary {
  name: string;
  cardCount: number;
  unitsDone: number;
  unitsTotal: number;
  points: number;
  /** Tag des Exports oder `null`, wenn die Datei kein lesbares Datum trägt. */
  exportedOn: Day | null;
}

export function summarizeProgress(progress: Progress, exportedAt: string | null): ImportSummary {
  return {
    name: progress.profile.name,
    cardCount: Object.keys(progress.cards).length,
    unitsDone: units.filter((unit) => isUnitDone(progress, unit.id)).length,
    unitsTotal: units.length,
    points: progress.stats.points,
    exportedOn: exportedAt === null ? null : dayOfIso(exportedAt),
  };
}

export type ImportFailure = "empty" | "unreadable" | "foreign" | "schema" | "invalid";

export type ImportCheck =
  | { ok: true; progress: Progress; summary: ImportSummary }
  | { ok: false; reason: ImportFailure; message: string };

const MESSAGES: Record<ImportFailure, string> = {
  empty: "Da steht noch nichts. Wähle eine Datei oder füge den Text deiner Sicherung ein.",
  unreadable:
    "Das lässt sich nicht lesen. Der Text ist kein gültiges JSON, vielleicht wurde er beim Kopieren abgeschnitten. Es wurde nichts geändert.",
  foreign: "Das ist keine Sicherung aus Guagua. Es wurde nichts geändert.",
  schema: "Diese Sicherung stammt aus einer anderen Version der App und lässt sich hier nicht laden. Es wurde nichts geändert.",
  invalid: "Die Sicherung enthält keinen gültigen Lernstand. Es wurde nichts geändert.",
};

function fail(reason: ImportFailure): ImportCheck {
  return { ok: false, reason, message: MESSAGES[reason] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Prüft den Text einer Sicherung. Ändert nichts, sagt bei einem Fehler den Grund. */
export function checkImport(text: string): ImportCheck {
  if (text.trim().length === 0) return fail("empty");
  let value: unknown;
  try {
    // Ein Byte-Order-Mark am Anfang einer Datei stört JSON.parse.
    value = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return fail("unreadable");
  }
  if (!isRecord(value) || value.format !== EXPORT_FORMAT) return fail("foreign");
  if (value.schema !== SCHEMA_VERSION) return fail("schema");
  const progress = validateProgress(value.progress);
  if (progress === null) return fail("invalid");
  const exportedAt = typeof value.exportedAt === "string" ? value.exportedAt : null;
  return { ok: true, progress, summary: summarizeProgress(progress, exportedAt) };
}

/** `2026-11-22` als `22.11.2026`. */
export function formatDay(day: Day): string {
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

/** Zeilen der Rückfrage vor dem Import. */
export function summaryRows(summary: ImportSummary): { label: string; value: string }[] {
  return [
    { label: "Name", value: summary.name },
    { label: "Karten", value: String(summary.cardCount) },
    { label: "Abgeschlossene Haltestellen", value: `${summary.unitsDone} von ${summary.unitsTotal}` },
    { label: "Punkte", value: String(summary.points) },
    { label: "Exportiert am", value: summary.exportedOn === null ? "unbekannt" : formatDay(summary.exportedOn) },
  ];
}
