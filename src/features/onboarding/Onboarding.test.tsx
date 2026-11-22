import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Onboarding, OnboardingSteps } from "./Onboarding";
import { LoadErrorView } from "./LoadErrorView";
import { isStandaloneMode } from "./standalone";
import { VOICE_TEST_TEXT } from "../more/VoiceTest";

const noop = () => {};
const base = { profile: null, onCreateProfile: () => true, onUpdateProfile: noop, onDone: noop } as const;

describe("Erster Start: Installationshinweis", () => {
  it("außerhalb des Home-Bildschirm-Modus kommt zuerst die Anleitung, mit Überspringen", () => {
    const html = renderToStaticMarkup(<Onboarding {...base} standalone={false} />);
    expect(html).toContain("Teilen-Symbol");
    expect(html).toContain("„Zum Home-Bildschirm“");
    expect(html).toContain("iPad");
    expect(html).toContain("iPhone");
    expect(html).toContain("Trotzdem im Browser weitermachen");
    expect(html).not.toContain("Dein Name");
  });

  it("im Home-Bildschirm-Modus gibt es keine Anleitung, es beginnt mit dem Namen", () => {
    const html = renderToStaticMarkup(<Onboarding {...base} standalone />);
    expect(html).not.toContain("Teilen-Symbol");
    expect(html).not.toContain("Trotzdem im Browser");
    expect(html).toContain("Wie heißt du?");
  });

  it("erkennt den Home-Bildschirm-Modus über navigator.standalone und display-mode", () => {
    expect(isStandaloneMode({})).toBe(false);
    expect(isStandaloneMode({ navigator: { standalone: false } })).toBe(false);
    expect(isStandaloneMode({ navigator: { standalone: true } })).toBe(true);
    expect(isStandaloneMode({ matchMedia: (q) => ({ matches: q === "(display-mode: standalone)" }) })).toBe(true);
    expect(isStandaloneMode({ matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(
      isStandaloneMode({
        matchMedia: () => {
          throw new Error("nicht da");
        },
      }),
    ).toBe(false);
  });
});

describe("Erster Start: Name", () => {
  const html = renderToStaticMarkup(<OnboardingSteps {...base} standalone voices={[]} />);

  it("Name ist Pflicht: Weiter ist gesperrt, solange das Feld leer ist", () => {
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
    expect(html).toContain("Höchstens 30 Zeichen");
  });

  it("das Feld ist ein Eingabefeld mit mindestens 16 Pixel (über den Baustein) und ohne Spanisch-Auszeichnung", () => {
    expect(html).toContain('class="field__input"');
    expect(html).not.toContain('lang="es"');
  });
});

describe("Erster Start: Stimme testen", () => {
  const profile = { name: "Ana", createdAt: "2026-11-23T10:00:00.000Z", voiceURI: null, rate: "normal" as const, calm: false };

  it("der Stimmentest spielt „Hola“ mit dem Namen: Wortlaut und Anzeige", () => {
    expect(VOICE_TEST_TEXT).toBe("Hola, {name}");
    const html = renderToStaticMarkup(
      <OnboardingSteps {...base} standalone profile={profile} initialStep="voice" voices={[{ voiceURI: "a", name: "Mónica", lang: "es-ES" }]} />,
    );
    expect(html).toContain('lang="es" class="es voice-test__hola">Hola, Ana</span>');
    expect(html).toContain("Weiter zur Linie");
    expect(html).not.toMatch(/<button[^>]*audio-btn[^>]*disabled/);
  });

  it("mehrere spanische Stimmen stehen zur Wahl", () => {
    const html = renderToStaticMarkup(
      <OnboardingSteps
        {...base}
        standalone
        profile={profile}
        initialStep="voice"
        voices={[
          { voiceURI: "a", name: "Mónica", lang: "es-ES" },
          { voiceURI: "b", name: "Paulina", lang: "es-MX" },
        ]}
      />,
    );
    expect(html).toContain("Mónica");
    expect(html).toContain("Paulina");
  });

  it("ohne Stimme: Hinweis mit dem Pfad, Knopf gesperrt, Weiter geht trotzdem", () => {
    const html = renderToStaticMarkup(<OnboardingSteps {...base} standalone profile={profile} initialStep="voice" voices={[]} />);
    expect(html).toContain("Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch");
    expect(html).toMatch(/<button[^>]*audio-btn[^>]*disabled/);
    expect(html).not.toMatch(/<button[^>]*class="btn"[^>]*disabled/);
  });
});

describe("Lernstand nicht lesbar", () => {
  it("sagt es und bietet „Neu beginnen“ an", () => {
    const html = renderToStaticMarkup(<LoadErrorView reason="invalid" onRestart={() => true} />);
    expect(html).toContain("Dein Lernstand ist nicht lesbar");
    expect(html).toContain("Neu beginnen");
    expect(html).not.toContain("Nichts wurde überschrieben");
  });

  it("jeder Grund hat einen eigenen Text", () => {
    const texts = (["unreadable", "foreign-schema", "invalid"] as const).map((reason) =>
      renderToStaticMarkup(<LoadErrorView reason={reason} onRestart={() => true} />),
    );
    expect(new Set(texts).size).toBe(3);
  });
});
