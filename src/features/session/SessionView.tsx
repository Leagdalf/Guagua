import { LessonPage, PrimaryButton } from "../../ui";
import type { SessionViewProps } from "./types";

// Platzhalter der Hauptsitzung. AP4 ersetzt den Inhalt, Name und Props bleiben.
export function SessionView({ onExit }: SessionViewProps) {
  return (
    <LessonPage footer={<PrimaryButton onClick={onExit}>Zur Linie</PrimaryButton>}>
      <p>Die Lerneinheit wird gerade gebaut.</p>
    </LessonPage>
  );
}
