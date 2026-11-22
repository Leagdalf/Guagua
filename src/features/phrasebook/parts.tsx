// PLATZHALTER bis AP2 (src/ui) fertig ist. Danach durch die Bausteine aus src/ui ersetzen:
// SpeakButton -> Tonknopf (oder Textknopf mit Lautsprecher), SpanishText -> Baustein für spanischen Text.

import type { ReactNode } from "react";

interface SpeakButtonProps {
  /** Wird in der Klick-Behandlung aufgerufen. Hier steht der einzige Weg zum Ton. */
  onSpeak: () => void;
  disabled: boolean;
  /** Für Screenreader, zum Beispiel der Satz, der gesprochen wird. */
  label: string;
}

export function SpeakButton({ onSpeak, disabled, label }: SpeakButtonProps) {
  return (
    <button type="button" className="pb-speak" onClick={onSpeak} disabled={disabled} aria-label={`Anhören: ${label}`}>
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
        <path d="M16 9a4.2 4.2 0 010 6" />
        <path d="M18.6 6.4a8 8 0 010 11.2" />
      </svg>
      <span aria-hidden="true">Anhören</span>
    </button>
  );
}

export function SpanishText({ children }: { children: ReactNode }) {
  return (
    <p className="es pb-es" lang="es">
      {children}
    </p>
  );
}
