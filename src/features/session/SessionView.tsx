import { useEffect, useRef, useState } from "react";
import { appClock, newRng, progressStore, useStoreState, useToday } from "../../app/index";
import { NoVoiceNotice, speak, useVoices } from "../../audio";
import type { Rng } from "../../core/random";
import type { Progress } from "../../core/types";
import { startUnit } from "../../core/units";
import { ActionBar, LessonPage, PrimaryButton } from "../../ui";
import { createSession, reduce, withBackground } from "./machine";
import type { SessionContext, SessionEvent, SessionState } from "./machine";
import { SessionScreen } from "./SessionScreen";
import type { SessionViewProps } from "./types";

/**
 * Lerneinheit (docs/02-spezifikation.md, 2.3 und 2.4). Dünn: Der Ablauf steht in `machine.ts`, das Aussehen in
 * `SessionScreen.tsx`. Hier laufen Speicher, Uhr und Ton zusammen. Der Stand ist nach jeder Antwort und jedem Schritt
 * gespeichert, „Schließen“ und „Zur Linie“ rufen nur `onExit`.
 */
export function SessionView({ request, onExit }: SessionViewProps) {
  const store = useStoreState();
  if (store.status !== "ready") {
    return (
      <LessonPage footer={<ActionBar><PrimaryButton onClick={onExit}>Zur Linie</PrimaryButton></ActionBar>}>
        <p>Dein Fortschritt ist gerade nicht lesbar. Die Lerneinheit startet erst, wenn er wieder da ist.</p>
      </LessonPage>
    );
  }
  return <RunningSession request={request} onExit={onExit} initial={store.progress} />;
}

function RunningSession({ request, onExit, initial }: SessionViewProps & { initial: Progress }) {
  const store = useStoreState();
  const progress = store.status === "ready" ? store.progress : initial;
  const { hasVoice } = useVoices();
  const day = useToday();

  const rngRef = useRef<Rng | null>(null);
  if (rngRef.current === null) rngRef.current = newRng();
  const makeContext = (): SessionContext => ({ now: appClock, rng: rngRef.current ?? newRng(), hasSpanishVoice: hasVoice });

  const [state, setState] = useState<SessionState>(() => createSession(initial, request, makeContext()).state);
  const stateRef = useRef<SessionState>(state);

  // Eine begonnene Haltestelle gilt auf der Linie als „läuft“, auch wenn die erste Antwort noch fehlt.
  const unitId = request.kind === "day" ? request.unitId : null;
  useEffect(() => {
    if (unitId !== null) progressStore.update((p) => startUnit(p, unitId, appClock));
  }, [unitId]);

  // Im Hintergrund pausiert die Lernzeit (Spezifikation 5.4).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      stateRef.current = withBackground(stateRef.current);
      setState(stateRef.current);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Jedes Tippen: Maschine rechnen, speichern, anzeigen und den Ton im selben Tippen sprechen (iOS).
  const handleEvent = (event: SessionEvent) => {
    const snapshot = progressStore.getSnapshot();
    if (snapshot.status !== "ready") return;
    const result = reduce(stateRef.current, event, snapshot.progress, makeContext());
    stateRef.current = result.state;
    progressStore.update(() => result.progress);
    setState(result.state);
    if (result.speak) speak(result.speak.text, { slow: result.speak.slow === true });
  };

  const handleSpeak = (text: string, slow?: boolean) => {
    speak(text, { slow: slow === true });
  };

  return (
    <>
      <NoVoiceNotice />
      <SessionScreen
        state={state}
        progress={progress}
        day={day}
        hasVoice={hasVoice}
        onEvent={handleEvent}
        onSpeak={handleSpeak}
        onClose={onExit}
        onExit={onExit}
      />
    </>
  );
}
