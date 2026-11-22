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
  /** Ruhemodus des Standes: Dann zeigt die Rückfrage keine Punkte. */
  calm: boolean;
  /** Letzter Tag mit Lernen (siehe `lastActivityDay`) oder `null` bei einem Stand ohne jede Aktivität. */
  lastActiveOn: Day | null;
  /** Tag des Exports oder `null`, wenn die Datei kein lesbares Datum trägt. */
  exportedOn: Day | null;
}

/**
 * Letzter Tag, an dem im Stand etwas geschah: der späteste aus `lastActiveDay`, `lastSeen` der Karten, Beginn und Abschluss
 * der Haltestellen, Datum der Missionen und Tagen mit Lernzeit. Das Datum ist das des Standes, nicht das der Datei.
 */
export function lastActivityDay(progress: Progress): Day | null {
  const days: (Day | null)[] = [
    progress.stats.lastActiveDay,
    ...Object.keys(progress.stats.activeMsByDay),
    ...Object.values(progress.cards).map((card) => card.lastSeen),
    ...Object.values(progress.units).flatMap((unit) => [dayOfIso(unit.startedAt), unit.completedAt ? dayOfIso(unit.completedAt) : null]),
    ...Object.values(progress.missions).map((mission) => dayOfIso(mission.at)),
  ];
  let latest: Day | null = null;
  for (const day of days) if (day !== null && (latest === null || day > latest)) latest = day;
  return latest;
}

export function summarizeProgress(progress: Progress, exportedAt: string | null): ImportSummary {
  return {
    name: progress.profile.name,
    cardCount: Object.keys(progress.cards).length,
    unitsDone: units.filter((unit) => isUnitDone(progress, unit.id)).length,
    unitsTotal: units.length,
    points: progress.stats.points,
    calm: progress.profile.calm,
    lastActiveOn: lastActivityDay(progress),
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

/** ISO-Zeitpunkt als `22.11.2026, 14:05 Uhr` in der Ortszeit des Geräts. Unlesbarer Text ergibt `unbekannt`. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unbekannt";
  const two = (n: number): string => String(n).padStart(2, "0");
  return `${formatDay(toDay(date))}, ${two(date.getHours())}:${two(date.getMinutes())} Uhr`;
}

function dayText(day: Day | null): string {
  return day === null ? "unbekannt" : formatDay(day);
}

/** Zeilen der Rückfrage vor dem Import (nur der importierte Stand). Im Ruhemodus ohne Punkte. */
export function summaryRows(summary: ImportSummary): { label: string; value: string }[] {
  const rows = [
    { label: "Name", value: summary.name },
    { label: "Karten", value: String(summary.cardCount) },
    { label: "Abgeschlossene Haltestellen", value: `${summary.unitsDone} von ${summary.unitsTotal}` },
    { label: "Zuletzt gelernt", value: summary.lastActiveOn === null ? "noch nie" : formatDay(summary.lastActiveOn) },
  ];
  if (!summary.calm) rows.push({ label: "Punkte", value: String(summary.points) });
  rows.push({ label: "Exportiert am", value: dayText(summary.exportedOn) });
  return rows;
}

export interface CompareRow {
  label: string;
  /** Aktueller Stand. */
  current: string;
  /** Importierter Stand. */
  imported: string;
}

export interface ImportComparison {
  rows: CompareRow[];
  /** Deutliche Warnungen, leer wenn der importierte Stand nicht schlechter aussieht. */
  warnings: string[];
}

/**
 * Stellt den aktuellen und den importierten Stand nebeneinander (Spezifikation 2.7). Punkte fehlen, wenn einer der beiden
 * Stände im Ruhemodus ist. Warnt, wenn der importierte Stand weniger Karten oder weniger abgeschlossene Haltestellen hat
 * oder früher zuletzt gelernt wurde.
 */
export function compareImport(current: ImportSummary, imported: ImportSummary): ImportComparison {
  const rows: CompareRow[] = [
    { label: "Name", current: current.name, imported: imported.name },
    { label: "Karten", current: String(current.cardCount), imported: String(imported.cardCount) },
    {
      label: "Abgeschlossene Haltestellen",
      current: `${current.unitsDone} von ${current.unitsTotal}`,
      imported: `${imported.unitsDone} von ${imported.unitsTotal}`,
    },
    {
      label: "Zuletzt gelernt",
      current: current.lastActiveOn === null ? "noch nie" : formatDay(current.lastActiveOn),
      imported: imported.lastActiveOn === null ? "noch nie" : formatDay(imported.lastActiveOn),
    },
  ];
  if (!current.calm && !imported.calm) {
    rows.push({ label: "Punkte", current: String(current.points), imported: String(imported.points) });
  }
  rows.push({ label: "Exportiert am", current: "–", imported: dayText(imported.exportedOn) });

  const warnings: string[] = [];
  if (imported.cardCount < current.cardCount) {
    warnings.push(`Die Sicherung hat weniger Karten als dein Stand: ${imported.cardCount} statt ${current.cardCount}. Dir gehen Karten verloren.`);
  }
  if (imported.unitsDone < current.unitsDone) {
    warnings.push(
      `Die Sicherung hat weniger abgeschlossene Haltestellen: ${imported.unitsDone} statt ${current.unitsDone}.`,
    );
  }
  if (current.lastActiveOn !== null && (imported.lastActiveOn === null || imported.lastActiveOn < current.lastActiveOn)) {
    const when = imported.lastActiveOn === null ? "gar nicht" : `am ${formatDay(imported.lastActiveOn)}`;
    warnings.push(
      `Die Sicherung ist älter als dein Stand: Zuletzt gelernt hast du darin ${when}, in deinem Stand am ${formatDay(current.lastActiveOn)}.`,
    );
  }
  return { rows, warnings };
}
