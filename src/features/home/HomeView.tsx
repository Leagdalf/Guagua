import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { extraRoundIds } from "../../core/cards";
import { units } from "../../core/content";
import type { Day, Progress } from "../../core/types";
import { dayCounter, todayPlan } from "../../core/units";
import { ActionBar, Es, HomeHeader, HomePage, Line, MissionRow, PrimaryButton, SimplePage, TextButton, Today } from "../../ui";
import { FinalLineBody } from "../session/FinalLine";
import type { SessionRequest } from "../session/types";
import { formatDateDe } from "./dateText";
import { lineModel, stopTap } from "./lineModel";
import { StopOverview } from "./StopOverview";
import { todayBlock } from "./todayBlock";
import type { BlockAction, TextPart } from "./todayBlock";
import "./home.css";

/** Erklärzeile des Blocks: Deutsch mit spanischen Wörtern (kursiv, `lang="es"`). */
function textNode(parts: readonly TextPart[]): ReactNode {
  return parts.map((part, index) =>
    typeof part === "string" ? (
      <Fragment key={index}>{part}</Fragment>
    ) : (
      <Es key={index} size="inherit">
        {part.es}
      </Es>
    ),
  );
}

export interface HomeViewProps {
  progress: Progress;
  /** Heutiger Kalendertag nach der Uhr der App. */
  day: Day;
  onStartSession: (request: SessionRequest) => void;
  /** Führt zu den Missionen, mit dieser Mission geöffnet (oder ohne). */
  onOpenMissions: (missionId: string | null) => void;
}

function toTop(): void {
  if (typeof window !== "undefined") window.scrollTo(0, 0);
}

/**
 * Linie: Kopf mit Datum, „Tag n“ und Berg, Block „Heute“, offene Mission, die Linie mit allen elf Punkten.
 * Gehört in `AppShell`. Tippen auf eine abgeschlossene Haltestelle öffnet deren Übersicht.
 */
export function HomeView({ progress, day, onStartSession, onOpenMissions }: HomeViewProps) {
  const [overview, setOverview] = useState<string | null>(null);
  const [finalLine, setFinalLine] = useState(false);

  if (finalLine) {
    return (
      <SimplePage>
        <TextButton
          onClick={() => {
            setFinalLine(false);
            toTop();
          }}
        >
          Zurück zur Linie
        </TextButton>
        <FinalLineBody progress={progress} day={day} />
      </SimplePage>
    );
  }

  if (overview) {
    return (
      <StopOverview
        unitId={overview}
        name={progress.profile.name}
        onBack={() => {
          setOverview(null);
          toTop();
        }}
      />
    );
  }

  const plan = todayPlan(progress, day);
  // „10 Karten extra“ gibt es nur, wenn Karten aus abgeschlossenen Haltestellen da sind (dieselbe Quelle wie die Runde selbst).
  const hasExtraCards = extraRoundIds(progress, day).length > 0;
  const block = todayBlock(plan, hasExtraCards);
  const line = lineModel(progress, plan.unitId);
  const mission = plan.openMissionId ? units.find((unit) => unit.mission.id === plan.openMissionId)?.mission : undefined;

  const run = (action: BlockAction): void => {
    if (action.type === "session") onStartSession(action.request);
    else if (action.type === "extra") onStartSession({ kind: "extra" });
    else if (action.type === "final-line") {
      setFinalLine(true);
      toTop();
    } else onOpenMissions(null);
  };

  return (
    <HomePage
      header={<HomeHeader date={formatDateDe(day)} progress={`Tag ${dayCounter(progress, day)}`} stops={line.mountain} />}
      today={<Today label={block.label} title={block.title} titleLang={block.titleLang} text={textNode(block.text)} />}
      action={
        block.action && block.button ? (
          <ActionBar aboveTabs>
            <PrimaryButton onClick={() => run(block.action as BlockAction)}>{block.button}</PrimaryButton>
          </ActionBar>
        ) : null
      }
      mission={
        mission ? (
          <MissionRow
            title={mission.title_de}
            text={mission.task_de}
            phrases={mission.say}
            onAction={() => onOpenMissions(mission.id)}
          />
        ) : undefined
      }
      line={
        <>
          <Line
            title="Deine Linie"
            summary={line.summary}
            stops={line.stops}
            onSelect={(id) => {
              const tap = stopTap(line.stops, id);
              if (tap.type === "overview") {
                setOverview(tap.unitId);
                toTop();
              } else if (tap.type === "session") {
                onStartSession({ kind: "day", unitId: tap.unitId });
              } else if (tap.type === "final") {
                onStartSession({ kind: "final" });
              } else if (tap.type === "final-line") {
                setFinalLine(true);
                toTop();
              }
            }}
          />
          {hasExtraCards && block.action?.type !== "extra" && (
            <div className="home__extra">
              <TextButton onClick={() => onStartSession({ kind: "extra" })}>10 Karten extra</TextButton>
            </div>
          )}
        </>
      }
    />
  );
}
