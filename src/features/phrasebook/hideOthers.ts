// Verbirgt alles außer dem Vollbild für Screenreader und Fokus: `aria-hidden` und `inert` an den übrigen Elementen unter `body`.

/** Das Wenige, was von einem Element gebraucht wird. */
export interface HideableElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** Setzt die Attribute an allen Elementen außer `keep` und gibt eine Funktion zurück, die den alten Stand wiederherstellt. */
export function hideOthers(keep: HideableElement, elements: readonly HideableElement[]): () => void {
  const saved = elements
    .filter((element) => element !== keep)
    .map((element) => ({ element, hidden: element.getAttribute("aria-hidden"), inert: element.getAttribute("inert") }));
  for (const { element } of saved) {
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
  }
  return () => {
    for (const { element, hidden, inert } of saved) {
      if (hidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", hidden);
      if (inert === null) element.removeAttribute("inert");
      else element.setAttribute("inert", inert);
    }
  };
}
