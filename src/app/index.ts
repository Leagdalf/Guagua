// Verbindung zwischen Lernlogik (src/core), Browser-Speicher, Ton (src/audio) und den Ansichten.
// Diese Datei gehört der Hauptsitzung. Ansichten importieren von hier:
//
//   progressStore   der eine Speicher der App (localStorage unter `guagua:v1`)
//   useStoreState   React-Hook: Zustand des Speichers (empty, ready, error)
//   useToday        React-Hook: heutiger Kalendertag, wechselt um Mitternacht und beim Zurückkehren in die App
//   appClock        Uhr der App, immer diese an die Funktionen aus src/core reichen
//   newRng          frischer Zufall für eine Runde
//
// Der Speicher hält Ton und Ruhemodus selbst aktuell: Nach jeder Änderung des Profils gehen Name, Stimme und Tempo
// an das Tonmodul, und der Ruhemodus schaltet die Animationen ab. Ansichten müssen dafür nichts tun.

import { useEffect, useState, useSyncExternalStore } from "react";
import { setSpeechProfile } from "../audio";
import { createRng } from "../core/random";
import type { Rng } from "../core/random";
import { createProgressStore } from "../core/store";
import type { ProgressStore, StorageLike, StoreState } from "../core/store";
import { today } from "../core/time";
import type { Clock } from "../core/time";
import type { Day } from "../core/types";
import { applyCalm } from "../ui";
import { createClock, readDayOffset } from "./clock";

export { createClock, readDayOffset } from "./clock";

const inBrowser = typeof window !== "undefined";

/** Greift erst beim Aufruf auf localStorage zu. Ist es gesperrt, wirft der Zugriff und der Speicher meldet den Fehler. */
const browserStorage: StorageLike = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};

export const appClock: Clock = createClock(inBrowser ? readDayOffset(window.location.search) : 0);

export const progressStore: ProgressStore = createProgressStore({ storage: browserStorage, now: appClock });

/** Frischer, mit der Uhrzeit gestarteter Zufall. Je Runde einmal holen und weiterreichen. */
export function newRng(): Rng {
  return createRng(Date.now());
}

function syncProfile(state: StoreState): void {
  if (state.status !== "ready") return;
  const { name, voiceURI, rate, calm } = state.progress.profile;
  setSpeechProfile({ name, voiceURI, rate });
  if (inBrowser) applyCalm(calm);
}

syncProfile(progressStore.getSnapshot());
progressStore.subscribe(() => syncProfile(progressStore.getSnapshot()));

export function useStoreState(): StoreState {
  return useSyncExternalStore(progressStore.subscribe, progressStore.getSnapshot, progressStore.getSnapshot);
}

/** Heutiger Kalendertag nach der Uhr der App. Prüft jede Minute und beim Zurückkehren in die App, ob der Tag gewechselt hat. */
export function useToday(): Day {
  const [day, setDay] = useState<Day>(() => today(appClock));

  useEffect(() => {
    const check = () => setDay(today(appClock));
    const timer = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  return day;
}
