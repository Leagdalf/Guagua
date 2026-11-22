import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { allPhrases, phrasebook } from "../../core/content";
import { PhrasebookResults } from "./PhrasebookResults";
import { PhrasebookView } from "./PhrasebookView";

function decode(html: string): string {
  return html
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

describe("PhrasebookView (Server-Render, ohne DOM)", () => {
  const html = decode(renderToStaticMarkup(<PhrasebookView />));

  it("zeigt alle 56 Sätze mit Spanisch (lang=es) und Deutsch", () => {
    expect(allPhrases).toHaveLength(56);
    expect(html.match(/<li class="pb-row"/g)).toHaveLength(56);
    for (const phrase of allPhrases) {
      expect(html).toContain(`lang="es" class="es">${phrase.es}</p>`);
      expect(html).toContain(phrase.de);
    }
  });

  it("spanischer Text steht nie ohne lang=es, auch nicht in einem aria-label", () => {
    expect(html).not.toMatch(/aria-label="[^"]*"/); // die Tonknöpfe verweisen mit aria-describedby auf den Satz
    for (const phrase of allPhrases) {
      const all = html.split(phrase.es).length - 1;
      const inEs = html.split(`lang="es" class="es">${phrase.es}</p>`).length - 1;
      expect(all, phrase.es).toBe(inEs);
    }
    const ids = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]!);
    expect(ids).toHaveLength(56);
    for (const id of ids) expect(html, id).toContain(`id="${id}" lang="es"`);
  });

  it("passt in AppShell: kein eigenes main, ein h1, die Kategorien als h2", () => {
    expect(html).not.toContain("<main");
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html.match(/<h2[ >]/g)).toHaveLength(phrasebook.categories.length);
    expect(html).not.toContain("<h3");
  });

  it("zeigt alle Kategorien als Überschrift", () => {
    for (const category of phrasebook.categories) expect(html).toContain(category.title_de);
  });

  it("der Hinweis zur Notrufnummer steht in der ersten Kategorie vor dem ersten Satz", () => {
    const first = phrasebook.categories[0];
    expect(first?.note_de).toContain("112");
    const heading = html.indexOf(first!.title_de);
    const note = html.indexOf(first!.note_de!);
    const firstPhrase = html.indexOf(first!.phrases[0]!.es);
    expect(heading).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(heading);
    expect(firstPhrase).toBeGreaterThan(note);
    // und vor jeder weiteren Kategorie
    expect(note).toBeLessThan(html.indexOf(phrasebook.categories[1]!.title_de));
  });

  it("Tonknöpfe sind sichtbar und ohne Stimme deaktiviert; der Hinweis erscheint nicht zweimal", () => {
    expect(html.match(/<button[^>]*audio-btn[^>]*disabled/g)).toHaveLength(56);
    expect(html.match(/class="notice"/g)).toBeNull(); // Server-Render: Hinweis erst im Browser
  });

  it("hat ein Suchfeld", () => {
    expect(html).toContain('type="search"');
  });
});

describe("PhrasebookResults", () => {
  it("„WASSER“ zeigt genau zwei Sätze", () => {
    const html = decode(renderToStaticMarkup(<PhrasebookResults query="WASSER" hasVoice />));
    expect(html.match(/<li class="pb-row"/g)).toHaveLength(2);
    expect(html).toContain("Otra agua, por favor.");
    expect(html).toContain("No hay agua caliente.");
    expect(html).not.toContain("disabled");
  });

  it("„medico“ zeigt „Necesito un médico.“", () => {
    const html = decode(renderToStaticMarkup(<PhrasebookResults query="medico" hasVoice />));
    expect(html).toContain("Necesito un médico.");
  });

  it("„xyz“ zeigt einen leeren Zustand mit Text und keine Sätze", () => {
    const html = decode(renderToStaticMarkup(<PhrasebookResults query="xyz" hasVoice />));
    expect(html).not.toContain("pb-row");
    expect(html).toContain("Nichts gefunden für „xyz“");
  });
});
