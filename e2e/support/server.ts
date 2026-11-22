// Baut die App in einen eigenen Ordner und liefert sie mit `vite preview` aus.
// Der Server läuft als eigener Prozess; seine Prozess-Nummer steht in einer Datei, damit auch der Offline-Test
// (ein anderer Prozess als das Setup) ihn beenden und wieder starten kann.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, "..", "..");
export const OUT_DIR = "dist-e2e";
export const PORT = 4273;
export const ORIGIN = `http://localhost:${PORT}`;
export const BASE_URL = `${ORIGIN}/Guagua/`;

const PID_FILE = resolve(ROOT, "test-results", ".e2e-server.pid");
const VITE_BIN = resolve(ROOT, "node_modules", "vite", "bin", "vite.js");

/** Baut die App neu nach `dist-e2e`. Mit `E2E_SKIP_BUILD=1` bleibt ein vorhandener Bau stehen. */
export function buildApp(): void {
  if (process.env.E2E_SKIP_BUILD === "1" && existsSync(resolve(ROOT, OUT_DIR, "index.html"))) return;
  const result = spawnSync(process.execPath, [VITE_BIN, "build", "--outDir", OUT_DIR], { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) throw new Error("vite build für die Ablauftests ist fehlgeschlagen");
}

export async function isUp(): Promise<boolean> {
  try {
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitFor(up: boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await isUp()) === up) return;
    await new Promise((done) => setTimeout(done, 150));
  }
  throw new Error(`Vorschau-Server ${up ? "startet nicht" : "lässt sich nicht beenden"}`);
}

export async function startServer(): Promise<void> {
  if (await isUp()) throw new Error(`Auf Port ${PORT} läuft schon etwas. Beende es, damit die Tests ihren eigenen Stand prüfen.`);
  const child = spawn(
    process.execPath,
    [VITE_BIN, "preview", "--outDir", OUT_DIR, "--port", String(PORT), "--strictPort", "--host", "localhost"],
    { cwd: ROOT, stdio: "ignore", detached: true, windowsHide: true },
  );
  child.unref();
  mkdirSync(dirname(PID_FILE), { recursive: true });
  writeFileSync(PID_FILE, String(child.pid));
  await waitFor(true, 30_000);
}

export async function stopServer(): Promise<void> {
  if (existsSync(PID_FILE)) {
    const pid = readFileSync(PID_FILE, "utf8").trim();
    if (/^\d+$/.test(pid)) {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", pid, "/T", "/F"], { stdio: "ignore" });
      else {
        try {
          process.kill(Number(pid));
        } catch {
          // schon beendet
        }
      }
    }
    rmSync(PID_FILE, { force: true });
  }
  await waitFor(false, 15_000);
}
