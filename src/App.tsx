import { useState } from "react";
import { appClock, progressStore, useStoreState, useToday } from "./app/index";
import { NoVoiceNotice } from "./audio";
import { completeMission, skipMission } from "./core/units";
import { updateProfile } from "./core/progress";
import type { ProfilePatch } from "./core/progress";
import type { Progress } from "./core/types";
import { HomeView } from "./features/home";
import { MissionsView } from "./features/missions";
import { MoreView } from "./features/more";
import { LoadErrorView, Onboarding, detectStandalone } from "./features/onboarding";
import { PhrasebookView } from "./features/phrasebook/PhrasebookView";
import { SessionView } from "./features/session";
import type { SessionRequest } from "./features/session";
import { AppShell, Notice, TabBar } from "./ui";

type Tab = "line" | "missions" | "phrasebook" | "more";

const TABS: readonly string[] = ["line", "missions", "phrasebook", "more"];

function toTop(): void {
  window.scrollTo(0, 0);
}

/**
 * Wurzel der App, ohne Router. Zustand des Speichers: leer = erster Start, Fehler = Lernstand nicht lesbar,
 * bereit = Leiste mit Linie, Missionen, Sprachführer und Mehr. Die Lerneinheit läuft im Vollbild ohne Leiste.
 */
export function App() {
  const state = useStoreState();
  const day = useToday();
  const [tab, setTab] = useState<Tab>("line");
  const [session, setSession] = useState<SessionRequest | null>(null);
  const [missionFocus, setMissionFocus] = useState<string | null>(null);
  // Nach dem Anlegen des Profils ist der Speicher „bereit“, der Stimmentest läuft aber noch im ersten Start.
  const [onboarding, setOnboarding] = useState(false);
  const [standalone] = useState(detectStandalone);

  if (state.status === "error") {
    return (
      <AppShell>
        <LoadErrorView reason={state.reason} onRestart={() => progressStore.restart()} />
      </AppShell>
    );
  }

  if (state.status === "empty" || onboarding) {
    return (
      <AppShell>
        <Onboarding
          standalone={standalone}
          profile={state.status === "ready" ? state.progress.profile : null}
          onCreateProfile={(name) => {
            setOnboarding(true);
            const ok = progressStore.createProfile(name);
            if (!ok) setOnboarding(false);
            return ok;
          }}
          onUpdateProfile={(patch: ProfilePatch) => progressStore.update((p) => updateProfile(p, patch))}
          onDone={() => {
            setOnboarding(false);
            toTop();
          }}
        />
      </AppShell>
    );
  }

  const { progress } = state;
  const update = (fn: (p: Progress) => Progress): void => progressStore.update(fn);

  if (session) {
    return (
      <AppShell>
        <SessionView
          request={session}
          onExit={() => {
            setSession(null);
            toTop();
          }}
        />
      </AppShell>
    );
  }

  const select = (id: string): void => {
    if (!TABS.includes(id)) return;
    setTab(id as Tab);
    setMissionFocus(null);
    toTop();
  };

  // Der Sprachführer zeigt den Hinweis „keine spanische Stimme“ selbst; hier nicht doppelt.
  const notice = (
    <>
      {tab !== "phrasebook" && <NoVoiceNotice />}
      {state.saveFailed && (
        <Notice text="Dein Lernstand lässt sich auf diesem Gerät nicht speichern. Er geht verloren, wenn du die App schließt." />
      )}
    </>
  );

  return (
    <AppShell notice={notice} tabs={<TabBar active={tab} onSelect={select} />}>
      {tab === "line" && (
        <HomeView
          progress={progress}
          day={day}
          onStartSession={(request) => {
            setSession(request);
            toTop();
          }}
          onOpenMissions={(missionId) => {
            setMissionFocus(missionId);
            setTab("missions");
            toTop();
          }}
        />
      )}
      {tab === "missions" && (
        <MissionsView
          progress={progress}
          focusMissionId={missionFocus}
          onComplete={(missionId, result) => update((p) => completeMission(p, missionId, appClock, result))}
          onSkip={(missionId) => update((p) => skipMission(p, missionId, appClock))}
        />
      )}
      {tab === "phrasebook" && <PhrasebookView />}
      {tab === "more" && <MoreView progress={progress} day={day} onUpdate={update} />}
    </AppShell>
  );
}
