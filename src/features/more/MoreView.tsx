import { useState } from "react";
import { useVoices } from "../../audio";
import { NAME_MAX_LENGTH } from "../../core/config";
import { normalizeName, updateProfile } from "../../core/progress";
import type { ProfilePatch } from "../../core/progress";
import { currentStreak } from "../../core/stats";
import type { Day, Progress } from "../../core/types";
import { SimplePage, SummaryList, TextField } from "../../ui";
import { AI_NOTE, APP_VERSION, CONTENT_DATE, FONT_LICENSES } from "./aboutModel";
import { ChoiceGroup } from "./ChoiceGroup";
import { VoiceTest } from "./VoiceTest";
import "./choice.css";

export interface MoreViewProps {
  progress: Progress;
  day: Day;
  /** Ändert den Fortschritt und speichert sofort (`progressStore.update`). */
  onUpdate: (fn: (progress: Progress) => Progress) => void;
}

/** Mehr (Spezifikation 2.7, MVP): Einstellungen und Über die App. Gehört in `AppShell`. */
export function MoreView({ progress, day, onUpdate }: MoreViewProps) {
  const { profile } = progress;
  const { voices } = useVoices();
  const [draft, setDraft] = useState(profile.name);

  const change = (patch: ProfilePatch): void => onUpdate((p) => updateProfile(p, patch));
  const valid = normalizeName(draft) !== null;

  return (
    <SimplePage className="more">
      <h1 className="page-title">Mehr</h1>

      <section className="sec" aria-labelledby="more-settings">
        <h2 className="sec__title" id="more-settings">
          Einstellungen
        </h2>
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
      </section>

      <section className="sec" aria-labelledby="more-about">
        <h2 className="sec__title" id="more-about">
          Über die App
        </h2>
        <SummaryList
          items={[
            { label: "Version", value: APP_VERSION },
            { label: "Stand der Inhalte", value: CONTENT_DATE },
            { label: "Punkte", value: String(progress.stats.points) },
            { label: "Serie", value: serieText(currentStreak(progress, day)) },
          ]}
        />
        <p className="sec__muted">
          Schriften:{" "}
          {FONT_LICENSES.map((font, index) => (
            <span key={font.name}>
              {index > 0 && ", "}
              {font.name} ({font.license})
            </span>
          ))}
          .
        </p>
        <p className="sec__text">{AI_NOTE}</p>
      </section>
    </SimplePage>
  );
}

function serieText(days: number): string {
  return days === 1 ? "1 Tag" : `${days} Tage`;
}
