import { Notice } from "../../ui";

/** Gleicher Wortlaut wie in `src/App.tsx`. */
export const SAVE_FAILED_TEXT = "Dein Lernstand lässt sich auf diesem Gerät nicht speichern. Er geht verloren, wenn du die App schließt.";

/** Hinweis in der Lerneinheit, wenn der Speicher `saveFailed` meldet. */
export function SaveFailedNotice({ saveFailed }: { saveFailed: boolean }) {
  return saveFailed ? <Notice text={SAVE_FAILED_TEXT} /> : null;
}