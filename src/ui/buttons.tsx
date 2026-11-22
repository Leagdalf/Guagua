import type { ReactNode } from "react";
import { cx } from "./cx";
import { SpeakerIcon } from "./icons";

export interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  /** Mit `href` wird ein Link (`a`) daraus. */
  href?: string;
  type?: "button" | "submit";
  className?: string;
}

/** Hauptknopf: volle Fläche in atlántico. Pro Ansicht genau einer. */
export function PrimaryButton({ children, onClick, href, type = "button", className }: PrimaryButtonProps) {
  if (href !== undefined) {
    return (
      <a className={cx("btn", className)} href={href} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={cx("btn", className)} onClick={onClick}>
      {children}
    </button>
  );
}

export interface TextButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  "aria-label"?: string;
}

/** Textknopf für Nebenaktionen, mindestens 44 px hoch. */
export function TextButton({ children, onClick, disabled, type = "button", className, ...aria }: TextButtonProps) {
  return (
    <button type={type} className={cx("text-btn", className)} onClick={onClick} disabled={disabled} {...aria}>
      {children}
    </button>
  );
}

export interface AudioButtonProps {
  /** Sprechen passiert im Aufrufer, direkt in dieser Klick-Behandlung. */
  onClick?: () => void;
  /** `normal` beschriftet mit „Anhören“, `slow` mit „Langsam“. */
  variant?: "normal" | "slow";
  /** Ohne spanische Stimme: sichtbar, aber nicht bedienbar. */
  disabled?: boolean;
  /** Eigene Beschriftung statt „Anhören“ / „Langsam“. */
  label?: string;
  className?: string;
}

/** Tonknopf mit Lautsprecher-Symbol. Ruft selbst nie die Sprachausgabe auf. */
export function AudioButton({ onClick, variant = "normal", disabled, label, className }: AudioButtonProps) {
  const text = label ?? (variant === "slow" ? "Langsam" : "Anhören");
  return (
    <button
      type="button"
      className={cx("text-btn", "audio-btn", variant === "slow" && "audio-btn--slow", className)}
      onClick={onClick}
      disabled={disabled}
    >
      <SpeakerIcon />
      {text}
    </button>
  );
}

export interface ActionBarProps {
  children: ReactNode;
  /** Die Leiste sitzt über der unteren Leiste (TabBar) und lässt den sicheren Rand ihr. */
  aboveTabs?: boolean;
  className?: string;
}

/** Untere Aktionsleiste für den Hauptknopf, berücksichtigt `env(safe-area-inset-bottom)`. */
export function ActionBar({ children, aboveTabs, className }: ActionBarProps) {
  return <div className={cx("action-bar", aboveTabs && "action-bar--above-tabs", className)}>{children}</div>;
}
