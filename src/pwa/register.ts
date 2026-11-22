/** Wie oft die App im Hintergrund nach einer neuen Version fragt, solange sie offen bleibt. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let needRefresh = false;
let started = false;
let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

function setNeedRefresh(value: boolean): void {
  needRefresh = value;
  listeners.forEach((listener) => listener());
}

/**
 * Meldet den Service Worker an. Nur im Produktions-Build und nur einmal. Im Entwicklungsserver bleibt er aus.
 * Eine neue Version wird nicht von selbst aktiv: `onNeedRefresh` setzt nur die Meldung, `reloadForUpdate` aktiviert sie.
 */
export function registerServiceWorker(): void {
  if (started || !import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  started = true;
  // Erst hier geladen: Das virtuelle Modul gibt es nur im Build, Tests und Entwicklungsserver kommen nie hierher.
  void import("virtual:pwa-register").then(({ registerSW }) => {
    applyUpdate = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onRegisteredSW: (_url, registration) => {
        if (!registration) return;
        const check = (): void => {
          if (navigator.onLine) void registration.update().catch(() => undefined);
        };
        // Eine installierte App auf dem iPad bleibt oft tagelang im Hintergrund: beim Zurückkehren prüfen.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") check();
        });
        setInterval(check, CHECK_INTERVAL_MS);
      },
      onRegisterError: () => undefined,
    });
  });
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNeedRefresh(): boolean {
  return needRefresh;
}

/** Aktiviert die wartende Version und lädt die Seite neu. Der Lernstand liegt im Browser-Speicher und bleibt. */
export function reloadForUpdate(): void {
  if (applyUpdate) void applyUpdate(true);
  else window.location.reload();
}


