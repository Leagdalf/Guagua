import type { ReactNode } from "react";
import { SimplePage, TextButton } from "../../ui";

/** Unterseite von „Mehr“: Textknopf „Zurück“, Titel, Inhalt. */
export function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <SimplePage className="more">
      <TextButton className="more__back" onClick={onBack}>
        Zurück
      </TextButton>
      <h1 className="page-title">{title}</h1>
      {children}
    </SimplePage>
  );
}
