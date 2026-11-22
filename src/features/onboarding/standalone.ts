// Erkennung, ob die App vom Home-Bildschirm läuft (docs/02-spezifikation.md, 2.1). Reine Funktion über hineingereichte Browser-Objekte.

export interface StandaloneEnv {
  navigator?: { standalone?: boolean };
  matchMedia?: (query: string) => { matches: boolean };
}

/** Wahr im Home-Bildschirm-Modus: `navigator.standalone` (iOS) oder `display-mode: standalone`. */
export function isStandaloneMode(env: StandaloneEnv): boolean {
  if (env.navigator?.standalone === true) return true;
  try {
    return env.matchMedia?.("(display-mode: standalone)").matches === true;
  } catch {
    return false;
  }
}

/** Liest die Umgebung des Browsers. Außerhalb des Browsers (Tests, Server) ist die App nicht installiert. */
export function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return isStandaloneMode({
    navigator: window.navigator as { standalone?: boolean },
    matchMedia: typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : undefined,
  });
}
