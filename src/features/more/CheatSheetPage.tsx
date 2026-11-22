import { useState } from "react";
import { speak, useVoices } from "../../audio";
import { speakTextOf } from "../../core/tasks";
import type { Item, Progress } from "../../core/types";
import { newRng } from "../../state";
import { AudioButton, Es, Label, PrimaryButton } from "../../ui";
import { NO_GRAMMAR_TEXT, numberRows, oftenWrongItems, pronunciationTips, startedGrammar, weekdayRows } from "./cheatModel";
import type { CheatGrammar } from "./cheatModel";
import { NumbersPractice } from "./NumbersPractice";
import { NEEDS_VOICE_TEXT, makeNumberTasks, spokenText } from "./numbersModel";
import type { PracticeTask } from "./numbersModel";
import { SubPage } from "./SubPage";

export interface CheatSheetPageProps {
  progress: Progress;
  onBack: () => void;
}

/** Spickzettel (Spezifikation 2.7): Grammatik begonnener Haltestellen, Zahlen 0 bis 100 mit Übung, Wochentage, oft falsche Karten, Aussprache. */
export function CheatSheetPage({ progress, onBack }: CheatSheetPageProps) {
  const { hasVoice } = useVoices();
  const [practice, setPractice] = useState<{ tasks: PracticeTask[]; round: number } | null>(null);
  const grammar = startedGrammar(progress);
  const wrong = oftenWrongItems(progress);
  const tips = pronunciationTips();

  // Der Ton der ersten Zahl startet direkt im Tippen auf „Zahlen üben“ (iOS verlangt die Geste).
  const handleStartPractice = (): void => {
    const tasks = makeNumberTasks(newRng());
    const first = tasks[0];
    setPractice({ tasks, round: (practice?.round ?? 0) + 1 });
    if (first) speak(spokenText(first));
  };

  if (practice) {
    return (
      <NumbersPractice
        key={practice.round}
        tasks={practice.tasks}
        hasVoice={hasVoice}
        onClose={() => setPractice(null)}
        onAgain={handleStartPractice}
      />
    );
  }

  return (
    <SubPage title="Spickzettel" onBack={onBack}>
      <section className="sec" aria-labelledby="cheat-grammar">
        <h2 className="sec__title" id="cheat-grammar">
          Grammatik
        </h2>
        {grammar.length === 0 ? (
          <p className="sec__text">{NO_GRAMMAR_TEXT}</p>
        ) : (
          grammar.map((entry) => <GrammarBlock key={entry.unitId} entry={entry} hasVoice={hasVoice} />)
        )}
      </section>

      {wrong.length > 0 && (
        <section className="sec" aria-labelledby="cheat-wrong">
          <h2 className="sec__title" id="cheat-wrong">
            Oft falsch
          </h2>
          <p className="sec__muted">Karten, bei denen du mindestens zweimal danebenlagst.</p>
          <ul className="examples">
            {wrong.map((item) => (
              <WrongRow key={item.id} item={item} hasVoice={hasVoice} />
            ))}
          </ul>
        </section>
      )}

      <section className="sec" aria-labelledby="cheat-numbers">
        <h2 className="sec__title" id="cheat-numbers">
          Zahlen von 0 bis 100
        </h2>
        <p className="sec__muted">Tippe eine Zahl, um sie zu hören.</p>
        <ul className="ref-list ref-list--numbers">
          {numberRows().map((row) => (
            <li key={row.n}>
              <button type="button" className="ref__cell" disabled={!hasVoice} onClick={() => speak(row.es)}>
                <span className="ref__n">{row.n}</span>
                <Es>{row.es}</Es>
              </button>
            </li>
          ))}
        </ul>
        <p className="sec__text">Zehn Aufgaben mit Zahlen und Preisen: Du hörst, du tippst die Ziffern. Es gibt keine Punkte.</p>
        <div className="more__actions">
          <PrimaryButton disabled={!hasVoice} onClick={handleStartPractice}>
            Zahlen üben
          </PrimaryButton>
        </div>
        {!hasVoice && <p className="sec__muted">{NEEDS_VOICE_TEXT}</p>}
      </section>

      <section className="sec" aria-labelledby="cheat-weekdays">
        <h2 className="sec__title" id="cheat-weekdays">
          Wochentage
        </h2>
        <ul className="ref-list">
          {weekdayRows().map((row) => (
            <li key={row.es}>
              <button type="button" className="ref__cell" disabled={!hasVoice} onClick={() => speak(row.es)}>
                <Es className="ref__wide">{row.es}</Es>
                <span className="ref__de">{row.de}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {tips.length > 0 && (
        <section className="sec" aria-labelledby="cheat-sound">
          <h2 className="sec__title" id="cheat-sound">
            Aussprache
          </h2>
          <ul className="tips">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      )}
    </SubPage>
  );
}

/** Zeile einer oft falschen Karte: Spanisch, Deutsch, Tonknopf. Bei Satzmustern spricht der Knopf den Beispielsatz. */
function WrongRow({ item, hasVoice }: { item: Item; hasVoice: boolean }) {
  const id = `wrong-${item.id}`;
  const spoken = speakTextOf(item);
  return (
    <li>
      <div>
        <Es as="p" id={id}>
          {item.example ? item.example.es : item.es}
        </Es>
        <p className="examples__de">{item.example ? item.example.de : item.de}</p>
        {item.example && (
          <p className="examples__de">
            Muster: <Es as="span" size="inherit">{item.es}</Es> · {item.de}
          </p>
        )}
      </div>
      <AudioButton disabled={!hasVoice} describedBy={id} onClick={() => speak(spoken)} />
    </li>
  );
}

function GrammarBlock({ entry, hasVoice }: { entry: CheatGrammar; hasVoice: boolean }) {
  const { grammar } = entry;
  return (
    <div className="gram">
      <Label as="h3" section>
        Haltestelle {entry.stop} · {entry.titleDe}
      </Label>
      <p className="gram__topic">{grammar.topic_de}</p>
      <p className="sec__text">{grammar.explanation_de}</p>
      <table className="gtable">
        <caption className="vh">Tabelle: {grammar.topic_de}</caption>
        <tbody>
          {grammar.table.map((row) => (
            <tr key={row.label_de}>
              <th scope="row">{row.label_de}</th>
              <td>
                <Es>{row.es}</Es>
              </td>
              <td>{row.de}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="examples">
        {grammar.examples.map((example, index) => {
          const id = `ex-${entry.unitId}-${index}`;
          return (
            <li key={id}>
              <div>
                <Es as="p" id={id}>
                  {example.es}
                </Es>
                <p className="examples__de">{example.de}</p>
              </div>
              <AudioButton disabled={!hasVoice} describedBy={id} onClick={() => speak(example.es)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
