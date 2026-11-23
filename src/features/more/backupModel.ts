// Texte und kleine Funktionen für „Fortschritt sichern“. Reine Daten und Funktionen, kein React.

import type { ImportSummary } from "../../core/backup";
import type { ReplaceResult } from "../../core/store";

/** Hinweis aus docs/06-deployment-und-ipad.md, Abschnitt 6. */
export const BACKUP_HINT =
  "Dein Lernstand liegt im Speicher der installierten Web-App. Wenn du das Symbol vom Home-Bildschirm löschst, löschst du den Lernstand mit. Sichere ihn deshalb einmal in der Woche und vor dem Heimflug.";

export const COPY_DONE = "Kopiert. Füge den Text an einem sicheren Ort ein, zum Beispiel in einer Notiz oder in einer Nachricht an dich selbst.";
export const COPY_MANUAL = "Kopieren geht hier nicht. Markiere den Text unten und kopiere ihn von Hand.";
export const SHARE_DONE = "Das Teilen-Menü hat die Datei übernommen. Prüfe, ob sie dort angekommen ist, wo du sie haben wolltest.";
export const SHARE_ABORTED = "Teilen abgebrochen. Es wurde nichts gesichert.";
export const SHARE_FAILED = "Teilen hat nicht geklappt. Speichere die Datei oder kopiere den Text.";
export const FILE_UNREADABLE = "Die Datei lässt sich nicht lesen. Es wurde nichts geändert.";
export const FILE_TOO_BIG = "Die Datei ist zu groß für eine Sicherung. Es wurde nichts geändert.";

/** Größte Datei, die als Sicherung gelesen wird. Ein Lernstand ist deutlich kleiner. */
export const MAX_IMPORT_BYTES = 5_000_000;

export function savedText(fileName: string): string {
  return `Die Datei ${fileName} wurde an den Browser übergeben. Schau im Ordner Downloads oder in der Dateien-App nach.`;
}

type ReplaceFailure = Extract<ReplaceResult, { ok: false }>["reason"];

/** Meldung, wenn der Speicher den Import ablehnt. Immer mit dem Satz, dass nichts geändert wurde. */
export function replaceFailureMessage(reason: ReplaceFailure): string {
  switch (reason) {
    case "backup-failed":
      return "Die Sicherung deines aktuellen Standes ist gescheitert, vermutlich ist der Speicher voll. Deshalb wurde nichts importiert. Dein Stand ist unverändert.";
    case "save-failed":
      return "Der importierte Stand ließ sich nicht speichern. Dein bisheriger Stand ist unverändert.";
    case "invalid":
      return "Die Sicherung enthält keinen gültigen Lernstand. Es wurde nichts geändert.";
  }
}

export function importedText(name: string): string {
  return `Der Stand von ${name} ist importiert. Dein vorheriger Stand liegt als Sicherung auf diesem Gerät.`;
}

/** Erklärung zu den automatischen Sicherungen auf der Seite „Fortschritt sichern“. */
export const AUTO_BACKUP_INFO =
  "Vor jedem Import und vor jedem Neustart legt die App eine Sicherung deines Standes auf diesem Gerät an. Sie behält die drei neuesten und löscht ältere.";

export const NO_AUTO_BACKUP_TEXT = "Es gibt noch keine automatische Sicherung auf diesem Gerät.";

/** Zeile zur letzten automatischen Sicherung: von wann und was drin ist. */
export function backupLine(when: string, cards: number, unitsDone: number, unitsTotal: number): string {
  return `Vom ${when}: ${cards} Karten, ${unitsDone} von ${unitsTotal} Haltestellen abgeschlossen.`;
}

export function restoredText(when: string): string {
  return `Die Sicherung vom ${when} ist wieder dein Stand. Dein vorheriger Stand liegt als neue Sicherung auf diesem Gerät.`;
}

/** Ob das Gerät eine Datei über das Teilen-Menü schicken kann. Ohne Browser immer `false`. */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof File === "undefined") return false;
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File(["{}"], "probe.json", { type: "application/json" })] });
  } catch {
    return false;
  }
}

/** Gibt die Datei an den Browser zum Speichern. Muss in der Klick-Behandlung laufen. */
export function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Warnung, wenn der Import weniger Punkte hat als der aktuelle Stand. Wie die Zeile „Punkte“ im Vergleich entfällt sie,
 * sobald einer der beiden Stände im Ruhemodus ist. Ergänzt `compareImport` aus `src/core/backup.ts`.
 */
export function pointsWarning(current: ImportSummary, imported: ImportSummary): string | null {
  if (current.calm || imported.calm) return null;
  if (imported.points >= current.points) return null;
  return `Die Sicherung hat weniger Punkte als dein Stand: ${imported.points} statt ${current.points}.`;
}
