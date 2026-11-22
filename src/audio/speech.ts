// Tonmodul ohne Browser-Abhängigkeit: reine Helfer und eine Fabrik, der ein
// `speechSynthesis`-ähnliches Objekt hineingereicht wird (docs/02-spezifikation.md, Abschnitt 3).
// Die Standardinstanz mit `window.speechSynthesis` steht in index.ts.

import { SPEECH } from "../core/config";

export interface SpeechProfile {
  name: string;
  voiceURI: string | null;
  rate: "normal" | "slow";
}

export interface SpeakOptions {
  slow?: boolean;
}

/** Der Teil von `speechSynthesis`, den das Modul braucht. */
export interface SynthLike {
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
  addEventListener?(type: "voiceschanged", listener: () => void): void;
  removeEventListener?(type: "voiceschanged", listener: () => void): void;
}

export interface Speech {
  setSpeechProfile(profile: Partial<SpeechProfile>): void;
  speak(text: string, options?: SpeakOptions): void;
  stopSpeaking(): void;
  getSpanishVoices(): SpeechSynthesisVoice[];
  hasSpanishVoice(): boolean;
  onVoicesChanged(listener: () => void): () => void;
  /** Ob der Hinweis „keine spanische Stimme“ noch gezeigt werden soll (einmal je Start). */
  isNoVoiceNoticeOpen(): boolean;
  dismissNoVoiceNotice(): void;
  onNoticeChanged(listener: () => void): () => void;
}

// ---------- reine Helfer ----------

const SPANISH = /^es(?:[-_]|$)/i;

function normalizeLang(lang: string): string {
  return lang.replace("_", "-").toLowerCase();
}

export function isSpanishVoice(voice: Pick<SpeechSynthesisVoice, "lang">): boolean {
  return SPANISH.test(voice.lang);
}

/** Rang einer Sprache: Platz in `SPEECH.languageOrder`, danach alle übrigen spanischen. */
function languageRank(lang: string): number {
  const normalized = normalizeLang(lang);
  const index = SPEECH.languageOrder.findIndex((entry) => normalizeLang(entry) === normalized);
  return index === -1 ? SPEECH.languageOrder.length : index;
}

/** Spanische Stimmen in der Reihenfolge es-ES, es-MX, es-US, sonstige. Innerhalb einer Gruppe bleibt die Reihenfolge des Geräts. */
export function sortSpanishVoices(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices
    .filter(isSpanishVoice)
    .map((voice, index) => ({ voice, index, rank: languageRank(voice.lang) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.voice);
}

/** Erst die gespeicherte Stimme (sofern spanisch und vorhanden), sonst die erste der sortierten Liste. `null` heißt: kein Ton. */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  savedVoiceURI: string | null,
): SpeechSynthesisVoice | null {
  const spanish = sortSpanishVoices(voices);
  if (savedVoiceURI) {
    const saved = spanish.find((voice) => voice.voiceURI === savedVoiceURI);
    if (saved) return saved;
  }
  return spanish[0] ?? null;
}

/** Entfernt „…“ (auch „...“), ersetzt `{name}` und räumt Leerzeichen auf. */
export function prepareSpeechText(text: string, name: string): string {
  return text
    .replaceAll("{name}", name.trim())
    .replaceAll("…", " ")
    .replaceAll("...", " ")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function rateFor(profile: SpeechProfile, options?: SpeakOptions): number {
  return options?.slow || profile.rate === "slow" ? SPEECH.rateSlow : SPEECH.rateNormal;
}

function sameVoices(a: readonly SpeechSynthesisVoice[], b: readonly SpeechSynthesisVoice[]): boolean {
  return a.length === b.length && a.every((voice, i) => voice.voiceURI === b[i]?.voiceURI && voice.lang === b[i]?.lang);
}

// ---------- Fabrik ----------

export interface CreateSpeechOptions {
  /** Erzeugt die Äußerung. Standard: `new SpeechSynthesisUtterance(text)`, falls vorhanden. */
  createUtterance?: (text: string) => SpeechSynthesisUtterance;
}

function defaultCreateUtterance(text: string): SpeechSynthesisUtterance {
  if (typeof SpeechSynthesisUtterance === "function") return new SpeechSynthesisUtterance(text);
  return { text } as SpeechSynthesisUtterance;
}

/** `synth` darf fehlen (Tests, alte Browser): dann tut jede Funktion nichts und es gibt keine Stimmen. */
export function createSpeech(synth: SynthLike | null | undefined, options: CreateSpeechOptions = {}): Speech {
  const createUtterance = options.createUtterance ?? defaultCreateUtterance;
  let profile: SpeechProfile = { name: "", voiceURI: null, rate: "normal" };
  let voicesCache: SpeechSynthesisVoice[] = [];
  let noticeDismissed = false;
  const voiceListeners = new Set<() => void>();
  const noticeListeners = new Set<() => void>();

  function readVoices(): SpeechSynthesisVoice[] {
    if (!synth) return [];
    try {
      return sortSpanishVoices(synth.getVoices());
    } catch {
      return [];
    }
  }

  /** Gibt dieselbe Liste zurück, solange sich nichts geändert hat (nötig für useSyncExternalStore). */
  function getSpanishVoices(): SpeechSynthesisVoice[] {
    const fresh = readVoices();
    if (!sameVoices(voicesCache, fresh)) voicesCache = fresh;
    return voicesCache;
  }

  function emitVoices() {
    getSpanishVoices();
    for (const listener of [...voiceListeners]) listener();
    for (const listener of [...noticeListeners]) listener();
  }

  if (synth?.addEventListener) synth.addEventListener("voiceschanged", emitVoices);

  return {
    setSpeechProfile(partial) {
      profile = { ...profile, ...partial };
    },

    speak(text, speakOptions) {
      if (!synth) return;
      const prepared = prepareSpeechText(text, profile.name);
      if (!prepared) return;
      const voice = pickVoice(synth.getVoices(), profile.voiceURI);
      if (!voice) return;
      synth.cancel();
      const utterance = createUtterance(prepared);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = rateFor(profile, speakOptions);
      synth.speak(utterance);
    },

    stopSpeaking() {
      synth?.cancel();
    },

    getSpanishVoices,

    hasSpanishVoice() {
      return getSpanishVoices().length > 0;
    },

    onVoicesChanged(listener) {
      voiceListeners.add(listener);
      return () => {
        voiceListeners.delete(listener);
      };
    },

    isNoVoiceNoticeOpen() {
      return !noticeDismissed && getSpanishVoices().length === 0;
    },

    dismissNoVoiceNotice() {
      if (noticeDismissed) return;
      noticeDismissed = true;
      for (const listener of [...noticeListeners]) listener();
    },

    onNoticeChanged(listener) {
      noticeListeners.add(listener);
      return () => {
        noticeListeners.delete(listener);
      };
    },
  };
}
