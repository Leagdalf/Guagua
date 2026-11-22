import { createSpeech } from "./speech";
import type { Speech, SynthLike } from "./speech";

let instance: Speech | null = null;

/** Standardinstanz, beim ersten Gebrauch angelegt. Ohne `window.speechSynthesis` tut sie nichts. */
export function getSpeech(): Speech {
  if (!instance) {
    const synth: SynthLike | null =
      typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
    instance = createSpeech(synth);
  }
  return instance;
}
