import { useState } from "react";
import type { Clock } from "../../core/time";
import type { Day, Progress } from "../../core/types";
import type { ReplaceResult } from "../../core/store";
import { appClock, progressStore } from "../../state";
import { SimplePage } from "../../ui";
import { AboutPage } from "./AboutPage";
import { BackupPage } from "./BackupPage";
import { CheatSheetPage } from "./CheatSheetPage";
import { SettingsPage } from "./SettingsPage";
import "./choice.css";
import "./more.css";

export interface MoreViewProps {
  progress: Progress;
  day: Day;
  /** Ändert den Fortschritt und speichert sofort (`progressStore.update`). */
  onUpdate: (fn: (progress: Progress) => Progress) => void;
  /** Ersetzt den Fortschritt beim Import (`progressStore.replaceProgress`). Standard: der Speicher der App. */
  onReplace?: (next: Progress) => ReplaceResult;
  /** Uhr für Datum im Export. Standard: die Uhr der App. */
  now?: Clock;
  /** Unterseite, mit der die Ansicht beginnt (für Tests). */
  initialPage?: MorePage;
}

export type MorePage = "menu" | "cheat" | "settings" | "backup" | "about";

export const MENU: ReadonlyArray<{ id: Exclude<MorePage, "menu">; label: string; detail: string }> = [
  { id: "cheat", label: "Spickzettel", detail: "Grammatik, Zahlen, Wochentage, Aussprache" },
  { id: "settings", label: "Einstellungen", detail: "Name, Stimme, Tempo, Ruhemodus" },
  { id: "backup", label: "Fortschritt sichern", detail: "Exportieren und importieren" },
  { id: "about", label: "Über die App", detail: "Version, Lernzeit, Lizenzen" },
];

/** Mehr (Spezifikation 2.7): Liste mit vier Unterseiten, ohne Router. Jede Unterseite hat „Zurück“. */
export function MoreView({ progress, day, onUpdate, onReplace, now = appClock, initialPage = "menu" }: MoreViewProps) {
  const [page, setPage] = useState<MorePage>(initialPage);

  const open = (next: MorePage): void => {
    setPage(next);
    window.scrollTo(0, 0);
  };
  const back = (): void => open("menu");

  switch (page) {
    case "cheat":
      return <CheatSheetPage progress={progress} onBack={back} />;
    case "settings":
      return <SettingsPage progress={progress} onUpdate={onUpdate} onBack={back} />;
    case "backup":
      return (
        <BackupPage
          progress={progress}
          now={now}
          onReplace={onReplace ?? ((next) => progressStore.replaceProgress(next))}
          onBack={back}
        />
      );
    case "about":
      return <AboutPage progress={progress} day={day} onBack={back} />;
    case "menu":
      return (
        <SimplePage className="more">
          <h1 className="page-title">Mehr</h1>
          <ul className="more-menu">
            {MENU.map((entry) => (
              <li key={entry.id}>
                <button type="button" className="more-menu__row" onClick={() => open(entry.id)}>
                  <span className="more-menu__label">{entry.label}</span>
                  <span className="more-menu__detail">{entry.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        </SimplePage>
      );
  }
}
