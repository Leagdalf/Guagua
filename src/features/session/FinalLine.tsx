import type { Day, Progress } from "../../core/types";
import { Label, Mountain, SummaryList } from "../../ui";
import { finalLineText } from "./finalLineText";
import { mountainStops } from "./machine";
import "./session.css";

/**
 * „Deine Linie“ nach der Endstation: der Berg im Endzustand, eine Zeile, darunter die Liste mit Haarlinien.
 * Gehört in eine Spalte (Lerneinheit oder einfache Seite). Zeigt nur an, ohne Ton.
 */
export function FinalLineBody({ progress, day }: { progress: Progress; day: Day }) {
  const text = finalLineText(progress, day);
  return (
    <div className="sx-body enter" key="line">
      <div className="sx-mountain">
        <Mountain stops={mountainStops(progress)} />
      </div>
      <Label as="h1" className="sx-section">
        Deine Linie
      </Label>
      <p className="sx-headline">{text.headline}</p>
      {text.notes.map((note) => (
        <p key={note} className="sx-note">
          {note}
        </p>
      ))}
      <SummaryList className="sx-summary" items={text.lines} />
    </div>
  );
}
