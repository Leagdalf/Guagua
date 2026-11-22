import { useId, useState } from "react";
import type { ChangeEvent } from "react";
import { buildExport, checkImport, exportFileName, summaryRows } from "../../core/backup";
import type { ImportSummary } from "../../core/backup";
import type { ReplaceResult } from "../../core/store";
import type { Clock } from "../../core/time";
import type { Progress } from "../../core/types";
import { PrimaryButton, SummaryList, TextArea, TextButton } from "../../ui";
import {
  BACKUP_HINT,
  COPY_DONE,
  COPY_MANUAL,
  FILE_TOO_BIG,
  FILE_UNREADABLE,
  MAX_IMPORT_BYTES,
  SHARE_ABORTED,
  SHARE_DONE,
  SHARE_FAILED,
  canShareFiles,
  downloadText,
  importedText,
  replaceFailureMessage,
  savedText,
} from "./backupModel";
import { SubPage } from "./SubPage";

export interface BackupPageProps {
  progress: Progress;
  /** Uhr der App für Datum im Dateinamen und im Exporttext. */
  now: Clock;
  /** Ersetzt den Fortschritt durch den geprüften Import (`progressStore.replaceProgress`). */
  onReplace: (next: Progress) => ReplaceResult;
  onBack: () => void;
}

type Phase =
  | { kind: "main" }
  | { kind: "confirm"; next: Progress; summary: ImportSummary }
  | { kind: "done"; name: string };

/**
 * Fortschritt sichern (Spezifikation 2.7). Export über das Teilen-Menü, als Datei oder in die Zwischenablage.
 * Import aus Datei oder eingefügtem Text: erst prüfen, dann zeigen, was kommt, dann ausdrücklich fragen.
 * Teilen, Zwischenablage und Dateiauswahl laufen direkt in der Klick-Behandlung.
 */
export function BackupPage({ progress, now, onReplace, onBack }: BackupPageProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "main" });
  const [canShare] = useState(canShareFiles);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [manualText, setManualText] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
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

  const check = (text: string): void => {
    const result = checkImport(text);
    if (!result.ok) {
      setImportError(result.message);
      return;
    }
    setImportError(null);
    setPhase({ kind: "confirm", next: result.progress, summary: result.summary });
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setImportError(FILE_TOO_BIG);
      input.value = "";
      return;
    }
    file.text().then(check, () => setImportError(FILE_UNREADABLE));
    // Dieselbe Datei lässt sich danach erneut wählen.
    input.value = "";
  };

  const handleImport = (): void => {
    if (phase.kind !== "confirm") return;
    const result = onReplace(phase.next);
    if (result.ok) {
      setImportError(null);
      setPhase({ kind: "done", name: phase.next.profile.name });
      setPasted("");
      return;
    }
    setImportError(replaceFailureMessage(result.reason));
    setPhase({ kind: "main" });
  };

  if (phase.kind === "confirm") {
    return (
      <ImportConfirm
        summary={phase.summary}
        currentName={progress.profile.name}
        onConfirm={handleImport}
        onCancel={() => setPhase({ kind: "main" })}
      />
    );
  }

  if (phase.kind === "done") {
    return (
      <SubPage title="Fortschritt sichern" onBack={onBack}>
        <p className="page-lead" role="status">
          {importedText(phase.name)}
        </p>
        <div className="more__actions">
          <TextButton onClick={onBack}>Fertig</TextButton>
        </div>
      </SubPage>
    );
  }

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
          Wähle eine Sicherungsdatei oder füge ihren Text ein. Die App prüft sie zuerst und zeigt dir, was sie enthält. Erst nach deiner
          Bestätigung ändert sich etwas.
        </p>
        <div className="more__actions">
          <label className="text-btn file-pick">
            Datei auswählen
            <input type="file" className="vh" accept="application/json,.json" onChange={handleFile} />
          </label>
        </div>
        <TextArea className="sec__text" label="Oder Text einfügen" rows={4} value={pasted} onChange={setPasted} placeholder="Text der Sicherung" />
        <div className="more__actions">
          <TextButton onClick={() => check(pasted)}>Text prüfen</TextButton>
        </div>
        {importError && (
          <p className="more__msg more__msg--error" role="alert">
            <strong>Nicht importiert.</strong> {importError}
          </p>
        )}
      </section>
    </SubPage>
  );
}

/** Rückfrage vor dem Import: zeigt, was importiert würde, und fragt ausdrücklich. */
export function ImportConfirm({
  summary,
  currentName,
  onConfirm,
  onCancel,
}: {
  summary: ImportSummary;
  currentName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <SubPage title="Stand importieren?" onBack={onCancel}>
      <p className="page-lead">Das würde importiert:</p>
      <SummaryList className="sec__text" items={summaryRows(summary)} />
      <p className="sec__text">
        Dein aktueller Stand von {currentName} wird ersetzt. Vorher legt die App auf diesem Gerät eine Sicherung davon an. Wenn die
        Sicherung scheitert, wird nichts importiert.
      </p>
      <div className="more__actions">
        <PrimaryButton onClick={onConfirm}>Jetzt importieren</PrimaryButton>
        <TextButton onClick={onCancel}>Abbrechen</TextButton>
      </div>
    </SubPage>
  );
}
