import { useSyncExternalStore } from "react";
import { getSpeech } from "./instance";

const NO_VOICES: SpeechSynthesisVoice[] = [];

function subscribe(listener: () => void): () => void {
  return getSpeech().onVoicesChanged(listener);
}

function getSnapshot(): SpeechSynthesisVoice[] {
  return getSpeech().getSpanishVoices();
}

function getServerSnapshot(): SpeechSynthesisVoice[] {
  return NO_VOICES;
}

/** Spanische Stimmen für Einstellungen und Tonknöpfe. Aktualisiert sich mit „voiceschanged“. */
export function useVoices(): { voices: SpeechSynthesisVoice[]; hasVoice: boolean } {
  const voices = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { voices, hasVoice: voices.length > 0 };
}
