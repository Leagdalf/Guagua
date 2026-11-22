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
      expect(html).toContain(`lang="es">${phrase.es}</p>`);
      expect(html).toContain(phrase.de);
    }
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
    expect(html.match(/class="pb-speak"[^>]*disabled/g)).toHaveLength(56);
    expect(html.match(/class="nvn"/g)).toBeNull(); // Server-Render: Hinweis erst im Browser
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

describe("speak nur aus Klick-Behandlungen", () => {
  const raw = import.meta.glob(["./*.{ts,tsx}", "../../audio/*.{ts,tsx}", "!**/*.test.*"], {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const sources = Object.entries(raw).map(([name, text]) => ({ name, text }));

  it("kein Zeitgeber und kein Effekt in Ton- und Sprachführer-Code", () => {
    for (const { name, text } of sources) {
      const code = text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(code, name).not.toMatch(/\b(useEffect|useLayoutEffect|setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b/);
    }
  });

  it("jeder Aufruf speak(...) in der Oberfläche steht in einer Klick-Behandlung", () => {
    const calls: string[] = [];
    for (const { name, text } of sources.filter((s) => /\.tsx$/.test(s.name))) {
      for (const line of text.split("\n")) {
        if (!/\bspeak\(/.test(line) || /^\s*(\/\/|\*)/.test(line)) continue;
        calls.push(`${name}: ${line.trim()}`);
        expect(line, name).toMatch(/onSpeak=\{\(\) => speak\(|onClick=\{/);
      }
    }
    expect(calls.length).toBeGreaterThan(0);
  });

  it("synth.speak steht genau einmal, in speech.ts, innerhalb der Funktion speak", () => {
    const hits = sources.flatMap(({ name, text }) =>
      text.split("\n").filter((line) => /\bsynth\.speak\(/.test(line)).map(() => name),
    );
    expect(hits).toEqual(["../../audio/speech.ts"]);
  });

  it("onSpeak wird nur im onClick des Tonknopfs aufgerufen", () => {
    const parts = sources.find((s) => s.name.endsWith("parts.tsx"))!.text;
    expect(parts.match(/onClick=\{onSpeak\}/g)).toHaveLength(1);
    expect(parts.match(/onSpeak\(/g)).toBeNull();
  });
});
