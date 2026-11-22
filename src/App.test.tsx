import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

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
