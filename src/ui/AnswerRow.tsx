import type { ReactNode } from "react";
import { cx } from "./cx";
import { CheckIcon, CrossIcon } from "./icons";

export type AnswerState = "selectable" | "correct" | "wrong" | "locked";

export interface AnswerRowProps {
  /** selectable: wählbar. correct: richtige Lösung. wrong: falsch gewählt. locked: gesperrt nach der Antwort. */
  state?: AnswerState;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Antwortzeile. Richtig und falsch zeigen Symbol und Text, nie nur Farbe:
 * richtig = Haken + „richtig“, falsch = Kreuz + durchgestrichen + „deine Antwort“.
 */
export function AnswerRow({ state = "selectable", onClick, children, className }: AnswerRowProps) {
  return (
    <button
      type="button"
      className={cx("answer", `answer--${state}`, className)}
      onClick={state === "selectable" ? onClick : undefined}
      disabled={state !== "selectable"}
    >
      <span className="answer__mark" aria-hidden="true">
        {state === "correct" ? (
          <CheckIcon />
        ) : state === "wrong" ? (
          <CrossIcon />
        ) : (
          <span className="answer__circle" />
        )}
      </span>
      <span className="answer__text">{children}</span>
      {state === "correct" && <span className="answer__tag">richtig</span>}
      {state === "wrong" && <span className="answer__tag">deine Antwort</span>}
    </button>
  );
}

/** Gestapelte Antwortzeilen mit Haarlinien dazwischen. */
export function AnswerList({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cx("answers", className)}>
      {children}
    </div>
  );
}
