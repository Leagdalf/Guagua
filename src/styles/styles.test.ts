import { describe, expect, it } from "vitest";

// Keine Node-Typen installiert und Vitest leert CSS-Importe: Quellen über process.getBuiltinModule lesen.
interface FsLike {
  readFileSync(path: string, enc: "utf8"): string;
  readdirSync(path: string): string[];
}
const fs = (
  globalThis as unknown as { process: { getBuiltinModule(name: string): unknown; cwd(): string } }
).process.getBuiltinModule("node:fs") as FsLike;
const base = (globalThis as unknown as { process: { cwd(): string } }).process.cwd().replace(/\\/g, "/");

function read(rel: string): string {
  return fs.readFileSync(`${base}/${rel}`, "utf8");
}

const cssRaw: Record<string, string> = {};
for (const dir of ["src/styles", "src/ui"]) {
  for (const f of fs.readdirSync(`${base}/${dir}`)) {
    if (f.endsWith(".css")) cssRaw[`${dir}/${f}`] = read(`${dir}/${f}`);
  }
}
const fontsTs = read("src/styles/fonts.ts");
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const sources = Object.entries(cssRaw).map(([file, css]) => ({ file, css: stripComments(css) }));
const allCss = sources.map((s) => s.css).join("\n");

interface Rule {
  selector: string;
  body: string;
}

function rulesOf(css: string): Rule[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!.trim(), body: m[2]! }));
}

const PALETTE = new Set(["#FAFBFC", "#18233D", "#2546C7", "#FFE56B", "#B3261E", "#1C6B48", "#5A6474", "#D8DDE5", "#C9824F", "#FFFFFF"]);

