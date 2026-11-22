import { Fragment } from "react";
import { Es, Label, Marker } from "../../ui";
import type { TodayBlock } from "./todayBlock";

/**
 * Block „Heute“ ohne Hauptknopf. Wie `Today` aus src/ui, aber die Erklärzeile darf spanische Wörter mit `lang="es"` enthalten.
 * Nutzt dieselben Klassen (`home__today`, `today__*`) und damit dieselben Maße.
 */
export function TodayView({ block }: { block: TodayBlock }) {
  return (
    <div className="home__today">
      <Label tone="accent">{block.label}</Label>
      {block.titleLang === "es" ? (
        <Es as="h1" size="today" className="today__title">
          <Marker>{block.title}</Marker>
        </Es>
      ) : (
        <h1 className="today__title today__title--de">{block.title}</h1>
      )}
      <p className="today__text">
        {block.text.map((part, index) =>
          typeof part === "string" ? <Fragment key={index}>{part}</Fragment> : (
            <Es key={index} size="inherit">
              {part.es}
            </Es>
          ),
        )}
      </p>
    </div>
  );
}
