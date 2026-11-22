import type { ReactNode } from "react";
import { cx } from "./cx";

function Icon({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      className={cx("icon", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 12.5l5 5L20 6.5" />
    </Icon>
  );
}

export function CrossIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function SpeakerIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
      <path d="M16 9a4.2 4.2 0 010 6" />
      <path d="M18.6 6.4a8 8 0 010 11.2" />
    </Icon>
  );
}
