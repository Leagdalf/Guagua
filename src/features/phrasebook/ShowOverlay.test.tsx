import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { allPhrases } from "../../core/content";
import { hideOthers } from "./hideOthers";
import type { HideableElement } from "./hideOthers";
import { ShowOverlay } from "./ShowOverlay";

function decode(html: string): string {
  return html.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
}

describe("ShowOverlay", () => {
  const phrase = allPhrases.find((p) => p.es === "Necesito un médico.")!;
  const html = decode(renderToStaticMarkup(<ShowOverlay phrase={phrase} hasVoice onClose={() => {}} />));

  it("zeigt Satz mit lang=es, Übersetzung, „Langsam vorlesen“ und „Schließen“", () => {
    expect(html).toContain(`lang="es" class="es es--inherit pb-show__es">${phrase.es}</p>`);
    expect(html).toContain(phrase.de);
    expect(html).toContain("Langsam vorlesen");
    expect(html).toContain("Schließen");
  });

  it("ist ein Dialog, trägt die Größen für Telefon und iPad und enthält keinen Hauptknopf", () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/--show-fs-phone:\d+px/);
    expect(html).toMatch(/--show-fs-tablet:\d+px/);
    expect(html).not.toContain('class="btn');
  });

  it("ohne Stimme ist „Langsam vorlesen“ gesperrt, „Schließen“ nicht", () => {
    const quiet = decode(renderToStaticMarkup(<ShowOverlay phrase={phrase} hasVoice={false} onClose={() => {}} />));
    expect(quiet).toMatch(/<button[^>]*audio-btn[^>]*disabled/);
    expect(quiet).not.toMatch(/<button[^>]*pb-show__close[^>]*disabled/);
  });

  it("der Satz im Vollbild steht nirgends ohne lang=es", () => {
    expect(html.split(phrase.es).length - 1).toBe(1);
  });
});

describe("hideOthers", () => {
  function fake(): HideableElement & { attrs: Map<string, string> } {
    const attrs = new Map<string, string>();
    return {
      attrs,
      getAttribute: (n) => attrs.get(n) ?? null,
      setAttribute: (n, v) => void attrs.set(n, v),
      removeAttribute: (n) => void attrs.delete(n),
    };
  }

  it("verbirgt alles außer dem Vollbild und stellt den alten Stand wieder her", () => {
    const app = fake();
    const other = fake();
    other.setAttribute("aria-hidden", "false");
    const overlay = fake();
    const restore = hideOthers(overlay, [app, other, overlay]);
    expect(app.attrs.get("aria-hidden")).toBe("true");
    expect(app.attrs.has("inert")).toBe(true);
    expect(overlay.attrs.size).toBe(0);
    restore();
    expect(app.attrs.size).toBe(0);
    expect(other.attrs.get("aria-hidden")).toBe("false");
    expect(other.attrs.has("inert")).toBe(false);
  });
});
