import type { ReactNode } from "react";
import { cx } from "./cx";
import { CheckIcon, CrossIcon } from "./icons";

export type FeedbackResult = "correct" | "wrong" | "accent";

export interface FeedbackProps {
  /** correct: richtig. wrong: falsch. accent: richtig, aber der Akzent fehlte oder saß falsch. */
  result: FeedbackResult;
  /** Der Lösungssatz. Spanisches kommt als `<Es>` hinein. */
  solution: ReactNode;
  /** Hinweis der Karte, steht darunter in ceniza. */
  hint?: ReactNode;
  className?: string;
}

const LEAD: Record<FeedbackResult, string> = {
  correct: "Richtig.",
  wrong: "Falsch. Richtig ist:",
  accent: "Richtig. Achte auf den Akzent:",
};

/**
 * Rückmeldung unter den Antworten: Symbol und Wort zuerst (Haken oder Kreuz, nie nur Farbe),
 * dann der Lösungssatz, darunter der Hinweis. Wird angesagt, sobald sie erscheint.
 */
export function Feedback({ result, solution, hint, className }: FeedbackProps) {
  const ok = result !== "wrong";
  return (
    <div role="status" className={cx("feedback", ok ? "feedback--ok" : "feedback--bad", `feedback--${result}`, className)}>
      <p className="feedback__lead">
        <span className="feedback__mark" aria-hidden="true">
          {ok ? <CheckIcon /> : <CrossIcon />}
        </span>
        {LEAD[result]}
      </p>
      <div className="feedback__solution">{solution}</div>
      {hint && <p className="feedback__hint">{hint}</p>}
    </div>
  );
}
