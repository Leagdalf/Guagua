import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Die App liegt später unter https://leagdalf.github.io/Guagua/ (großes G wie im Namen des Repositorys).
// Gebaut und in der Vorschau (`npm run preview`) gilt dieser Pfad, im Entwicklungsserver und in Tests "/".
const REPO_BASE = "/Guagua/";

/** Datum des Builds (lokaler Kalendertag, JJJJ-MM-TT) für „Stand der Inhalte“; auch im Entwicklungsserver und in Tests gesetzt. */
function buildDate(): string {
  const now = new Date();
  const two = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

export default defineConfig(({ command, isPreview }) => {
  const base = command === "build" || isPreview ? REPO_BASE : "/";

  return {
    base,
    define: { __BUILD_DATE__: JSON.stringify(buildDate()) },
    plugins: [
      react(),
      VitePWA({
        // Kein stilles Aktualisieren: Die neue Version wartet, bis die Lernende „Neu laden“ tippt.
        registerType: "prompt",
        // Angemeldet wird in src/pwa/register.ts, nicht durch ein eingefügtes Skript.
        injectRegister: false,
        // Im Entwicklungsserver bleibt der Service Worker aus (devOptions.enabled ist standardmäßig false).
        devOptions: { enabled: false },
        manifest: {
          id: base,
          name: "Guagua",
          short_name: "Guagua",
          description: "Spanisch lernen für den Urlaub.",
          lang: "de",
          dir: "ltr",
          display: "standalone",
          start_url: base,
          scope: base,
          theme_color: "#FAFBFC",
          background_color: "#FAFBFC",
          icons: [
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          // Alles, was die App zum Start braucht, auch die Schriften (woff2 genügt für Safari).
          globPatterns: ["**/*.{html,js,css,woff2,png,svg,webmanifest}"],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          // Der Wartezustand wird nur auf Antwort der App beendet (Knopf „Neu laden“).
          skipWaiting: false,
        },
      }),
    ],
    test: {
      environment: "node",
      include: ["src/**/*.test.{ts,tsx}"],
    },
  };
});
