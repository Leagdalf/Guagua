import type { Day, Progress } from "../../core/types";
import { SummaryList } from "../../ui";
import { AI_NOTE, aboutRows, FONT_LICENSES, formatMinutes, learningRows, learningTime, targetText } from "./aboutModel";
import { SubPage } from "./SubPage";

export interface AboutPageProps {
  progress: Progress;
  day: Day;
  onBack: () => void;
}

/** Über die App: Version, Stand der Inhalte, Punkte und Serie (nicht im Ruhemodus), Lernzeit je Tag, Lizenzen. */
export function AboutPage({ progress, day, onBack }: AboutPageProps) {
  const time = learningTime(progress);
  return (
    <SubPage title="Über die App" onBack={onBack}>
      <SummaryList items={aboutRows(progress, day)} />

      <section className="sec" aria-labelledby="about-time">
        <h2 className="sec__title" id="about-time">
          Lernzeit je Tag
        </h2>
        {time.days.length === 0 ? (
          <p className="sec__text">Noch keine Lernzeit gemessen. Die App zählt die Zeit, in der du in einer Lerneinheit aktiv bist.</p>
        ) : (
          <>
            <SummaryList className="sec__text" items={learningRows(time)} />
            <SummaryList
              className="sec__text"
              items={[
                { label: "Summe", value: formatMinutes(time.totalMs) },
                { label: "Median", value: formatMinutes(time.medianMs ?? 0) },
              ]}
            />
          </>
        )}
        <p className="sec__muted">{targetText()}</p>
      </section>

      <p className="sec__muted">
        Schriften:{" "}
        {FONT_LICENSES.map((font, index) => (
          <span key={font.name}>
            {index > 0 && ", "}
            {font.name} ({font.license})
          </span>
        ))}
        .
      </p>
      <p className="sec__text">{AI_NOTE}</p>
    </SubPage>
  );
}
