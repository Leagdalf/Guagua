import { useId, useState } from "react";
import { buildExport, exportFileName, formatDateTime, summarizeProgress } from "../../core/backup";
import type { ImportSummary } from "../../core/backup";
import type { BackupInfo, ReplaceResult } from "../../core/store";
import type { Clock } from "../../core/time";
import type { Progress } from "../../core/types";
import { PrimaryButton, TextButton } from "../../ui";
import {
  AUTO_BACKUP_INFO,
  BACKUP_HINT,
  COPY_DONE,
  COPY_MANUAL,
  NO_AUTO_BACKUP_TEXT,
  SHARE_ABORTED,
  SHARE_DONE,
  SHARE_FAILED,
  backupLine,
  canShareFiles,
  downloadText,
  importedText,
  replaceFailureMessage,
  restoredText,
  savedText,
} from "./backupModel";
import { ImportConfirm } from "./ImportConfirm";
import { ImportPanel } from "./ImportPanel";
import { SubPage } from "./SubPage";

export { ImportConfirm } from "./ImportConfirm";

export interface BackupPageProps {
  progress: Progress;
  /** Uhr der App für Datum im Dateinamen und im Exporttext. */
  now: Clock;
  /** Ersetzt den Fortschritt durch den geprüften Import (`progressStore.replaceProgress`). */
  onReplace: (next: Progress) => ReplaceResult;
  /** Die letzte automatische Sicherung (`progressStore.latestBackup`) oder `null`. Wird nach jedem Ersetzen neu gelesen. */
  getBackup: () => BackupInfo | null;
  onBack: () => void;
}

type Phase =
  | { kind: "main" }
  | { kind: "confirm"; next: Progress; summary: ImportSummary; source: "import" | "backup"; at?: string }
  | { kind: "done"; text: string };

/**
 * Fortschritt sichern (Spezifikation 2.7). Export über das Teilen-Menü, als Datei oder in die Zwischenablage.
 * Import aus Datei oder eingefügtem Text und Zurückholen der letzten automatischen Sicherung: erst prüfen, dann den aktuellen
 * und den neuen Stand nebeneinander zeigen, dann ausdrücklich fragen. Teilen, Zwischenablage und Dateiauswahl laufen direkt
 * in der Klick-Behandlung.
 */
