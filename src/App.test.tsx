import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import appSource from "./App.tsx?raw";
import { App, SAVE_FAILED_TEXT, SaveFailedNotice } from "./App";

describe("App (Server-Render, kein localStorage)", () => {
  // Ohne `window` ist der Speicher nicht lesbar: die App zeigt die Fehleransicht mit „Neu beginnen“.
  const html = renderToStaticMarkup(<App />);

  it("zeigt bei nicht lesbarem Speicher die Fehleransicht", () => {
    expect(html).toContain("Dein Lernstand ist nicht lesbar");
    expect(html).toContain("Neu beginnen");
  });

  it("hat genau ein main und genau eine h1", () => {
    expect(html.match(/<main[ >]/g)).toHaveLength(1);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it("zeigt in der Fehleransicht keine untere Leiste", () => {
    expect(html).not.toContain('aria-label="Bereiche"');
  });
});

describe("Hinweis bei gescheitertem Speichern", () => {
  it("steht in einer Notice, wenn das Speichern gescheitert ist, sonst fehlt er", () => {
    const shown = renderToStaticMarkup(<SaveFailedNotice saveFailed />);
    expect(shown).toContain(SAVE_FAILED_TEXT);
    expect(shown).toContain("nicht speichern");
    expect(renderToStaticMarkup(<SaveFailedNotice saveFailed={false} />)).toBe("");
  });

  it("der erste Start reicht den Hinweis an den Rahmen weiter (Quelltext von App.tsx)", () => {
    // Kein Browser und kein Speicher im Test: Prüft, dass der Zweig des ersten Starts den Hinweis einbindet.
    const branch = appSource.slice(appSource.indexOf('state.status === "empty"'), appSource.indexOf("<Onboarding"));
    expect(branch).toContain("<SaveFailedNotice");
    expect(branch).toContain("saveFailed");
  });
});