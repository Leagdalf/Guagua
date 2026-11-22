import { speak, useVoices } from "../../audio";
import type { Progress } from "../../core/types";
import { AudioButton, Es, Label } from "../../ui";
import { NO_GRAMMAR_TEXT, numberRows, pronunciationTips, startedGrammar, weekdayRows } from "./cheatModel";
import type { CheatGrammar } from "./cheatModel";
import { SubPage } from "./SubPage";

export interface CheatSheetPageProps {
  progress: Progress;
  onBack: () => void;
}

/** Spickzettel (Spezifikation 2.7): Grammatik begonnener Haltestellen, Zahlen 0 bis 100, Wochentage, Aussprache. */
export function CheatSheetPage({ progress, onBack }: CheatSheetPageProps) {
  const { hasVoice } = useVoices();
  const grammar = startedGrammar(progress);
  const tips = pronunciationTips();

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
