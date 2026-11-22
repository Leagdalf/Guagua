import { describe, expect, it } from "vitest";

/*
 * Regel (CLAUDE.md): `speechSynthesis.speak` nur direkt aus einer Klick-Behandlung, sonst bleibt iOS stumm.
 * Dieser Test liest alle Quelldateien unter src außer Tests und prüft Text, nicht Verhalten:
 *  1. Außerhalb von src/audio steht `speak(` nur in einer Ereigniseigenschaft `on…={…}` oder im Rumpf einer Funktion `handle…`.
 *  2. Dort steht es nie in einem Effekt, Zeitgeber oder Promise-Rückruf und nie nach einem `await`.
 *  3. In src/audio darf nur index.ts (der Umschlag) und speech.ts (die Umsetzung) `speak(` enthalten.
 * Grenze: Ruft eine `handle…`-Funktion aus einem Effekt auf, sieht der Test das nicht. Dafür gibt es die Regel in src/ui/README.md.
 */

const raw = import.meta.glob(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

type Span = readonly [number, number];

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|\s)\/\/.*$/gm, (_m, lead: string) => lead);
}

/** Index der schließenden Klammer zur öffnenden bei `openIdx`, oder -1. */
function closeOf(code: string, openIdx: number): number {
  const open = code[openIdx];
  const close = open === "{" ? "}" : ")";
  let depth = 0;
  for (let i = openIdx; i < code.length; i++) {
    const c = code[i];
    if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  return -1;
}

function lineOf(code: string, index: number): number {
  return code.slice(0, index).split("\n").length;
}

/** Ausdrücke in JSX-Eigenschaften `onClick={…}`, `onSpeak={…}` und so weiter. */
function attributeSpans(code: string): Span[] {
  const spans: Span[] = [];
  for (const m of code.matchAll(/\bon[A-Z]\w*=\{/g)) {
    const open = m.index + m[0].length - 1;
    const end = closeOf(code, open);
    if (end > open) spans.push([open, end]);
  }
  return spans;
}

/** Rümpfe von `function handleX() {…}` und `const handleX = () => {…}`. */
function handlerSpans(code: string): Span[] {
  const spans: Span[] = [];
  for (const m of code.matchAll(/\b(?:function\s+handle\w*|(?:const|let|var)\s+handle\w*\s*(?::[^=]+)?=)/g)) {
    const from = m.index + m[0].length;
    const isDeclaration = m[0].startsWith("function") || /^\s*(?:async\s+)?function\b/.test(code.slice(from, from + 24));
    let bodyStart: number;
    if (isDeclaration) {
      const params = code.indexOf("(", from);
      const paramsEnd = params < 0 ? -1 : closeOf(code, params);
      bodyStart = paramsEnd < 0 ? -1 : code.indexOf("{", paramsEnd);
    } else {
      const arrow = code.indexOf("=>", from);
      if (arrow < 0) continue;
      let j = arrow + 2;
      while (/\s/.test(code[j] ?? "")) j++;
      if (code[j] !== "{") {
        const semi = code.indexOf(";", j);
        spans.push([j - 1, semi < 0 ? code.length : semi]);
        continue;
      }
      bodyStart = j;
    }
    if (bodyStart < 0) continue;
    const end = closeOf(code, bodyStart);
    if (end > bodyStart) spans.push([bodyStart, end]);
  }
  return spans;
}

/** Rückrufe von Effekten, Zeitgebern und Promises: dort ist der Tipp längst vorbei. */
function lateSpans(code: string): Span[] {
  const spans: Span[] = [];
  const re = /\b(?:useEffect|useLayoutEffect|useInsertionEffect|setTimeout|setInterval|requestAnimationFrame|requestIdleCallback|queueMicrotask)\s*\(|\.(?:then|catch|finally)\s*\(/g;
  for (const m of code.matchAll(re)) {
    const open = m.index + m[0].length - 1;
    const end = closeOf(code, open);
    if (end > open) spans.push([open, end]);
  }
  return spans;
}

/** Verstöße gegen Regel 1 und 2 in allen Dateien außerhalb von src/audio. */
function outsideAudioViolations(files: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [name, text] of Object.entries(files)) {
    if (name.includes("/audio/")) continue;
    const code = stripComments(text);
    if (/\bspeak\s+as\b/.test(code)) out.push(`${name}: speak wird unter anderem Namen importiert`);
    if (/\bspeechSynthesis\b/.test(code)) out.push(`${name}: speechSynthesis gehört nur nach src/audio`);
    const handlers = [...attributeSpans(code), ...handlerSpans(code)];
    const late = lateSpans(code);
    for (const m of code.matchAll(/\bspeak\s*\(/g)) {
      const at = m.index;
      const where = `${name}:${lineOf(code, at)}`;
      const inside = handlers.filter(([a, b]) => a < at && at < b).sort((x, y) => x[1] - x[0] - (y[1] - y[0]));
      if (inside.length === 0) {
        out.push(`${where}: speak( steht außerhalb einer Ereignisbehandlung`);
        continue;
      }
      if (late.some(([a, b]) => a < at && at < b)) out.push(`${where}: speak( steht in einem Effekt, Zeitgeber oder Promise-Rückruf`);
      if (/\bawait\b/.test(code.slice(inside[0]![0], at))) out.push(`${where}: speak( steht nach einem await`);
    }
  }
  return out;
}

describe("speak nur aus Klick-Behandlungen (alle Quelldateien unter src)", () => {
  // Schlüssel der Glob-Suche sind relativ zu src/audio („./speech.ts“, „../ui/Es.tsx“); hier werden daraus Pfade ab src.
  const files = Object.fromEntries(
    Object.entries(raw).map(([key, text]) => [key.replace(/\\/g, "/").replace(/^\.\//, "src/audio/").replace(/^\.\.\//, "src/"), text]),
  );

  it("der Test sieht die ganze App und kennt mindestens einen Aufruf", () => {
    const names = Object.keys(files);
    expect(names.length).toBeGreaterThan(30);
    for (const dir of ["core", "ui", "styles", "audio", "features", "app"]) {
      expect(names.some((n) => n.startsWith(`src/${dir}/`)), dir).toBe(true);
    }
    expect(names.some((n) => /\.test\./.test(n))).toBe(false);
    const calls = Object.entries(files)
      .filter(([name]) => !name.includes("/audio/"))
      .reduce((sum, [, text]) => sum + (stripComments(text).match(/\bspeak\s*\(/g)?.length ?? 0), 0);
    expect(calls).toBeGreaterThan(0);
  });

  it("außerhalb von src/audio steht speak( nur in on…={…} oder in handle…, nie in Effekt, Zeitgeber oder nach await", () => {
    expect(outsideAudioViolations(files)).toEqual([]);
  });

  it("in src/audio enthalten nur index.ts und speech.ts ein speak(", () => {
    const hits = Object.entries(files)
      .filter(([name]) => name.includes("/audio/") && /\bspeak\s*\(/.test(stripComments(files[name]!)))
      .map(([name]) => name)
      .sort();
    expect(hits).toEqual(["src/audio/index.ts", "src/audio/speech.ts"]);
  });

  it("synth.speak steht genau einmal, in speech.ts", () => {
    const hits = Object.entries(files).flatMap(([name, text]) =>
      stripComments(text)
        .split("\n")
        .filter((line) => /\bsynth\.speak\(/.test(line))
        .map(() => name),
    );
    expect(hits).toEqual(["src/audio/speech.ts"]);
  });
});

describe("die Regelprüfung selbst erkennt Verstöße", () => {
  const bad: Array<[string, string]> = [
    ["im Effekt", `useEffect(() => { speak("a"); }, []);`],
    ["im Zeitgeber", `function F() { return <button onClick={() => { setTimeout(() => speak("a"), 10); }} />; }`],
    ["im Zeitgeber ohne Klammern", `function handleTap() { setTimeout(() => speak("a")); }`],
    ["nach await", `function F() { return <button onClick={async () => { await load(); speak("a"); }} />; }`],
    ["nach await in handle", `async function handleTap() { await load(); speak("a"); }`],
    ["im Promise", `function handleTap() { load().then(() => speak("a")); }`],
    ["im Rumpf der Komponente", `function F() { speak("a"); return null; }`],
    ["in einer Funktion mit anderem Namen", `function play() { speak("a"); }`],
    ["in einer Eigenschaft ohne on", `<AudioButton action={() => speak("a")} />`],
    ["über getSpeech", `function F() { getSpeech().speak("a"); }`],
    ["unter anderem Namen importiert", `import { speak as say } from "../audio"; say("a");`],
    ["direkt über speechSynthesis", `onClick={() => speechSynthesis.cancel()}`],
  ];

  for (const [title, code] of bad) {
    it(`meldet: ${title}`, () => {
      expect(outsideAudioViolations({ "../x/Bad.tsx": code }).length, code).toBeGreaterThan(0);
    });
  }

  const good: Array<[string, string]> = [
    ["onClick mit Pfeil", `<AudioButton onClick={() => speak(phrase.es)} />`],
    ["onClick mit Block", `<button onClick={() => { track(); speak("a"); }} />`],
    ["onSpeak", `<X onSpeak={() => speak("a")} />`],
    ["handle als Funktion", `function handleTap() { speak("a"); }`],
    ["handle als Konstante", `const handleTap = () => { speak("a"); };`],
    ["handle mit Ausdruck", `const handleTap = () => speak("a");`],
    ["handle in useCallback", `const handleTap = useCallback(() => { speak("a"); }, []);`],
    ["Aufruf nur im Kommentar", `// speak("a") gehört in einen Klick\nconst x = 1;`],
  ];

  for (const [title, code] of good) {
    it(`lässt zu: ${title}`, () => {
      expect(outsideAudioViolations({ "../x/Good.tsx": code })).toEqual([]);
    });
  }
});
