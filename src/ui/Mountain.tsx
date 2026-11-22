import { cx } from "./cx";
import type { StopState } from "./types";

/** Mittelpunkte der zehn Haltepunkte, von unten nach oben (docs/04-design.md). */
export const MOUNTAIN_POINTS: ReadonlyArray<readonly [number, number]> = [
  [6.5, 108.2],
  [13, 100.4],
  [19.4, 92.6],
  [25.9, 84.8],
  [32.3, 77],
  [38.8, 69.3],
  [45.3, 61.5],
  [51.7, 53.7],
  [58.2, 45.9],
  [64.6, 38.1],
];

const RADIUS: Record<StopState, number> = { locked: 3.2, done: 4, open: 5.5, running: 5.5 };

export interface MountainProps {
  /** Zustände der Haltestellen 1 bis 10. Fehlende Einträge zählen als gesperrt. */
  stops: readonly StopState[];
  className?: string;
}

/** Der Berg mit zehn Haltepunkten an der linken Flanke. Schmuck: `aria-hidden`, nicht antippbar. */
export function Mountain({ stops, className }: MountainProps) {
  return (
    <svg className={cx("mountain", className)} viewBox="0 0 180 119" aria-hidden="true" focusable="false">
      <path className="mountain__body" d="M10 118L78 36Q90 20 102 36L170 118Z" />
      <path className="mountain__cap" d="M65.6 51L78 36Q90 20 102 36L114.4 51L102 44L90 54L78 44Z" />
      <path className="mountain__pole" d="M90 28V9" />
      <path className="mountain__flag" d="M90 10h13l-3.5 4 3.5 4H90z" />
      <path className="mountain__line" d="M6.5 108.2L64.6 38.1" />
      {MOUNTAIN_POINTS.map(([cx_, cy], i) => {
        const state = stops[i] ?? "locked";
        return (
          <g key={i} data-state={state}>
            <circle className={cx("mountain__stop", `mountain__stop--${state}`)} cx={cx_} cy={cy} r={RADIUS[state]} />
            {state === "running" && <circle className="mountain__core" cx={cx_} cy={cy} r={2.2} />}
          </g>
        );
      })}
    </svg>
  );
}
