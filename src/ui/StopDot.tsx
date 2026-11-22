import { cx } from "./cx";
import { CheckIcon } from "./icons";
import type { StopState } from "./types";

export interface StopDotProps {
  state: StopState;
  /** Quadrat mit 4 px Ecken statt Kreis: die Endstation. */
  terminus?: boolean;
  /** Kleine Form (16/20 px) für den Fortschritt der Einheit. */
  small?: boolean;
  className?: string;
}

/**
 * Haltepunkt: gesperrt (página), offen (plátano), läuft (plátano mit Punkt), abgeschlossen (atlántico mit Haken).
 * Reine Zierde (`aria-hidden`), der Zustand steht als Text daneben.
 */
export function StopDot({ state, terminus, small, className }: StopDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cx("stop-dot", `stop-dot--${state}`, terminus && "stop-dot--terminus", small && "stop-dot--small", className)}
    >
      {state === "done" && <CheckIcon />}
    </span>
  );
}
