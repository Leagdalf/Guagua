import { hasGoodSpanishVoice, speak } from "../../audio";
import { AudioButton, Es } from "../../ui";
import { ChoiceGroup } from "./ChoiceGroup";

/** Das, was die Ansicht von einer Stimme braucht. */
export type VoiceInfo = Pick<SpeechSynthesisVoice, "voiceURI" | "name" | "lang">;

/** Wortlaut des Stimmentests. `{name}` ersetzt das Tonmodul mit dem Namen aus dem Profil. */
export const VOICE_TEST_TEXT = "Hola, {name}";

/** Pfad zum Nachladen spanischer Stimmen, aus docs/06-deployment-und-ipad.md, Abschnitt 4. */
export const VOICE_HELP =
  "Auf diesem Gerät ist keine spanische Stimme da. Du kannst eine laden: iOS-Einstellungen, Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch. Der Pfad kann je nach iOS-Version anders heißen. Danach die App schließen und neu öffnen. Bis dahin läuft die App ohne Ton.";

/** Steht da, solange keine erweiterte oder Premium-Stimme geladen ist. Die einfachen Stimmen betonen oft falsch. */
export const VOICE_UPGRADE_HELP =
  "Besser klingt eine erweiterte Stimme. Laden: iOS-Einstellungen, Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch, dort zum Beispiel Mónica (erweitert) oder Marisol (Premium). Danach die App schließen und neu öffnen.";

const AUTO = "auto";

export interface VoiceTestProps {
  voices: readonly VoiceInfo[];
  /** Gespeicherte Stimme aus dem Profil. */
  voiceURI: string | null;
  name: string;
  /** Wahl speichern. `null` heißt automatisch (die beste spanische Stimme). Gilt für den nächsten Ton sofort. */
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
      {hasVoice && !hasGoodSpanishVoice(voices) && <p className="sec__muted">{VOICE_UPGRADE_HELP}</p>}
      {voices.length > 1 && (
        <ChoiceGroup
          className="sec"
          label="Stimme"
          value={known && voiceURI ? voiceURI : AUTO}
          onChange={(id) => onPick(id === null || id === AUTO ? null : id)}
          options={[
            { id: AUTO, label: "Automatisch", detail: "beste spanische Stimme" },
            ...voices.map((voice) => ({ id: voice.voiceURI, label: voice.name, detail: voice.lang })),
          ]}
        />
      )}
    </div>
  );
}
