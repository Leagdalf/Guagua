/** Schaltet den Ruhemodus am Wurzelelement: `data-calm` schaltet alle Übergänge und Animationen ab. */
export function applyCalm(on: boolean, root: HTMLElement = document.documentElement): void {
  if (on) root.setAttribute("data-calm", "");
  else root.removeAttribute("data-calm");
}
