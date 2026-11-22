import { useState } from "react";
import { useVoices } from "../../audio";
import { NAME_MAX_LENGTH } from "../../core/config";
import { normalizeName, updateProfile } from "../../core/progress";
import type { ProfilePatch } from "../../core/progress";
import type { Progress } from "../../core/types";
import { TextField } from "../../ui";
import { CALM_EXPLANATION } from "./aboutModel";
import { ChoiceGroup } from "./ChoiceGroup";
import { SubPage } from "./SubPage";
import { VoiceTest } from "./VoiceTest";

export interface SettingsPageProps {
  progress: Progress;
  /** Ändert den Fortschritt und speichert sofort (`progressStore.update`). */
  onUpdate: (fn: (progress: Progress) => Progress) => void;
  onBack: () => void;
}

/** Einstellungen: Name, Stimme mit Testknopf, Sprechtempo, Ruhemodus. Jede Änderung gilt sofort und bleibt gespeichert. */
export function SettingsPage({ progress, onUpdate, onBack }: SettingsPageProps) {
  const { profile } = progress;
  const { voices } = useVoices();
  const [draft, setDraft] = useState(profile.name);

  const change = (patch: ProfilePatch): void => onUpdate((p) => updateProfile(p, patch));
  const valid = normalizeName(draft) !== null;

  return (
    <SubPage title="Einstellungen" onBack={onBack}>
      <section className="sec" aria-label="Name und Stimme">
        <TextField
          className="sec__text"
          label="Name"
          value={draft}
          autoComplete="given-name"
          onChange={(value) => {
            setDraft(value);
            if (normalizeName(value) !== null) change({ name: value });
          }}
          help={
            valid
              ? "Die App spricht dich damit an. Der Name bleibt auf diesem Gerät."
              : `Der Name braucht 1 bis ${NAME_MAX_LENGTH} Zeichen. Bis dahin gilt: ${profile.name}.`
          }
        />
        <VoiceTest
          voices={voices}
          voiceURI={profile.voiceURI}
          name={profile.name}
          onPick={(voiceURI) => change({ voiceURI })}
        />
        <ChoiceGroup
          className="sec"
          label="Sprechtempo"
          value={profile.rate}
          onChange={(id) => id && change({ rate: id === "slow" ? "slow" : "normal" })}
          options={[
            { id: "normal", label: "Normal" },
            { id: "slow", label: "Langsam" },
          ]}
        />
        <ChoiceGroup
          className="sec"
          label="Ruhemodus"
          value={profile.calm ? "on" : "off"}
          onChange={(id) => id && change({ calm: id === "on" })}
          options={[
            { id: "off", label: "Aus" },
            { id: "on", label: "An" },
          ]}
        />
        <p className="sec__muted">{CALM_EXPLANATION}</p>
      </section>
    </SubPage>
  );
}
