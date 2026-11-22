// Angaben für „Über die App“. Reine Daten und Funktionen, kein React.

import pkg from "../../../package.json";
import { course } from "../../core/content";
import { currentStreak } from "../../core/stats";
import { formatDay } from "../../core/backup";
import type { Day, Progress } from "../../core/types";

/** Version aus package.json. */
export const APP_VERSION: string = pkg.version;

/** Stand der Lerninhalte: Datum des Builds (`__BUILD_DATE__` aus vite.config.ts), als `23.11.2026`. */
export const CONTENT_DATE: string = typeof __BUILD_DATE__ === "string" ? formatDay(__BUILD_DATE__) : "unbekannt";

/** Satz aus docs/02-spezifikation.md, 2.7, wörtlich. */
export const AI_NOTE = "Code und Lerninhalte sind mit KI-Unterstützung entstanden. Fehler gefunden? Bitte melden, dann wird die Karte korrigiert.";

export const FONT_LICENSES: ReadonlyArray<{ name: string; license: string }> = [
  { name: "Newsreader", license: "SIL Open Font License 1.1" },
  { name: "Figtree", license: "SIL Open Font License 1.1" },
];

/** Erklärung unter dem Schalter in den Einstellungen (docs/02-spezifikation.md, 5.3). */
export const CALM_EXPLANATION =
  "Im Ruhemodus entfallen alle Animationen, und die App zeigt weder Punkte noch Serie. Sie rechnet beide im Hintergrund weiter.";

export function serieText(days: number): string {
  return days === 1 ? "1 Tag" : `${days} Tage`;
}

export interface AboutRow {
  label: string;
  value: string;
}

/** Zeilen der Liste unter „Über die App“. Im Ruhemodus fehlen Punkte und Serie. */
export function aboutRows(progress: Progress, day: Day): AboutRow[] {
  const rows: AboutRow[] = [
    { label: "Version", value: APP_VERSION },
    { label: "Stand der Inhalte", value: CONTENT_DATE },
  ];
  if (!progress.profile.calm) {
    rows.push(
      { label: "Punkte", value: String(progress.stats.points) },
      { label: "Serie", value: serieText(currentStreak(progress, day)) },
    );
  }
  return rows;
}

// ---------- Lernzeit je Tag (docs/02-spezifikation.md, 5.4) ----------

export interface LearningDay {
  day: Day;
  ms: number;
}

export interface LearningTime {
  /** Tage mit gemessener Zeit, der neueste zuerst. Tage ohne Lernzeit zählen nicht mit. */
  days: LearningDay[];
  totalMs: number;
  /** Median der Tageswerte in Millisekunden, `null` ohne Tage. */
  medianMs: number | null;
}

/** Median: bei gerader Anzahl der Mittelwert der beiden mittleren Werte. `null` bei leerer Liste. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] as number;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] as number) + upper) / 2;
}

export function learningTime(progress: Progress): LearningTime {
  const days = Object.entries(progress.stats.activeMsByDay)
    .filter(([, ms]) => ms > 0)
    .map(([day, ms]) => ({ day, ms }))
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  return {
    days,
    totalMs: days.reduce((sum, entry) => sum + entry.ms, 0),
    medianMs: median(days.map((entry) => entry.ms)),
  };
}

/** Minuten für die Anzeige: ganze Minuten, unter einer halben Minute „unter 1 min“. */
export function formatMinutes(ms: number): string {
  if (ms > 0 && ms < 30_000) return "unter 1 min";
  return `${Math.round(ms / 60_000)} min`;
}

/** Zielwert aus content/course.json, zum Beispiel „Zielwert: Median zwischen 15 und 20 Minuten pro Tag.“ Er wird genannt, nicht bewertet. */
export function targetText(): string {
  const [low, high] = course.minutes_per_day;
  return `Zielwert: Median zwischen ${low} und ${high} Minuten pro Tag.`;
}

export function learningRows(time: LearningTime): { label: string; value: string }[] {
  return time.days.map((entry) => ({ label: formatDay(entry.day), value: formatMinutes(entry.ms) }));
}
