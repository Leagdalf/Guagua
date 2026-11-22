import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { updateProfile } from "../../core/progress";
import { createProgressStore } from "../../core/store";
import type { StorageLike } from "../../core/store";
import pkg from "../../../package.json";
import { newClock, newProgress, afterUnit1 } from "../home/testProgress";
import { AI_NOTE } from "./aboutModel";
import { MoreView } from "./MoreView";
import { VoiceTest } from "./VoiceTest";

const noop = () => {};

describe("MoreView (Server-Render)", () => {
  const clock = newClock();
  const html = renderToStaticMarkup(<MoreView progress={newProgress(clock, "Ana")} day={clock.current()} onUpdate={noop} />);

  it("zeigt Einstellungen: Name, Stimme mit Testknopf, Sprechtempo", () => {
    expect(html).toContain("Einstellungen");
    expect(html).toContain('value="Ana"');
    expect(html).toContain("Stimme testen");
    expect(html).toContain("Sprechtempo");
    expect(html).toContain("Normal");
    expect(html).toContain("Langsam");
  });

  it("zeigt Über die App: Version aus package.json, Stand der Inhalte, Punkte und Serie, Schriftlizenzen, KI-Satz wörtlich", () => {
    expect(html).toContain(pkg.version);
    expect(html).toContain("22.11.2026");
    expect(html).toContain("Punkte");
    expect(html).toContain("Serie");
    expect(html).toContain("Newsreader (SIL Open Font License 1.1)");
    expect(html).toContain("Figtree (SIL Open Font License 1.1)");
    expect(AI_NOTE).toBe("Code und Lerninhalte sind mit KI-Unterstützung entstanden. Fehler gefunden? Bitte melden, dann wird die Karte korrigiert.");
    expect(html).toContain(AI_NOTE);
  });

  it("lässt Späteres weg: Spickzettel, Ruhemodus, Export, Import, Lernzeit", () => {
    expect(html).not.toMatch(/Spickzettel|Ruhemodus|Export|Import|Lernzeit/);
  });

  it("zeigt Punkte und Serie nach einer Haltestelle", () => {
    const { clock: c, progress } = afterUnit1();
    const out = renderToStaticMarkup(<MoreView progress={progress} day={c.current()} onUpdate={noop} />);
    expect(out).toContain('Punkte</dt><dd class="summary__value">120</dd>');
    expect(out).toContain("1 Tag");
  });

  it("ohne Stimme: Knopf sichtbar und gesperrt, Hinweis mit dem Pfad aus docs/06", () => {
    expect(html).toMatch(/<button[^>]*audio-btn[^>]*disabled/);
    expect(html).toContain("iOS-Einstellungen, Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch");
  });

  it("spanischer Text trägt lang=es", () => {
    expect(html).toContain('lang="es" class="es voice-test__hola">Hola, Ana</span>');
  });
});

describe("Stimmentest", () => {
  const voices = [
    { voiceURI: "a", name: "Mónica", lang: "es-ES" },
    { voiceURI: "b", name: "Paulina", lang: "es-MX" },
  ];

  it("bei mehreren spanischen Stimmen stehen sie zur Wahl, die gespeicherte ist gewählt", () => {
    const html = renderToStaticMarkup(<VoiceTest voices={voices} voiceURI="b" name="Ana" onPick={noop} />);
    expect(html).toContain("Mónica");
    expect(html).toContain("Paulina");
    expect(html).toContain("Automatisch");
    expect(html).not.toMatch(/<button[^>]*audio-btn[^>]*disabled/);
    expect(html).not.toContain("keine spanische Stimme da");
    const pressed = [...html.matchAll(/aria-pressed="(true|false)"/g)].map((m) => m[1]);
    expect(pressed).toEqual(["false", "false", "true"]);
  });

  it("bei einer Stimme keine Auswahl, der Knopf geht", () => {
    const html = renderToStaticMarkup(<VoiceTest voices={voices.slice(0, 1)} voiceURI={null} name="Ana" onPick={noop} />);
    expect(html).not.toContain("choice__row");
    expect(html).not.toMatch(/<button[^>]*audio-btn[^>]*disabled/);
  });

  it("ohne Stimme erklärt ein Hinweis, wie man sie lädt, und die App läuft ohne Ton weiter", () => {
    const html = renderToStaticMarkup(<VoiceTest voices={[]} voiceURI={null} name="Ana" onPick={noop} />);
    expect(html).toContain("Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch");
    expect(html).toContain("läuft die App ohne Ton");
    expect(html).toMatch(/<button[^>]*audio-btn[^>]*disabled/);
  });
});

describe("Einstellungen bleiben dauerhaft", () => {
  it("Name, Stimme und Tempo überstehen ein Neuladen", () => {
    const clock = newClock();
    const data = new Map<string, string>();
    const storage: StorageLike = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
    const store = createProgressStore({ storage, now: clock.now });
    expect(store.createProfile("Ana")).toBe(true);
    store.update((p) => updateProfile(p, { name: "Anna" }));
    store.update((p) => updateProfile(p, { voiceURI: "b" }));
    store.update((p) => updateProfile(p, { rate: "slow" }));
    const state = createProgressStore({ storage, now: clock.now }).getSnapshot();
    expect(state.status).toBe("ready");
    if (state.status === "ready") expect(state.progress.profile).toMatchObject({ name: "Anna", voiceURI: "b", rate: "slow" });
  });

  it("ein ungültiger Name ändert nichts", () => {
    const p = newProgress(newClock(), "Ana");
    expect(updateProfile(p, { name: "   " }).profile.name).toBe("Ana");
    expect(updateProfile(p, { name: "x".repeat(31) }).profile.name).toBe("Ana");
  });
});
