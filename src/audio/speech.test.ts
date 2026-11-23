import { describe, expect, it, vi } from "vitest";
import { SPEECH } from "../core/config";
import { createSpeech, hasGoodSpanishVoice, pickVoice, prepareSpeechText, sortSpanishVoices } from "./speech";
import type { SynthLike } from "./speech";

function voice(name: string, lang: string, voiceURI = name): SpeechSynthesisVoice {
  return { name, lang, voiceURI, default: false, localService: true } as SpeechSynthesisVoice;
}

interface Spoken {
  text: string;
  voice: SpeechSynthesisVoice | null;
  lang: string;
  rate: number;
}

function fakeSynth(initial: SpeechSynthesisVoice[]) {
  let voices = initial;
  const spoken: Spoken[] = [];
  const calls: string[] = [];
  const listeners = new Set<() => void>();
  const synth: SynthLike = {
    speak: (u) => {
      calls.push("speak");
      spoken.push({ text: u.text, voice: u.voice, lang: u.lang, rate: u.rate });
    },
    cancel: () => {
      calls.push("cancel");
    },
    getVoices: () => voices,
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
  return {
    synth,
    spoken,
    calls,
    setVoices(next: SpeechSynthesisVoice[]) {
      voices = next;
      for (const listener of listeners) listener();
    },
  };
}

const makeUtterance = (text: string) => ({ text, voice: null, lang: "", rate: 1 }) as unknown as SpeechSynthesisUtterance;

const en = voice("Samantha", "en-US");
const us = voice("Paulina US", "es-US");
const mx = voice("Paulina", "es-MX");
const es = voice("Monica", "es-ES");
const ar = voice("Diego", "es-AR");

describe("Stimmenwahl", () => {
  it("sortiert es-ES, es-MX, es-US, sonstige und lässt andere Sprachen weg", () => {
    expect(sortSpanishVoices([en, ar, us, mx, es]).map((v) => v.lang)).toEqual(["es-ES", "es-MX", "es-US", "es-AR"]);
  });

  it("erkennt Unterstrich-Schreibweise und Sprache ohne Region", () => {
    const underscore = voice("A", "es_ES");
    const bare = voice("B", "es");
    expect(sortSpanishVoices([bare, underscore]).map((v) => v.name)).toEqual(["A", "B"]);
    expect(sortSpanishVoices([voice("Est", "et-EE"), voice("C", "ca-ES")])).toEqual([]);
  });

  it("nimmt zuerst die gespeicherte Stimme", () => {
    expect(pickVoice([es, mx, us], "Paulina US")).toBe(us);
  });

  it("nimmt ohne gespeicherte Stimme die Reihenfolge es-ES, es-MX, es-US, sonstige", () => {
    expect(pickVoice([ar, us, mx, es], null)).toBe(es);
    expect(pickVoice([ar, us, mx], null)).toBe(mx);
    expect(pickVoice([ar, us], null)).toBe(us);
    expect(pickVoice([ar, en], null)).toBe(ar);
  });

  it("fällt zurück, wenn die gespeicherte Stimme fehlt oder nicht spanisch ist", () => {
    expect(pickVoice([mx, us], "gibt-es-nicht")).toBe(mx);
    expect(pickVoice([en, us], "Samantha")).toBe(us);
  });

  it("liefert bei leerer Liste null", () => {
    expect(pickVoice([], null)).toBeNull();
    expect(pickVoice([en], "Samantha")).toBeNull();
  });

  // So meldet Safari auf dem iPad die Stimmen: Spaßstimmen stehen alphabetisch vor Mónica.
  const eddy = voice("Eddy (Spanisch (Spanien))", "es-ES", "com.apple.eloquence.es-ES.Eddy");
  const grandma = voice("Oma (Spanisch (Spanien))", "es-ES", "com.apple.eloquence.es-ES.Grandma");
  const monica = voice("Mónica", "es-ES", "com.apple.voice.compact.es-ES.Monica");
  const monicaPlus = voice("Mónica (erweitert)", "es-ES", "com.apple.voice.enhanced.es-ES.Monica");
  const marisol = voice("Marisol (Premium)", "es-ES", "com.apple.voice.premium.es-ES.Marisol");
  const paulinaPlus = voice("Paulina (Enhanced)", "es-MX", "com.apple.voice.enhanced.es-MX.Paulina");

  it("lässt Spaßstimmen weg, solange es eine andere spanische Stimme gibt", () => {
    expect(sortSpanishVoices([eddy, grandma, monica])).toEqual([monica]);
    expect(pickVoice([eddy, grandma, monica], null)).toBe(monica);
    expect(sortSpanishVoices([eddy, grandma])).toEqual([eddy, grandma]);
  });

  it("nimmt eine gespeicherte Spaßstimme nicht mehr, wenn es eine bessere gibt", () => {
    expect(pickVoice([eddy, monica], eddy.voiceURI)).toBe(monica);
  });

  it("nimmt innerhalb einer Sprache Premium vor erweitert vor einfach", () => {
    expect(sortSpanishVoices([eddy, monica, monicaPlus, marisol])).toEqual([marisol, monicaPlus, monica]);
    expect(pickVoice([monica, monicaPlus], null)).toBe(monicaPlus);
  });

  it("bleibt bei es-ES vor es-MX, auch wenn die mexikanische Stimme besser ist", () => {
    expect(pickVoice([paulinaPlus, monica], null)).toBe(monica);
  });

  it("erkennt, ob eine erweiterte oder Premium-Stimme geladen ist", () => {
    expect(hasGoodSpanishVoice([monica])).toBe(false);
    expect(hasGoodSpanishVoice([monica, monicaPlus])).toBe(true);
    expect(hasGoodSpanishVoice([marisol])).toBe(true);
  });
});

describe("Textaufbereitung", () => {
  it("entfernt Auslassungspunkte", () => {
    expect(prepareSpeechText("me llamo …", "Anna")).toBe("me llamo");
    expect(prepareSpeechText("Un café … y un agua", "Anna")).toBe("Un café y un agua");
    expect(prepareSpeechText("me llamo...", "Anna")).toBe("me llamo");
  });

  it("liest Klammern nicht mit", () => {
    expect(prepareSpeechText("(yo) soy", "Anna")).toBe("yo soy");
    expect(prepareSpeechText("(él, ella, usted) es", "Anna")).toBe("él, ella, usted es");
  });

  it("ersetzt {name}", () => {
    expect(prepareSpeechText("Me llamo {name}.", "Anna")).toBe("Me llamo Anna.");
    expect(prepareSpeechText("Hola, {name}. {name}!", " Anna ")).toBe("Hola, Anna. Anna!");
  });

  it("bleibt sprechbar, wenn der Name fehlt", () => {
    expect(prepareSpeechText("Hola, {name}.", "")).toBe("Hola.");
  });
});

describe("createSpeech", () => {
  it("spricht mit der gespeicherten Stimme, ersetzt Platzhalter und bricht vorher ab", () => {
    const f = fakeSynth([en, es, us]);
    const speech = createSpeech(f.synth, { createUtterance: makeUtterance });
    speech.setSpeechProfile({ name: "Anna", voiceURI: "Paulina US" });
    speech.speak("Hola, {name} …");
    expect(f.calls).toEqual(["cancel", "speak"]);
    expect(f.spoken).toEqual([{ text: "Hola, Anna", voice: us, lang: "es-US", rate: SPEECH.rateNormal }]);
  });

  it("nimmt ohne gespeicherte Stimme es-ES", () => {
    const f = fakeSynth([us, mx, es]);
    const speech = createSpeech(f.synth, { createUtterance: makeUtterance });
    speech.speak("Hola");
    expect(f.spoken[0]?.voice).toBe(es);
  });

  it("wählt das Tempo: normal, Profil langsam, Option langsam", () => {
    const f = fakeSynth([es]);
    const speech = createSpeech(f.synth, { createUtterance: makeUtterance });
    speech.speak("Uno");
    speech.speak("Dos", { slow: true });
    speech.setSpeechProfile({ rate: "slow" });
    speech.speak("Tres");
    speech.speak("Cuatro", { slow: false });
    expect(f.spoken.map((s) => s.rate)).toEqual([
      SPEECH.rateNormal,
      SPEECH.rateSlow,
      SPEECH.rateSlow,
      SPEECH.rateSlow,
    ]);
  });

  it("leere Liste: kein Ton, kein Absturz, keine Ausgabe", () => {
    const f = fakeSynth([en]);
    const speech = createSpeech(f.synth, { createUtterance: makeUtterance });
    expect(speech.hasSpanishVoice()).toBe(false);
    expect(speech.getSpanishVoices()).toEqual([]);
    expect(speech.isNoVoiceNoticeOpen()).toBe(true);
    speech.speak("Hola");
    expect(f.spoken).toEqual([]);
  });

  it("spricht nichts, wenn nach der Aufbereitung kein Text bleibt", () => {
    const f = fakeSynth([es]);
    const speech = createSpeech(f.synth, { createUtterance: makeUtterance });
    speech.speak(" … ");
    expect(f.calls).toEqual([]);
  });

  it("ohne speechSynthesis stürzt nichts ab", () => {
    const speech = createSpeech(null);
    expect(() => {
      speech.setSpeechProfile({ name: "Anna" });
      speech.speak("Hola");
      speech.stopSpeaking();
    }).not.toThrow();
    expect(speech.hasSpanishVoice()).toBe(false);
    expect(speech.getSpanishVoices()).toEqual([]);
    const off = speech.onVoicesChanged(() => {});
    expect(() => off()).not.toThrow();
  });

  it("die Liste kommt erst mit voiceschanged: Hörer werden gerufen, Liste bleibt stabil", () => {
    const f = fakeSynth([]);
    const speech = createSpeech(f.synth, { createUtterance: makeUtterance });
    const listener = vi.fn();
    const off = speech.onVoicesChanged(listener);
    const before = speech.getSpanishVoices();
    expect(speech.getSpanishVoices()).toBe(before);
    expect(speech.hasSpanishVoice()).toBe(false);

    f.setVoices([us, es]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(speech.hasSpanishVoice()).toBe(true);
    expect(speech.getSpanishVoices().map((v) => v.lang)).toEqual(["es-ES", "es-US"]);
    expect(speech.getSpanishVoices()).toBe(speech.getSpanishVoices());
    expect(speech.isNoVoiceNoticeOpen()).toBe(false);

    off();
    f.setVoices([es]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("der Hinweis lässt sich schließen und kommt nicht wieder", () => {
    const f = fakeSynth([]);
    const speech = createSpeech(f.synth, { createUtterance: makeUtterance });
    const listener = vi.fn();
    speech.onNoticeChanged(listener);
    expect(speech.isNoVoiceNoticeOpen()).toBe(true);
    speech.dismissNoVoiceNotice();
    speech.dismissNoVoiceNotice();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(speech.isNoVoiceNoticeOpen()).toBe(false);
  });

  it("stopSpeaking bricht ab", () => {
    const f = fakeSynth([es]);
    const speech = createSpeech(f.synth, { createUtterance: makeUtterance });
    speech.stopSpeaking();
    expect(f.calls).toEqual(["cancel"]);
  });
});
