import { useId, useState } from "react";
import type { Clock } from "../../core/time";
import type { Progress } from "../../core/types";
import { PrimaryButton, TextArea, TextButton } from "../../ui";
import {
  NOTES_EMPTY_TEXT,
  NOTES_INTRO,
  NOTE_MAX_LENGTH,
  SHARE_CANCELLED,
  SHARE_COPIED,
  SHARE_COPY_MANUAL,
  SHARE_FAILED_TEXT,
  SHARE_NOTHING_TEXT,
  SHARE_SENT,
  addNote,
  cleanNote,
  hasShareable,
  noteDate,
  noteEntries,
  removeNote,
  shareText,
} from "./feedbackModel";
import { SubPage } from "./SubPage";

export interface FeedbackPageProps {
  progress: Progress;
  /** Uhr der App für das Datum der Notiz. */
  now: Clock;
  /** Ändert den Fortschritt und speichert sofort (`progressStore.update`). */
  onUpdate: (fn: (progress: Progress) => Progress) => void;
  onBack: () => void;
}

/**
 * Rückmeldung (Spezifikation 2.9, Punkt 12): kurze Notizen eingeben, als Liste mit Datum sehen, einzeln löschen.
 * „Teilen“ gibt alle Notizen mit den Notizen der Missionen als Text an das Teilen-Menü, als Ersatz in die Zwischenablage.
 * Teilen und Kopieren laufen direkt in der Klick-Behandlung.
 */
export function FeedbackPage({ progress, now, onUpdate, onBack }: FeedbackPageProps) {
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [manualText, setManualText] = useState<string | null>(null);
  const manualId = useId();
  const entries = noteEntries(progress);
  const shareable = hasShareable(progress);

  const handleSave = (): void => {
    if (cleanNote(draft) === null) return;
    onUpdate((p) => addNote(p, draft, now));
    setDraft("");
    setMessage(null);
  };

  const handleDelete = (index: number): void => {
    onUpdate((p) => removeNote(p, index));
    setMessage(null);
  };

  const copy = (text: string): void => {
    const showManual = (): void => {
      setManualText(text);
      setMessage(SHARE_COPY_MANUAL);
    };
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      showManual();
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      setManualText(null);
      setMessage(SHARE_COPIED);
    }, showManual);
  };

  const handleCopy = (): void => {
    const text = shareText(progress);
    if (text === "") {
      setMessage(SHARE_NOTHING_TEXT);
      return;
    }
    copy(text);
  };

  const handleShare = (): void => {
    const text = shareText(progress);
    if (text === "") {
      setMessage(SHARE_NOTHING_TEXT);
      return;
    }
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      // Kein Teilen-Menü: Ersatz ist die Zwischenablage, ebenfalls direkt in dieser Klick-Behandlung.
      copy(text);
      return;
    }
    navigator.share({ title: "Rückmeldung zu Guagua", text }).then(
      () => {
        setManualText(null);
        setMessage(SHARE_SENT);
      },
      (error: unknown) => setMessage(error instanceof Error && error.name === "AbortError" ? SHARE_CANCELLED : SHARE_FAILED_TEXT),
    );
  };

  return (
    <SubPage title="Rückmeldung" onBack={onBack}>
      <p className="page-lead">{NOTES_INTRO}</p>

      <section className="sec" aria-labelledby="feedback-new">
        <h2 className="sec__title" id="feedback-new">
          Neue Notiz
        </h2>
        <TextArea
          label="Deine Notiz"
          rows={3}
          value={draft}
          onChange={setDraft}
          placeholder="Zum Beispiel: Hat mir gefehlt"
          help={`Höchstens ${NOTE_MAX_LENGTH} Zeichen.`}
        />
        <div className="more__actions">
          <PrimaryButton disabled={cleanNote(draft) === null} onClick={handleSave}>
            Notiz speichern
          </PrimaryButton>
        </div>
      </section>

      <section className="sec" aria-labelledby="feedback-list">
        <h2 className="sec__title" id="feedback-list">
          Deine Notizen
        </h2>
        {entries.length === 0 ? (
          <p className="sec__text">{NOTES_EMPTY_TEXT}</p>
        ) : (
          <ul className="examples">
            {entries.map((entry) => (
              <li key={`${entry.index}-${entry.at}`}>
                <div>
                  <p className="feedback__text">{entry.text}</p>
                  <p className="examples__de">{noteDate(entry.at)}</p>
                </div>
                <TextButton aria-label={`Notiz vom ${noteDate(entry.at)} löschen`} onClick={() => handleDelete(entry.index)}>
                  Löschen
                </TextButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sec" aria-labelledby="feedback-share">
        <h2 className="sec__title" id="feedback-share">
          Teilen
        </h2>
        <p className="sec__text">Der Text enthält alle Notizen und die Notizen deiner Missionen, aber nicht deinen Namen.</p>
        <div className="more__actions">
          <TextButton disabled={!shareable} onClick={handleShare}>
            Teilen
          </TextButton>
          <TextButton disabled={!shareable} onClick={handleCopy}>
            In die Zwischenablage kopieren
          </TextButton>
        </div>
        {message && (
          <p className="more__msg" role="status">
            {message}
          </p>
        )}
        {manualText !== null && (
          <div className="field more__manual">
            <label className="label field__label" htmlFor={manualId}>
              Text zum Kopieren
            </label>
            <textarea
              id={manualId}
              className="field__input field__input--area"
              rows={6}
              readOnly
              value={manualText}
              onFocus={(event) => event.target.select()}
            />
          </div>
        )}
      </section>
    </SubPage>
  );
}
