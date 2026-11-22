import { useState } from "react";
import { formatDateTime, summarizeProgress } from "../../core/backup";
import type { ImportSummary } from "../../core/backup";
import type { LoadErrorReason } from "../../core/progress";
import type { BackupInfo, ReplaceResult } from "../../core/store";
import type { Progress } from "../../core/types";
import { progressStore } from "../../state";
import { ActionBar, PrimaryButton, SimplePage, TextButton } from "../../ui";
import { backupLine, replaceFailureMessage } from "../more/backupModel";
import { ImportConfirm } from "../more/ImportConfirm";
import { ImportPanel } from "../more/ImportPanel";
import "../more/choice.css";
import "../more/more.css";

/** Was zum Fehler gesagt wird, je Grund. */
export function errorText(reason: LoadErrorReason): string {
  switch (reason) {
    case "foreign-schema":
      return "Der gespeicherte Lernstand stammt aus einer anderen Version der App und lässt sich hier nicht lesen.";
    case "invalid":
      return "Der gespeicherte Lernstand ist beschädigt und lässt sich nicht lesen.";
    default:
      return "Der gespeicherte Lernstand lässt sich nicht lesen. Vielleicht sperrt der Browser den Speicher.";
  }
}

export interface LoadErrorViewProps {
  reason: LoadErrorReason;
  /** `progressStore.restart()`: `false`, wenn das Sichern des alten Stands scheitert und nichts überschrieben wurde. */
  onRestart: () => boolean;
  /** Ersetzt den Stand durch den geprüften Import (`progressStore.replaceProgress`). Standard: der Speicher der App. */
  onReplace?: (next: Progress) => ReplaceResult;
  /** Letzte automatische Sicherung (`progressStore.latestBackup`). Standard: der Speicher der App. */
  getBackup?: () => BackupInfo | null;
}

type Phase = { kind: "main" } | { kind: "confirm"; next: Progress; summary: ImportSummary; source: "import" | "backup" };

/**
 * Der gespeicherte Lernstand ist nicht lesbar. Nichts wird überschrieben, bis „Neu beginnen“ getippt oder ein Import bestätigt wird.
 * Neben dem Neustart bietet die Ansicht den Import einer Sicherung aus Datei oder Text und die letzte automatische Sicherung an,
 * jeweils mit derselben Prüfung und Rückfrage wie unter „Fortschritt sichern“. Nach einem gelungenen Import ist der Speicher
 * wieder bereit und die App zeigt die Linie.
 */
export function LoadErrorView({ reason, onRestart, onReplace, getBackup }: LoadErrorViewProps) {
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "main" });
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [backup] = useState<BackupInfo | null>(() => (getBackup ?? (() => progressStore.latestBackup()))());
  const replace = onReplace ?? ((next: Progress) => progressStore.replaceProgress(next));

  const handleConfirm = (): void => {
    if (phase.kind !== "confirm") return;
    const result = replace(phase.next);
    if (result.ok) return; // Der Speicher ist wieder bereit, die App wechselt die Ansicht.
    setReplaceError(replaceFailureMessage(result.reason));
    setPhase({ kind: "main" });
  };

  const handleAskRestore = (): void => {
    if (!backup) return;
    setReplaceError(null);
    setPhase({ kind: "confirm", next: backup.progress, summary: summarizeProgress(backup.progress, null), source: "backup" });
  };

  if (phase.kind === "confirm") {
    return <ImportConfirm summary={phase.summary} current={null} kind={phase.source} onConfirm={handleConfirm} onCancel={() => setPhase({ kind: "main" })} />;
  }

  const backupSummary = backup ? summarizeProgress(backup.progress, null) : null;

  return (
    <SimplePage
      className="onb"
      footer={
        <ActionBar>
          <PrimaryButton
            onClick={() => {
              if (!onRestart()) setFailed(true);
            }}
          >
            Neu beginnen
          </PrimaryButton>
        </ActionBar>
      }
    >
      <h1 className="page-title">Dein Lernstand ist nicht lesbar</h1>
      <p className="page-lead">{errorText(reason)}</p>
      <p className="sec__text">
        Mit „Neu beginnen“ startest du mit leerem Stand. Ein gespeicherter alter Text bleibt als Sicherung im Speicher des Browsers erhalten und wird nicht gelöscht.
      </p>
      {failed && (
        <p className="sec__text" role="alert">
          Nichts wurde überschrieben: Die Sicherung des alten Stands hat nicht geklappt. Dein Stand ist unverändert. Versuche es noch einmal oder prüfe, ob der Browser Speicherplatz frei hat.
        </p>
      )}

      <section className="sec" aria-labelledby="error-import">
        <h2 className="sec__title" id="error-import">
          Sicherung importieren
        </h2>
        <p className="sec__text">
          Hast du deinen Lernstand gesichert? Wähle die Datei oder füge ihren Text ein. Die App prüft sie und fragt, bevor sich etwas ändert.
        </p>
        <ImportPanel onChecked={(next, summary) => setPhase({ kind: "confirm", next, summary, source: "import" })} externalError={replaceError} />
      </section>

      {backup && backupSummary && (
        <section className="sec" aria-labelledby="error-auto">
          <h2 className="sec__title" id="error-auto">
            Automatische Sicherung
          </h2>
          <p className="sec__text">{backupLine(formatDateTime(backup.at), backupSummary.cardCount, backupSummary.unitsDone, backupSummary.unitsTotal)}</p>
          <div className="more__actions">
            <TextButton onClick={handleAskRestore}>Letzte Sicherung zurückholen</TextButton>
          </div>
        </section>
      )}
    </SimplePage>
  );
}
