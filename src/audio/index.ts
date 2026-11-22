// Öffentliche Schnittstelle des Tonmoduls. AP4 und AP5 benutzen nur diese Datei.
// `speak` darf ausschließlich direkt aus einer Klick-Behandlung aufgerufen werden (iOS).

import { getSpeech } from "./instance";
import type { SpeakOptions, SpeechProfile } from "./speech";

export type { SpeechProfile } from "./speech";
export { createSpeech, pickVoice, prepareSpeechText, sortSpanishVoices } from "./speech";
export { getSpeech } from "./instance";
export { NoVoiceNotice } from "./NoVoiceNotice";
export { useVoices } from "./useVoices";

/** Name, gespeicherte Stimme und Tempo aus den Einstellungen. */
export function setSpeechProfile(profile: Partial<SpeechProfile>): void {
  getSpeech().setSpeechProfile(profile);
}

/** Bricht laufende Ausgabe ab, entfernt „…“, ersetzt {name}. Nur aus Klick-Behandlungen aufrufen. */
export function speak(text: string, options?: SpeakOptions): void {
  getSpeech().speak(text, options);
}

export function stopSpeaking(): void {
  getSpeech().stopSpeaking();
}

/** Spanische Stimmen in der Reihenfolge es-ES, es-MX, es-US, sonstige. */
export function getSpanishVoices(): SpeechSynthesisVoice[] {
  return getSpeech().getSpanishVoices();
}

export function hasSpanishVoice(): boolean {
  return getSpeech().hasSpanishVoice();
}

/** Die Liste kann erst mit „voiceschanged“ kommen. Gibt die Abmeldung zurück. */
export function onVoicesChanged(listener: () => void): () => void {
  return getSpeech().onVoicesChanged(listener);
}
