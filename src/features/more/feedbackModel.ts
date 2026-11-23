// Rückmeldung (docs/02-spezifikation.md, 2.9 Punkt 12): kurze Notizen im Lernstand (`progress.notes`) und der Text zum Teilen.
// Reine Funktionen, kein React, keine echte Uhr.

import { formatDay } from "../../core/backup";
import { units } from "../../core/content";
import type { Clock } from "../../core/time";
import { dayOfIso } from "../../core/time";
import type { Progress } from "../../core/types";

/** Längste Notiz in Zeichen. */
export const NOTE_MAX_LENGTH = 500;

export const NOTES_EMPTY_TEXT = "Noch keine Notizen. Schreib auf, was dir fehlt oder was falsch ist.";
export const NOTES_INTRO =
  "Schreib kurze Notizen zum Weitergeben auf, zum Beispiel „Hat mir gefehlt“ oder „Fehler gefunden“ mit der Karte dazu. Sie bleiben auf diesem Gerät, bis du sie teilst.";
export const SHARE_NOTHING_TEXT = "Es gibt noch nichts zu teilen.";
export const SHARE_COPIED = "Kopiert. Füge den Text in eine Nachricht an die Person ein, die die App für dich betreut.";
export const SHARE_COPY_MANUAL = "Kopieren geht hier nicht. Markiere den Text unten und kopiere ihn von Hand.";
export const SHARE_SENT = "Das Teilen-Menü hat den Text übernommen.";
export const SHARE_CANCELLED = "Teilen abgebrochen.";
export const SHARE_FAILED_TEXT = "Teilen hat nicht geklappt. Kopiere den Text stattdessen.";

export interface NoteEntry {
  /** Stelle in `progress.notes`, für das Löschen. */
  index: number;
  at: string;
  text: string;
}

/** Notizen, die neueste zuerst. */
export function noteEntries(progress: Progress): NoteEntry[] {
  const notes = progress.notes ?? [];
  return notes
    .map((note, index) => ({ index, at: note.at, text: note.text }))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.index - a.index));
}

/** Datum einer Notiz für die Liste, `22.11.2026`. */
export function noteDate(at: string): string {
  const day = dayOfIso(at);
  return day === null ? "ohne Datum" : formatDay(day);
}

/** Notiz von Leerraum am Rand befreien und kürzen. `null`, wenn nichts übrig bleibt. */
export function cleanNote(text: string): string | null {
  const clean = text.trim().replace(/\s*\n\s*/g, "\n").slice(0, NOTE_MAX_LENGTH).trim();
  return clean.length === 0 ? null : clean;
}

/** Hängt eine Notiz an. Leere Notiz: dasselbe Objekt. */
export function addNote(progress: Progress, text: string, now: Clock): Progress {
  const clean = cleanNote(text);
  if (clean === null) return progress;
  return { ...progress, notes: [...(progress.notes ?? []), { at: now().toISOString(), text: clean }] };
}

/** Löscht die Notiz an der Stelle `index` aus `progress.notes`. Unbekannte Stelle: dasselbe Objekt. */
export function removeNote(progress: Progress, index: number): Progress {
  const notes = progress.notes;
  if (!notes || index < 0 || index >= notes.length) return progress;
  return { ...progress, notes: notes.filter((_, i) => i !== index) };
}

const FEELING_TEXT = { leicht: "leicht", mittel: "ging so", schwer: "schwer" } as const;

/** Notizen der Missionen, älteste zuerst, mit Titel der Mission. Missionen ohne Notiz fehlen. */
export function missionNotes(progress: Progress): { title: string; feeling: string | null; text: string }[] {
  return Object.entries(progress.missions)
    .filter(([, mission]) => typeof mission.note === "string" && mission.note.trim().length > 0)
    .sort(([, a], [, b]) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
    .map(([id, mission]) => {
      const unit = units.find((candidate) => candidate.mission.id === id);
      return {
        title: unit ? `Haltestelle ${unit.stop}, ${unit.mission.title_de}` : "Mission",
        feeling: mission.feeling ? FEELING_TEXT[mission.feeling] : null,
        text: (mission.note ?? "").trim(),
      };
    });
}

/** Ob es Notizen oder Missionsnotizen zum Teilen gibt. */
export function hasShareable(progress: Progress): boolean {
  return (progress.notes ?? []).length > 0 || missionNotes(progress).length > 0;
}

/**
 * Text zum Teilen: erst die Notizen mit Datum, dann die Notizen der Missionen. Er enthält nie den Namen der Lernenden
 * (außer sie tippt ihn selbst in eine Notiz). Leer, wenn es nichts gibt.
 */
export function shareText(progress: Progress): string {
  if (!hasShareable(progress)) return "";
  const lines: string[] = ["Rückmeldung zu Guagua"];
  const notes = noteEntries(progress).reverse();
  if (notes.length > 0) {
    lines.push("", "Notizen");
    for (const note of notes) lines.push(`${noteDate(note.at)}: ${note.text}`);
  }
  const missions = missionNotes(progress);
  if (missions.length > 0) {
    lines.push("", "Notizen zu den Missionen");
    for (const mission of missions) lines.push(`${mission.title}${mission.feeling ? ` (${mission.feeling})` : ""}: ${mission.text}`);
  }
  return lines.join("\n");
}
