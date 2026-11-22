import { useEffect, useRef, useState } from "react";
import { appClock, newRng, progressStore, useStoreState, useToday } from "../../state";
import { NoVoiceNotice, speak, useVoices } from "../../audio";
import type { Rng } from "../../core/random";
import type { Progress } from "../../core/types";
import { ActionBar, LessonPage, PrimaryButton } from "../../ui";
import { withBackground } from "./machine";
import type { SessionContext, SessionEvent, SessionState } from "./machine";
import { SaveFailedNotice } from "./SaveFailedNotice";
import { sendEvent, startSession } from "./sessionDriver";
import { SessionScreen } from "./SessionScreen";
import type { SessionViewProps } from "./types";

/**
 * Lerneinheit (docs/02-spezifikation.md, 2.3 und 2.4). Dünn: Der Ablauf steht in `machine.ts`, das Aussehen in
 * `SessionScreen.tsx`, der Weg in den Speicher in `sessionDriver.ts`. Hier laufen Speicher, Uhr und Ton zusammen.
 * Der Stand ist nach jeder Antwort und jedem Schritt gespeichert, „Schließen“ und „Zur Linie“ rufen nur `onExit`.
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
  const saveFailed = store.status === "ready" && store.saveFailed;
  const { hasVoice } = useVoices();
  const day = useToday();

  const rngRef = useRef<Rng | null>(null);
  if (rngRef.current === null) rngRef.current = newRng();
  const makeContext = (): SessionContext => ({ now: appClock, rng: rngRef.current ?? newRng(), hasSpanishVoice: hasVoice });

  // Die Sitzung beginnt mit dem Fahrplan. Was das Anlegen am Fortschritt ändert, speichert `commit` nach dem ersten Zeichnen.
  const [started] = useState(() => startSession(progressStore, initial, request, makeContext()));
  const [state, setState] = useState<SessionState>(started.state);
  const stateRef = useRef<SessionState>(state);
  useEffect(() => {
    started.commit();
  }, [started]);

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
    const sent = sendEvent(progressStore, stateRef.current, event, makeContext());
    if (!sent) return;
    stateRef.current = sent.state;
    setState(sent.state);
    if (sent.speak) speak(sent.speak.text, { slow: sent.speak.slow === true });
  };

  const handleSpeak = (text: string, slow?: boolean) => {
    speak(text, { slow: slow === true });
  };

  return (
    <>
      <NoVoiceNotice />
      <SaveFailedNotice saveFailed={saveFailed} />
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