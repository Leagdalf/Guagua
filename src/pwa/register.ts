/** Wie oft die App im Hintergrund nach einer neuen Version fragt, solange sie offen bleibt. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** So lange wartet „Neu laden“ höchstens darauf, dass die neue Version übernimmt. Danach lädt die Seite trotzdem neu. */
const RELOAD_FALLBACK_MS = 2500;

let needRefresh = false;
let started = false;
let reloading = false;
let swRegistration: ServiceWorkerRegistration | null = null;
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
    registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onRegisteredSW: (_url, registration) => {
        if (!registration) return;
        swRegistration = registration;
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

/**
 * Aktiviert die wartende Version und lädt die Seite neu. Der Lernstand liegt im Browser-Speicher und bleibt.
 *
 * Nicht über `updateSW(true)` aus vite-plugin-pwa: Das lädt erst neu, wenn Workbox ein „controlling“-Ereignis mit
 * `isUpdate` meldet. In der installierten App auf dem iPad bleibt das oft aus (die Seite war beim Start nicht
 * „kontrolliert“), dann passiert nach dem Tippen nichts. Hier lädt die Seite neu, sobald die neue Version übernimmt,
 * und spätestens nach RELOAD_FALLBACK_MS.
 */
export function reloadForUpdate(): void {
  if (reloading) return;
  reloading = true;
  let reloaded = false;
  const reload = (): void => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  const waiting = swRegistration?.waiting;
  if (!waiting) {
    reload();
    return;
  }
  navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
  waiting.addEventListener("statechange", () => {
    if (waiting.state === "activated") reload();
  });
  waiting.postMessage({ type: "SKIP_WAITING" });
  setTimeout(reload, RELOAD_FALLBACK_MS);
}