export function BackupPage({ progress, now, onReplace, getBackup, onBack }: BackupPageProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "main" });
  const [canShare] = useState(canShareFiles);
  const [backup, setBackup] = useState<BackupInfo | null>(getBackup);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [manualText, setManualText] = useState<string | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const manualId = useId();

  const handleDownload = (): void => {
    const name = exportFileName(now);
    downloadText(buildExport(progress, now), name);
    setExportMessage(savedText(name));
    setManualText(null);
  };

  const handleShare = (): void => {
    if (!canShare) {
      handleDownload();
      return;
    }
    const file = new File([buildExport(progress, now)], exportFileName(now), { type: "application/json" });
    // Direkt in der Klick-Behandlung, ohne vorheriges await: iOS verlangt die Geste.
    navigator.share({ files: [file], title: "Guagua-Sicherung" }).then(
      () => setExportMessage(SHARE_DONE),
      (error: unknown) => setExportMessage(error instanceof Error && error.name === "AbortError" ? SHARE_ABORTED : SHARE_FAILED),
    );
  };

  const handleCopy = (): void => {
    const text = buildExport(progress, now);
    const showManual = (): void => {
      setManualText(text);
      setExportMessage(COPY_MANUAL);
    };
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      showManual();
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      setManualText(null);
      setExportMessage(COPY_DONE);
    }, showManual);
  };

  const handleChecked = (next: Progress, summary: ImportSummary): void => {
    setReplaceError(null);
    setPhase({ kind: "confirm", next, summary, source: "import" });
  };

  const handleAskRestore = (): void => {
    if (!backup) return;
    setReplaceError(null);
    setPhase({ kind: "confirm", next: backup.progress, summary: summarizeProgress(backup.progress, null), source: "backup", at: backup.at });
  };

  const handleConfirm = (): void => {
    if (phase.kind !== "confirm") return;
    const result = onReplace(phase.next);
    if (result.ok) {
      setReplaceError(null);
      setBackup(getBackup());
      setPhase({
        kind: "done",
        text: phase.source === "backup" && phase.at ? restoredText(formatDateTime(phase.at)) : importedText(phase.next.profile.name),
      });
      return;
    }
    setReplaceError(replaceFailureMessage(result.reason));
    setPhase({ kind: "main" });
  };

  if (phase.kind === "confirm") {
    return (
      <ImportConfirm
        summary={phase.summary}
        current={summarizeProgress(progress, null)}
        kind={phase.source}
        onConfirm={handleConfirm}
        onCancel={() => setPhase({ kind: "main" })}
      />
    );
  }

  if (phase.kind === "done") {
    return (
      <SubPage title="Fortschritt sichern" onBack={onBack}>
        <p className="page-lead" role="status">
          {phase.text}
        </p>
        <div className="more__actions">
          <TextButton onClick={onBack}>Fertig</TextButton>
        </div>
      </SubPage>
    );
  }

  const backupSummary = backup ? summarizeProgress(backup.progress, null) : null;

  return (
    <SubPage title="Fortschritt sichern" onBack={onBack}>
      <p className="page-lead">{BACKUP_HINT}</p>

      <section className="sec" aria-labelledby="backup-export">
        <h2 className="sec__title" id="backup-export">
          Sichern
        </h2>
        <p className="sec__text">
          Die Datei enthält deinen ganzen Lernstand. {canShare ? "Das Teilen-Menü zeigt dir, wohin du sie schicken kannst." : "Dein Gerät speichert sie als Datei."}
        </p>
        <div className="more__actions">
          <PrimaryButton onClick={handleShare}>{canShare ? "Sicherung teilen" : "Als Datei speichern"}</PrimaryButton>
          {canShare && <TextButton onClick={handleDownload}>Als Datei speichern</TextButton>}
          <TextButton onClick={handleCopy}>In die Zwischenablage kopieren</TextButton>
        </div>
        {exportMessage && (
          <p className="more__msg" role="status">
            {exportMessage}
          </p>
        )}
        {manualText !== null && (
          <div className="field more__manual">
            <label className="label field__label" htmlFor={manualId}>
              Text der Sicherung
            </label>
            <textarea
              id={manualId}
              className="field__input field__input--area"
              rows={4}
              readOnly
              value={manualText}
              onFocus={(event) => event.target.select()}
            />
          </div>
        )}
      </section>

      <section className="sec" aria-labelledby="backup-import">
        <h2 className="sec__title" id="backup-import">
          Wiederherstellen
        </h2>
        <p className="sec__text">
          Wähle eine Sicherungsdatei oder füge ihren Text ein. Die App prüft sie zuerst und stellt sie neben deinen Stand. Erst nach deiner
          Bestätigung ändert sich etwas.
        </p>
        <ImportPanel onChecked={handleChecked} externalError={replaceError} />
      </section>

      <section className="sec" aria-labelledby="backup-auto">
        <h2 className="sec__title" id="backup-auto">
          Automatische Sicherung
        </h2>
        <p className="sec__text">{AUTO_BACKUP_INFO}</p>
        {backup && backupSummary ? (
          <>
            <p className="sec__text" id="backup-auto-line">
              {backupLine(formatDateTime(backup.at), backupSummary.cardCount, backupSummary.unitsDone, backupSummary.unitsTotal)}
            </p>
            <div className="more__actions">
              <TextButton onClick={handleAskRestore}>Letzte Sicherung zurückholen</TextButton>
            </div>
          </>
        ) : (
          <p className="sec__text">{NO_AUTO_BACKUP_TEXT}</p>
        )}
      </section>
    </SubPage>
  );
}
