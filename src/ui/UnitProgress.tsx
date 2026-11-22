import { cx } from "./cx";
import { CrossIcon } from "./icons";
import { StopDot } from "./StopDot";
import type { StopState } from "./types";

export interface UnitProgressProps {
  /** Nummer des aktuellen Schritts, von 1 an. */
  current: number;
  /** Anzahl der Punkte, Standard 6. */
  total?: number;
  className?: string;
}

/** Die kurze Linie mit sechs Punkten: erledigt (atlántico), aktuell (plátano), offen (página). */
export function UnitProgress({ current, total = 6, className }: UnitProgressProps) {
  const dots = Array.from({ length: total }, (_, i): StopState => {
    const n = i + 1;
    return n < current ? "done" : n === current ? "open" : "locked";
  });
  return (
    <ol className={cx("unit-progress", className)} aria-label={`Schritt ${current} von ${total}`}>
      {dots.map((state, i) => (
        <li key={i} aria-current={state === "open" ? "step" : undefined}>
          <StopDot state={state} small />
        </li>
      ))}
    </ol>
  );
}

export interface UnitHeaderProps {
  current: number;
  total?: number;
  /** Zähler rechts, zum Beispiel „5 von 18“. */
  counter?: string;
  onClose?: () => void;
  closeLabel?: string;
}

/** Kopf der Lerneinheit: Schließen, kurze Linie, Zähler. */
export function UnitHeader({ current, total, counter, onClose, closeLabel = "Lerneinheit schließen" }: UnitHeaderProps) {
  return (
    <div className="unit-header">
      <button type="button" className="unit-header__close" aria-label={closeLabel} onClick={onClose}>
        <CrossIcon />
      </button>
      <UnitProgress current={current} total={total} />
      {counter && <p className="unit-header__counter">{counter}</p>}
    </div>
  );
}
