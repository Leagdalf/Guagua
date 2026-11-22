import { createElement, type ReactNode } from "react";
import { cx } from "./cx";

export type EsSize = "text" | "card" | "today" | "stop" | "inherit";

export interface EsProps {
  /** HTML-Element, Standard `span`. */
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div" | "li";
  /** text 20/24 px, card 48/72, today 50/68, stop 23/26, inherit übernimmt die Größe. */
  size?: EsSize;
  className?: string;
  children: ReactNode;
}

/** Spanischer Text: Newsreader kursiv, trägt immer `lang="es"`. */
export function Es({ as = "span", size = "text", className, children }: EsProps) {
  return createElement(
    as,
    { lang: "es", className: cx("es", size !== "text" && `es--${size}`, className) },
    children,
  );
}

/** Gelber Marker hinter dem unteren Drittel einer Zeile (zeigt, was gerade dran ist). */
export function Marker({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cx("marker", className)}>{children}</span>;
}
