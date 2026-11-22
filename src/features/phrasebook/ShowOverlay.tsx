import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { speak } from "../../audio";
import type { Phrase } from "../../core/types";
import { AudioButton, Es } from "../../ui";
import { hideOthers } from "./hideOthers";
import { showFontSize } from "./showSize";

export interface ShowOverlayProps {
  phrase: Pick<Phrase, "es" | "de">;
  /** Ohne spanische Stimme bleibt „Langsam vorlesen“ sichtbar, aber gesperrt. */
  hasVoice: boolean;
  onClose: () => void;
}

/**
 * Vollbild „Zeigen“: der Satz in sehr großer Schrift, darunter klein die Übersetzung, unten „Langsam vorlesen“ und „Schließen“.
 * Beim Öffnen geht der Fokus auf „Schließen“, Escape schließt. Ohne Portal, damit es sich ohne Browser rendern lässt;
 * im Betrieb steht es in `ShowPortal`.
 */
export function ShowOverlay({ phrase, hasVoice, onClose }: ShowOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const closeLatest = useRef(onClose);
  closeLatest.current = onClose;
  useEffect(() => {
    // Auch wenn der Fokus verloren geht (Tippen neben die Knöpfe), schließt Escape.
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeLatest.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const style = {
    "--show-fs-phone": `${showFontSize(phrase.es, "phone")}px`,
    "--show-fs-tablet": `${showFontSize(phrase.es, "tablet")}px`,
  } as CSSProperties;

  // Tab bleibt innerhalb der Knöpfe, auch wo `inert` fehlt.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="pb-show" role="dialog" aria-modal="true" aria-label="Satz im Vollbild" style={style} onKeyDown={handleKeyDown}>
      <div className="pb-show__body">
        <Es as="p" size="inherit" id="pb-show-es" className="pb-show__es">
          {phrase.es}
        </Es>
        <p className="pb-show__de">{phrase.de}</p>
      </div>
      <div className="pb-show__actions">
        <AudioButton
          variant="slow"
          label="Langsam vorlesen"
          describedBy="pb-show-es"
          disabled={!hasVoice}
          onClick={() => speak(phrase.es, { slow: true })}
        />
        <button type="button" className="text-btn pb-show__close" ref={closeRef} onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}

/** Legt das Vollbild über die ganze App (Kind von `body`), verbirgt den Rest für Screenreader und gibt den Fokus beim Schließen zurück. */
export function ShowPortal(props: ShowOverlayProps) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const holder = document.createElement("div");
    holder.className = "pb-show-root";
    document.body.appendChild(holder);
    const restore = hideOthers(holder, Array.from(document.body.children));
    setNode(holder);
    return () => {
      restore();
      holder.remove();
      opener?.focus();
    };
  }, []);

  return node ? createPortal(<ShowOverlay {...props} />, node) : null;
}

