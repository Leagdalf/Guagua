import { useState } from "react";
import type { LoadErrorReason } from "../../core/progress";
import { ActionBar, PrimaryButton, SimplePage } from "../../ui";
import "../more/choice.css";

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
}

/** Der gespeicherte Lernstand ist nicht lesbar. Nichts wird überschrieben, bis „Neu beginnen“ getippt wird. */
export function LoadErrorView({ reason, onRestart }: LoadErrorViewProps) {
  const [failed, setFailed] = useState(false);
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
    </SimplePage>
  );
}
