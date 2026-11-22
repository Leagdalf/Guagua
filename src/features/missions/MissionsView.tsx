import { useEffect, useRef, useState } from "react";
import { speak, useVoices } from "../../audio";
import type { MissionFeeling, Progress } from "../../core/types";
import { AudioButton, Es, Label, PrimaryButton, SimplePage, TextArea, TextButton } from "../../ui";
import { ChoiceGroup } from "../more/ChoiceGroup";
import { FEELINGS, STATE_LABEL, feelingLabel, missionList, showsTask } from "./missionsModel";
import type { MissionEntry } from "./missionsModel";
import "./missions.css";

export interface MissionsViewProps {
  progress: Progress;
  /** Mission, die beim Öffnen schon aufgeklappt ist („Abhaken“ auf der Startseite). */
  focusMissionId?: string | null;
  onComplete: (missionId: string, result: { feeling?: MissionFeeling; note?: string }) => void;
  onSkip: (missionId: string) => void;
}

/** Missionen (Spezifikation 2.5): alle zehn mit Zustand. Gehört in `AppShell`. */
export function MissionsView({ progress, focusMissionId = null, onComplete, onSkip }: MissionsViewProps) {
  const entries = missionList(progress);
  const { hasVoice } = useVoices();
  return (
    <SimplePage className="mi">
      <h1 className="mi__title">Missionen</h1>
      <p className="mi__lead">
        Eine Mission wird offen, sobald du ihre Haltestelle abgeschlossen hast. Keine Mission sperrt eine Haltestelle. Du kannst sie
        überspringen und später nachholen.
      </p>
      <ol className="mi__list">
        {entries.map((entry) => (
          <MissionItem
            key={entry.missionId}
            entry={entry}
            hasVoice={hasVoice}
            startOpen={entry.missionId === focusMissionId}
            focus={entry.missionId === focusMissionId}
            onComplete={onComplete}
            onSkip={onSkip}
          />
        ))}
      </ol>
    </SimplePage>
  );
}

interface ItemProps {
  entry: MissionEntry;
  hasVoice: boolean;
  startOpen: boolean;
  focus: boolean;
  onComplete: MissionsViewProps["onComplete"];
  onSkip: MissionsViewProps["onSkip"];
}

function MissionItem({ entry, hasVoice, startOpen, focus, onComplete, onSkip }: ItemProps) {
  const [formOpen, setFormOpen] = useState(startOpen && showsTask(entry.state));
  const [feeling, setFeeling] = useState<MissionFeeling | null>(null);
  const [note, setNote] = useState("");
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView?.({ block: "start" });
  }, [focus]);

  const task = showsTask(entry.state);
  const stateText = entry.state === "locked" ? `${STATE_LABEL.locked}, wird mit Haltestelle ${entry.stop} offen` : STATE_LABEL[entry.state];

  return (
    <li ref={ref} className={`mi__item mi__item--${entry.state}`} id={`mission-${entry.missionId}`}>
      <Label as="p" tone={entry.state === "open" ? "accent" : "muted"}>
        Haltestelle {entry.stop} · {stateText}
      </Label>
      <h2 className="mi__name">{entry.title}</h2>

      {task && (
        <>
          <p className="mi__task">{entry.task}</p>
          <p className="mi__take">Sätze zum Mitnehmen</p>
          <ul className="mi__say">
            {entry.say.map((phrase, index) => {
              const id = `${entry.missionId}-say-${index}`;
              return (
                <li key={phrase} className="mi__phrase">
                  <Es id={id}>{phrase}</Es>
                  <AudioButton disabled={!hasVoice} describedBy={id} onClick={() => speak(phrase)} />
                </li>
              );
            })}
          </ul>
        </>
      )}

      {entry.state === "done" && (entry.feeling || entry.note) && (
        <p className="mi__result">
          {entry.feeling && <>Wie lief es: {feelingLabel(entry.feeling)}. </>}
          {entry.note}
        </p>
      )}

      {task && !formOpen && (
        <div className="mi__actions">
          <TextButton onClick={() => setFormOpen(true)}>{entry.state === "skipped" ? "Nachholen" : "Abhaken"}</TextButton>
          {entry.state === "open" && <TextButton onClick={() => onSkip(entry.missionId)}>Überspringen</TextButton>}
        </div>
      )}

      {task && formOpen && (
        <form
          className="mi__form"
          onSubmit={(event) => {
            event.preventDefault();
            onComplete(entry.missionId, { ...(feeling ? { feeling } : {}), ...(note.trim() ? { note } : {}) });
          }}
        >
          <ChoiceGroup
            label="Wie lief es? (freiwillig)"
            options={FEELINGS.map((entryFeeling) => ({ id: entryFeeling.id, label: entryFeeling.label }))}
            value={feeling}
            allowClear
            onChange={(id) => setFeeling(id as MissionFeeling | null)}
          />
          <TextArea className="mi__note" label="Notiz (freiwillig)" value={note} onChange={setNote} />
          <PrimaryButton type="submit">Mission erledigt</PrimaryButton>
          <TextButton onClick={() => setFormOpen(false)}>Abbrechen</TextButton>
        </form>
      )}
    </li>
  );
}
