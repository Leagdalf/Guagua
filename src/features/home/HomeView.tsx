import { useState } from "react";
import { units } from "../../core/content";
import type { Day, Progress } from "../../core/types";
import { dayCounter, todayPlan } from "../../core/units";
import { ActionBar, HomeHeader, HomePage, Line, MissionRow, PrimaryButton, TextButton } from "../../ui";
import type { SessionRequest } from "../session/types";
import { formatDateDe } from "./dateText";
import { FINAL_STOP_ID, lineModel } from "./lineModel";
import { StopOverview } from "./StopOverview";
import { todayBlock } from "./todayBlock";
import type { BlockAction } from "./todayBlock";
import { TodayView } from "./TodayView";
import "./home.css";

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
  const block = todayBlock(plan);
  const line = lineModel(progress);
  const mission = plan.openMissionId ? units.find((unit) => unit.mission.id === plan.openMissionId)?.mission : undefined;
  const hasCards = Object.keys(progress.cards).length > 0;

  const run = (action: BlockAction): void => {
    if (action.type === "session") onStartSession(action.request);
    else if (action.type === "extra") onStartSession({ kind: "extra" });
    else onOpenMissions(null);
  };

  return (
    <HomePage
      header={<HomeHeader date={formatDateDe(day)} progress={`Tag ${dayCounter(progress, day)}`} stops={line.mountain} />}
      today={<TodayView block={block} />}
      action={
        <ActionBar aboveTabs>
          <PrimaryButton onClick={() => run(block.action)}>{block.button}</PrimaryButton>
        </ActionBar>
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
              if (id === FINAL_STOP_ID) return;
              setOverview(id);
              toTop();
            }}
          />
          {line.finalNote && <p className="home__note">{line.finalNote}</p>}
          {hasCards && block.action.type !== "extra" && (
            <div className="home__extra">
              <TextButton onClick={() => onStartSession({ kind: "extra" })}>10 Karten extra</TextButton>
            </div>
          )}
        </>
      }
    />
  );
}
