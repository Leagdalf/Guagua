import { describe, expect, it } from "vitest";

/*
 * Prüft die Symbole in public/ und, sobald `npm run build` gelaufen ist, das gebaute dist/.
 * Die Prüfungen an dist/ werden übersprungen, wenn es dist/ noch nicht gibt (zum Beispiel in `npm test`
 * vor dem Build). Der Workflow ruft sie nach dem Build noch einmal auf: npx vitest run src/pwa
 *
 * `node:fs` wird zur Laufzeit geladen, weil das Projekt bewusst ohne @types/node übersetzt wird.
 */

interface Fs {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
  readdirSync(path: string): string[];
  statSync(path: string): { isDirectory(): boolean };
}

const fsModule = "node:fs";
const fs = (await import(/* @vite-ignore */ fsModule)) as Fs;
const textDecoder = new TextDecoder();

const ROOT = new URL("../../", import.meta.url);
const path = (rel: string): string => decodeURIComponent(new URL(rel, ROOT).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const readText = (rel: string): string => textDecoder.decode(fs.readFileSync(path(rel)));

function listFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(path(dir))) {
    const rel = `${prefix}${name}`;
    if (fs.statSync(path(`${dir}/${name}`)).isDirectory()) out.push(...listFiles(`${dir}/${name}`, `${rel}/`));
    else out.push(rel);
  }
  return out;
}

/** Breite, Höhe und Farbtyp aus dem Kopf einer PNG-Datei; ob ein tRNS-Block (Transparenz) vorkommt. */
function pngInfo(file: string): { width: number; height: number; colorType: number; hasTrns: boolean } {
  const bytes = fs.readFileSync(path(file));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = Array.from(bytes.slice(0, 8)).join(",");
  expect(signature).toBe("137,80,78,71,13,10,26,10");
  const ascii = String.fromCharCode(...bytes);
  return { width: view.getUint32(16), height: view.getUint32(20), colorType: bytes[25] ?? -1, hasTrns: ascii.includes("tRNS") };
}

describe("App-Symbole in public/", () => {
  const sizes: Array<[string, number]> = [
    ["public/pwa-192x192.png", 192],
    ["public/pwa-512x512.png", 512],
    ["public/maskable-icon-512x512.png", 512],
    ["public/apple-touch-icon-180x180.png", 180],
  ];

  it.each(sizes)("%s ist quadratisch mit %i Pixel Kantenlänge", (file, size) => {
    const info = pngInfo(file);
    expect(info.width).toBe(size);
    expect(info.height).toBe(size);
  });

  it.each(sizes)("%s hat keine Transparenz (iOS füllt sie schwarz)", (file) => {
    const info = pngInfo(file);
    expect([4, 6]).not.toContain(info.colorType);
    expect(info.hasTrns).toBe(false);
  });

  it("icon.svg ist ein deckendes Quadrat in atlántico", () => {
    const svg = readText("public/icon.svg");
    expect(svg).toContain('viewBox="0 0 512 512"');
    expect(svg).toMatch(/<rect[^>]*width="512"[^>]*height="512"[^>]*fill="#2546C7"/);
  });

  it("index.html verlinkt das apple-touch-icon mit 180 Pixel", () => {
    const html = readText("index.html");
    expect(html).toMatch(/<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon-180x180\.png"/);
  });
});

describe.skipIf(!fs.existsSync(path("dist/manifest.webmanifest")))("gebautes dist/", () => {
  const manifest = JSON.parse(readText("dist/manifest.webmanifest")) as {
    name: string;
    display: string;
    orientation?: string;
    lang: string;
    start_url: string;
    scope: string;
    icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
  };

  it("Manifest: Name, Anzeige, Sprache, keine feste Ausrichtung", () => {
    expect(manifest.name).toBe("Guagua");
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("de");
    expect(manifest.orientation).toBeUndefined();
  });

  it("Manifest: start_url und scope liegen unter /Guagua/", () => {
    expect(manifest.start_url).toBe("/Guagua/");
    expect(manifest.scope).toBe("/Guagua/");
  });

  it("Manifest: Symbole in 192 und 512 Pixel und eine maskierbare Variante, alle Dateien vorhanden", () => {
    const sizesOf = manifest.icons.map((icon) => icon.sizes);
    expect(sizesOf).toContain("192x192");
    expect(sizesOf).toContain("512x512");
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      const info = pngInfo(`dist/${icon.src}`);
      expect(`${info.width}x${info.height}`).toBe(icon.sizes);
    }
  });

  it("index.html im Build: Manifest und Symbole mit Pfad /Guagua/", () => {
    const html = readText("dist/index.html");
    expect(html).toContain('rel="manifest" href="/Guagua/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon" sizes="180x180" href="/Guagua/apple-touch-icon-180x180.png"');
    expect(html).toContain('src="/Guagua/assets/');
  });

  it("Service Worker hält index.html, JS, CSS und alle woff2 vor", () => {
    const sw = readText("dist/sw.js");
    const precached = Array.from(sw.matchAll(/url:"([^"]+)"/g), (m) => m[1] ?? "");
    const files = listFiles("dist");
    expect(precached).toContain("index.html");
    for (const file of files.filter((f) => /\.(js|css|woff2)$/.test(f) && f !== "sw.js" && !f.startsWith("workbox-"))) {
      expect(precached, file).toContain(file);
    }
    expect(files.filter((f) => f.endsWith(".woff2")).length).toBeGreaterThan(0);
    expect(precached.some((u) => u.endsWith(".css"))).toBe(true);
    expect(precached.some((u) => /^assets\/index-.*\.js$/.test(u))).toBe(true);
  });

  it("Service Worker aktiviert sich nicht von selbst (kein skipWaiting ohne Nachricht der App)", () => {
    const sw = readText("dist/sw.js");
    expect(sw).toContain("SKIP_WAITING");
  });

  it("keine Adresse außerhalb der eigenen Herkunft im Build, außer bekannten Namensräumen und Fehlertexten", () => {
    // Namensräume (kein Abruf), Fehlertexte von React und Workbox (nur Text in Meldungen).
    const allowed = [
      "http://www.w3.org/1998/Math/MathML",
      "http://www.w3.org/1999/xlink",
      "http://www.w3.org/2000/svg",
      "http://www.w3.org/XML/1998/namespace",
      "https://bit.ly/wb-precache",
      "https://react.dev/errors/",
    ];
    const found = new Set<string>();
    for (const file of listFiles("dist").filter((f) => /\.(js|css|html|svg|webmanifest)$/.test(f))) {
      for (const match of readText(`dist/${file}`).matchAll(/https?:\/\/[^\s"'`)<>\\]*/g)) found.add(match[0]);
    }
    expect(Array.from(found).filter((url) => !allowed.includes(url))).toEqual([]);
  });
});
