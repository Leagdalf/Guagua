import { useId, useState } from "react";
import type { ChangeEvent } from "react";
import { checkImport } from "../../core/backup";
import type { ImportSummary } from "../../core/backup";
import type { Progress } from "../../core/types";
import { TextButton } from "../../ui";
import { FILE_TOO_BIG, FILE_UNREADABLE, MAX_IMPORT_BYTES } from "./backupModel";

export interface ImportPanelProps {
  /** Der Text oder die Datei hat die Prüfung bestanden. Es wurde noch nichts geändert, die Rückfrage kommt danach. */
  onChecked: (progress: Progress, summary: ImportSummary) => void;
  /** Meldung von außen, zum Beispiel nach einem gescheiterten Import. Steht über der eigenen Fehlermeldung. */
  externalError?: string | null;
  /** Beschriftung des Einfügefelds. */
  pasteLabel?: string;
}

/**
 * Import aus Datei oder eingefügtem Text, nur bis zur Prüfung. Das Einfügefeld hat Autokorrektur, Großschreibung und
 * Rechtschreibprüfung aus, sonst „verbessert“ iOS den Text der Sicherung. Dateiauswahl nur über den Knopf (Geste des Nutzers).
 */
export function ImportPanel({ onChecked, externalError = null, pasteLabel = "Oder Text einfügen" }: ImportPanelProps) {
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pasteId = useId();

  const check = (text: string): void => {
    const result = checkImport(text);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    onChecked(result.progress, result.summary);
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setError(FILE_TOO_BIG);
      input.value = "";
      return;
    }
    file.text().then(check, () => setError(FILE_UNREADABLE));
    // Dieselbe Datei lässt sich danach erneut wählen.
    input.value = "";
  };

  const shown = error ?? externalError;

  return (
    <>
      <div className="more__actions">
        <label className="text-btn file-pick">
          Datei auswählen
          <input type="file" className="vh" accept="application/json,.json" onChange={handleFile} />
        </label>
      </div>
      <div className="field sec__text">
        <label className="label field__label" htmlFor={pasteId}>
          {pasteLabel}
        </label>
        <textarea
          id={pasteId}
          className="field__input field__input--area"
          rows={4}
          value={pasted}
          placeholder="Text der Sicherung"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(event) => setPasted(event.target.value)}
        />
      </div>
      <div className="more__actions">
        <TextButton onClick={() => check(pasted)}>Text prüfen</TextButton>
      </div>
      {shown && (
        <p className="more__msg more__msg--error" role="alert">
          <strong>Nicht importiert.</strong> {shown}
        </p>
      )}
    </>
  );
}