describe("CSS-Regeln aus docs/04-design.md", () => {
  it("es gibt CSS-Quellen", () => {
    expect(sources.length).toBeGreaterThanOrEqual(5);
  });

  it("nur Farben der Palette, kein rgb, hsl oder benanntes Farbwort außer transparent und currentcolor", () => {
    const hex = [...allCss.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toUpperCase());
    expect(hex.length).toBeGreaterThan(0);
    for (const h of hex) expect(PALETTE.has(h), `Farbe ${h} steht nicht in der Palette`).toBe(true);
    expect(allCss).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch|lab|color-mix)\(/i);
    for (const decl of allCss.matchAll(/(?:^|[;{\s])(color|background(?:-color)?|border(?:-[a-z]+)*-color|fill|stroke|text-decoration-color)\s*:\s*([^;}]+)/g)) {
      const value = decl[2]!.trim();
      if (/^var\(--[a-z]+\)$|^transparent$|^currentcolor$|^inherit$|^none$/i.test(value)) continue;
      // zusammengesetzte Werte wie "var(--x) solid 1px": nur Farbwörter prüfen
      expect(value, `${decl[1]}: ${value}`).not.toMatch(/\b(red|blue|green|black|white|gray|grey|yellow|orange|purple)\b/i);
    }
  });

  it("jede verwendete Farbvariable ist definiert", () => {
    const defined = new Set([...allCss.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    for (const m of allCss.matchAll(/var\((--[a-z0-9-]+)/g)) {
      expect(defined.has(m[1]!), `${m[1]} nicht definiert`).toBe(true);
    }
  });

  it("die Namen der CSS-Variablen aus der Festlegung sind auf :root gesetzt", () => {
    const tokens = stripComments(cssRaw["src/styles/tokens.css"]!);
    for (const name of ["pagina", "tinta", "atlantico", "platano", "mojo", "drago", "ceniza", "raya", "teide", "nieve", "font-es", "font-de"]) {
      expect(tokens, name).toMatch(new RegExp(`--${name}\\s*:`));
    }
  });

  it("keine der Schriften Inter, Roboto, Arial als erste Wahl", () => {
    const forbidden = /^["']?(inter|roboto|arial|system-ui|-apple-system|sans-serif)["']?$/i;
    for (const m of allCss.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
      const first = m[1]!.split(",")[0]!.trim();
      expect(forbidden.test(first), `font-family beginnt mit ${first}`).toBe(false);
    }
    expect(allCss).toMatch(/--font-es\s*:\s*"Newsreader"/);
    expect(allCss).toMatch(/--font-de\s*:\s*"Figtree"/);
  });

  it("kein Verlauf", () => {
    expect(allCss).not.toMatch(/(linear|radial|conic)-gradient/i);
  });

  it("box-shadow steht nur in der Marker-Regel, text-shadow und drop-shadow gar nicht", () => {
    const withShadow = sources.flatMap((s) => rulesOf(s.css)).filter((r) => /box-shadow/.test(r.body));
    expect(withShadow.map((r) => r.selector)).toEqual([".marker"]);
    expect(withShadow[0]!.body).toMatch(/box-shadow:\s*inset 0 -0\.34em 0 var\(--platano\)/);
    expect(withShadow[0]!.body).toMatch(/-webkit-box-decoration-break:\s*clone/);
    expect(withShadow[0]!.body).toMatch(/[^-]box-decoration-break:\s*clone/);
    expect(allCss).not.toMatch(/text-shadow|drop-shadow/);
  });

  it("Newsreader kursiv, Figtree; Schnitte laden nur die lateinischen Zeichensätze", () => {
    const fonts = fontsTs;
    const imports = [...fonts.matchAll(/^import "([^"]+)"/gm)].map((m) => m[1]);
    expect(imports).toEqual([
      "@fontsource/newsreader/latin-400-italic.css",
      "@fontsource/newsreader/latin-500-italic.css",
      "@fontsource/figtree/latin-400.css",
      "@fontsource/figtree/latin-500.css",
      "@fontsource/figtree/latin-600.css",
    ]);
    const es = rulesOf(allCss).find((r) => r.selector === ".es")!;
    expect(es.body).toMatch(/font-family:\s*var\(--font-es\)/);
    expect(es.body).toMatch(/font-style:\s*italic/);
  });
});

describe("Tippflächen, sichere Ränder, Bewegung, iOS", () => {
  const rules = sources.flatMap((s) => rulesOf(s.css));

  /** Kleinster Pixelwert einer Eigenschaft in allen Regeln eines Selektors, Variablen aufgelöst. */
  function minPx(selector: string, prop: string): number {
    const vars = new Map<string, number[]>();
    for (const r of rules.filter((r) => r.selector === ":root")) {
      for (const m of r.body.matchAll(/(--[a-z0-9-]+)\s*:\s*(\d+(?:\.\d+)?)px/g)) {
        vars.set(m[1]!, [...(vars.get(m[1]!) ?? []), Number(m[2])]);
      }
    }
    const values: number[] = [];
    for (const r of rules.filter((r) => r.selector.split(",").map((s) => s.trim()).includes(selector))) {
      const m = r.body.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`));
      if (!m) continue;
      const v = m[1]!.trim();
      const px = v.match(/^(\d+(?:\.\d+)?)px$/);
      const variable = v.match(/^var\((--[a-z0-9-]+)\)$/);
      if (px) values.push(Number(px[1]));
      else if (variable) values.push(...(vars.get(variable[1]!) ?? [NaN]));
      else values.push(NaN);
    }
    expect(values.length, `${selector} hat kein ${prop}`).toBeGreaterThan(0);
    return Math.min(...values);
  }

  it("Tippflächen messen mindestens 44 px (Höhe, bei Symbolknöpfen auch Breite)", () => {
    for (const sel of [".btn", ".text-btn", ".answer", ".tab", ".unit-header__close"]) {
      const prop = sel === ".unit-header__close" ? "height" : "min-height";
      expect(minPx(sel, prop), `${sel} ${prop}`).toBeGreaterThanOrEqual(44);
    }
    expect(minPx(".text-btn", "min-width")).toBeGreaterThanOrEqual(44);
    expect(minPx(".unit-header__close", "width")).toBeGreaterThanOrEqual(44);
    expect(minPx(".tab", "min-height")).toBeGreaterThanOrEqual(44);
    // Zeilen der Linie, die antippbar sind, sind höher als 44 px
    expect(minPx(".stop", "min-height")).toBeGreaterThanOrEqual(44);
  });

  it("Untere Leiste, Aktionsleiste mit Hauptknopf und Lerneinheit berücksichtigen env(safe-area-inset-bottom)", () => {
    for (const sel of [".tabbar", ".action-bar", ".action-bar--above-tabs"]) {
      const body = rules.filter((r) => r.selector === sel).map((r) => r.body).join(";");
      expect(body, sel).toContain("env(safe-area-inset-bottom");
    }
    expect(allCss).toMatch(/\.lesson \.action-bar\s*\{[^}]*env\(safe-area-inset-bottom/);
    expect(allCss).toContain("env(safe-area-inset-top");
    expect(allCss).toContain("env(safe-area-inset-left");
    expect(allCss).toContain("env(safe-area-inset-right");
  });

  it("100dvh statt 100vh, touch-action manipulation, Eingabefelder mindestens 16 px", () => {
    expect(allCss).toContain("100dvh");
    expect(allCss).not.toMatch(/\d\s*vh\b/);
    expect(allCss).toMatch(/touch-action:\s*manipulation/);
    expect(allCss).toMatch(/input,[\s\S]*?\{[^}]*font-size:\s*max\(16px/);
  });

  it("prefers-reduced-motion und data-calm schalten Übergänge und Animationen ab", () => {
    expect(allCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none !important;[\s\S]*?transition:\s*none !important/);
    expect(allCss).toMatch(/:root\[data-calm\] \*[\s\S]*?animation:\s*none !important;[\s\S]*?transition:\s*none !important/);
  });

  it("Raster: Umbruch bei 700 px, Spalten 620, 680 und 1000 px, Abstand 48 px, Berg 340 px auf dem iPad", () => {
    expect(allCss).toContain("@media (min-width: 700px)");
    expect(allCss).toMatch(/--col-lesson:\s*620px/);
    expect(allCss).toMatch(/--col-simple:\s*680px/);
    expect(allCss).toMatch(/--col-home:\s*1000px/);
    expect(allCss).toMatch(/column-gap:\s*var\(--s12\)/);
    expect(allCss).toMatch(/--s12:\s*48px/);
    expect(allCss).toMatch(/--mountain-w:\s*340px/);
    expect(allCss).toMatch(/--mountain-w:\s*180px/);
  });

  it("keine Schrift unter 13 px", () => {
    for (const m of allCss.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      expect(Number(m[1])).toBeGreaterThanOrEqual(13);
    }
  });
});
