import { speak } from "../../audio";
import { AudioButton, Es } from "../../ui";
import { ChoiceGroup } from "./ChoiceGroup";

/** Das, was die Ansicht von einer Stimme braucht. */
export type VoiceInfo = Pick<SpeechSynthesisVoice, "voiceURI" | "name" | "lang">;

/** Wortlaut des Stimmentests. `{name}` ersetzt das Tonmodul mit dem Namen aus dem Profil. */
export const VOICE_TEST_TEXT = "Hola, {name}";

/** Pfad zum Nachladen spanischer Stimmen, aus docs/06-deployment-und-ipad.md, Abschnitt 4. */
export const VOICE_HELP =
  "Auf diesem Gerät ist keine spanische Stimme da. Du kannst eine laden: iOS-Einstellungen, Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch. Der Pfad kann je nach iOS-Version anders heißen. Danach die App schließen und neu öffnen. Bis dahin läuft die App ohne Ton.";

const AUTO = "auto";

export interface VoiceTestProps {
  voices: readonly VoiceInfo[];
  /** Gespeicherte Stimme aus dem Profil. */
  voiceURI: string | null;
  name: string;
  /** Wahl speichern. `null` heißt automatisch (die erste spanische Stimme). Gilt für den nächsten Ton sofort. */
  onPick: (voiceURI: string | null) => void;
}

/**
 * Stimmentest für den ersten Start und die Einstellungen: ein Knopf spielt „Hola, {name}“, bei mehreren spanischen
 * Stimmen stehen sie zur Wahl, ohne Stimme erklärt ein Hinweis, wo man sie lädt.
 */
export function VoiceTest({ voices, voiceURI, name, onPick }: VoiceTestProps) {
  const hasVoice = voices.length > 0;
  const known = voices.some((voice) => voice.voiceURI === voiceURI);
  return (
    <div>
      <div className="voice-test">
        <AudioButton label="Stimme testen" disabled={!hasVoice} onClick={() => speak(VOICE_TEST_TEXT)} />
        <Es className="voice-test__hola">{`Hola, ${name}`}</Es>
      </div>
      {!hasVoice && <p className="sec__muted">{VOICE_HELP}</p>}
      {voices.length > 1 && (
        <ChoiceGroup
          className="sec"
          label="Stimme"
          value={known && voiceURI ? voiceURI : AUTO}
          onChange={(id) => onPick(id === null || id === AUTO ? null : id)}
          options={[
            { id: AUTO, label: "Automatisch", detail: "erste spanische Stimme" },
            ...voices.map((voice) => ({ id: voice.voiceURI, label: voice.name, detail: voice.lang })),
          ]}
        />
      )}
    </div>
  );
}
