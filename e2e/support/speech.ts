// Attrappe für `speechSynthesis`, vor dem Laden der Seite eingesetzt (`addInitScript`).
// Sie zeichnet jede Äußerung auf und merkt sich, ob `speak` direkt in einer Klick-Behandlung aufgerufen wurde.

import type { Page } from "@playwright/test";

export interface FakeVoice {
  voiceURI: string;
  name: string;
  lang: string;
}

export interface Utterance {
  text: string;
  lang: string;
  rate: number;
  voice: string | null;
  /** `speak` lief während der Behandlung eines Klicks (oder Tastendrucks), nicht später aus einem Zeitgeber. */
  inGesture: boolean;
}

export const SPANISH_VOICES: FakeVoice[] = [{ voiceURI: "fake-es-ES", name: "Monica (Test)", lang: "es-ES" }];
export const TWO_VOICES: FakeVoice[] = [
  { voiceURI: "fake-es-MX", name: "Paulina (Test)", lang: "es-MX" },
  { voiceURI: "fake-es-ES", name: "Monica (Test)", lang: "es-ES" },
];

export async function installSpeech(page: Page, voices: FakeVoice[]): Promise<void> {
  await page.addInitScript((list: FakeVoice[]) => {
    const w = window as unknown as Record<string, unknown>;
    const spoken: unknown[] = [];
    let gesture = false;
    // Capture setzt, Bubble am Fenster (nach React am Wurzelelement) nimmt zurück.
    for (const type of ["click", "keydown", "pointerup"]) {
      window.addEventListener(type, () => (gesture = true), true);
      window.addEventListener(type, () => (gesture = false), false);
    }
    const voiceObjects = list.map((v) => ({ ...v, localService: true, default: false }));
    class FakeUtterance {
      text: string;
      voice: unknown = null;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      constructor(text: string) {
        this.text = text;
      }
    }
    const listeners: Record<string, Array<() => void>> = {};
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => voiceObjects.slice(),
      speak(u: FakeUtterance) {
        spoken.push({
          text: u.text,
          lang: u.lang,
          rate: u.rate,
          voice: u.voice ? (u.voice as { voiceURI: string }).voiceURI : null,
          inGesture: gesture,
        });
      },
      cancel() {},
      pause() {},
      resume() {},
      addEventListener(type: string, listener: () => void) {
        (listeners[type] ??= []).push(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        listeners[type] = (listeners[type] ?? []).filter((l) => l !== listener);
      },
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: FakeUtterance, configurable: true, writable: true });
    w.__spoken = spoken;
  }, voices);
}

export async function spoken(page: Page): Promise<Utterance[]> {
  return page.evaluate(() => ((window as unknown as { __spoken?: Utterance[] }).__spoken ?? []).slice());
}

export async function clearSpoken(page: Page): Promise<void> {
  await page.evaluate(() => {
    const list = (window as unknown as { __spoken?: unknown[] }).__spoken;
    if (list) list.length = 0;
  });
}
