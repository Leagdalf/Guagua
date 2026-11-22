import { useState } from "react";
import { useVoices } from "../../audio";
import { NAME_MAX_LENGTH } from "../../core/config";
import { normalizeName } from "../../core/progress";
import type { ProfilePatch } from "../../core/progress";
import type { Progress } from "../../core/types";
import { ActionBar, PrimaryButton, SimplePage, TextButton, TextField } from "../../ui";
import { VoiceTest } from "../more/VoiceTest";
import type { VoiceInfo } from "../more/VoiceTest";
import "../more/choice.css";

export type OnboardingStep = "install" | "name" | "voice";

export interface OnboardingProps {
  /** Läuft die App schon vom Home-Bildschirm, entfällt die Anleitung. */
  standalone: boolean;
  /** Profil, sobald der Name gespeichert ist. */
  profile: Progress["profile"] | null;
  /** Legt das Profil an. `false` bei ungültigem Namen. Muss das Profil im Speicher setzen, bevor der Stimmentest läuft. */
  onCreateProfile: (name: string) => boolean;
  onUpdateProfile: (patch: ProfilePatch) => void;
  /** Weiter zur Linie. */
  onDone: () => void;
}

export function Onboarding(props: OnboardingProps) {
  const { voices } = useVoices();
  return <OnboardingSteps {...props} voices={voices} />;
}

/** Die drei Schritte des ersten Starts. `voices` kommt von außen, damit sich jeder Zustand ohne Browser prüfen lässt. */
export function OnboardingSteps({
  standalone,
  profile,
  onCreateProfile,
  onUpdateProfile,
  onDone,
  voices,
  initialStep,
}: OnboardingProps & { voices: readonly VoiceInfo[]; initialStep?: OnboardingStep }) {
  const [step, setStep] = useState<OnboardingStep>(initialStep ?? (standalone ? "name" : "install"));
  const [name, setName] = useState("");
  const valid = normalizeName(name) !== null;

  if (step === "install") {
    return (
      <SimplePage className="onb">
        <h1 className="page-title">Guagua auf den Home-Bildschirm legen</h1>
        <p className="page-lead">
          Auf dem Home-Bildschirm läuft Guagua ohne Safari-Leiste und funktioniert auch ohne Netz. Das geht auf iPad und iPhone so:
        </p>
        <ol className="onb__steps">
          <li>Öffne Guagua in Safari.</li>
          <li>Tippe auf das Teilen-Symbol: das Quadrat mit dem Pfeil nach oben.</li>
          <li>Wähle „Zum Home-Bildschirm“ und tippe auf „Hinzufügen“.</li>
          <li>Starte Guagua danach vom Home-Bildschirm.</li>
        </ol>
        <p className="sec__muted">
          Der Lernstand liegt nur auf deinem Gerät. Die App auf dem Home-Bildschirm hat einen eigenen Speicher, getrennt von Safari.
          Deshalb installierst du sie, bevor du deinen Namen eingibst.
        </p>
        <div className="sec">
          <TextButton onClick={() => setStep("name")}>Trotzdem im Browser weitermachen</TextButton>
        </div>
      </SimplePage>
    );
  }

  if (step === "name") {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && onCreateProfile(name)) setStep("voice");
        }}
        className="onb__form"
      >
        <SimplePage
          className="onb"
          footer={
            <ActionBar>
              <PrimaryButton type="submit" disabled={!valid}>
                Weiter
              </PrimaryButton>
            </ActionBar>
          }
        >
          <h1 className="page-title">Wie heißt du?</h1>
          <p className="page-lead">Die App spricht dich damit an. Der Name bleibt auf diesem Gerät.</p>
          <TextField
            className="sec"
            label="Dein Name"
            value={name}
            onChange={setName}
            autoComplete="given-name"
            enterKeyHint="next"
            help={`Höchstens ${NAME_MAX_LENGTH} Zeichen.`}
          />
        </SimplePage>
      </form>
    );
  }

  return (
    <SimplePage
      className="onb"
      footer={
        <ActionBar>
          <PrimaryButton onClick={onDone}>Weiter zur Linie</PrimaryButton>
        </ActionBar>
      }
    >
      <h1 className="page-title">Stimme testen</h1>
      <p className="page-lead">Tippe auf den Knopf und hör zu, ob du die Stimme gut verstehst.</p>
      <VoiceTest
        voices={voices}
        voiceURI={profile?.voiceURI ?? null}
        name={profile?.name ?? ""}
        onPick={(voiceURI) => onUpdateProfile({ voiceURI })}
      />
    </SimplePage>
  );
}
