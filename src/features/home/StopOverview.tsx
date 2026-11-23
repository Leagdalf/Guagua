import { speak, useVoices } from "../../audio";
import { getUnit } from "../../core/content";
import { speakTextOf } from "../../core/tasks";
import { AudioButton, Es, Label, SimplePage, TextButton } from "../../ui";
import { fillName } from "./nameText";
import "./home.css";

export interface StopOverviewProps {
  unitId: string;
  /** Name aus dem Profil, für `{name}` im Dialog. */
  name: string;
  onBack: () => void;
  /** Dialog noch einmal spielen (Spezifikation 2.9, Punkt 10): startet die Lerneinheit ohne Punkte und ohne Wirkung auf den Lernstand. */
  onPlayDialogue: (unitId: string) => void;
}

/**
 * Übersicht einer abgeschlossenen Haltestelle: Karten mit Ton, Grammatik, Dialog zum Wiederanhören.
 * Jeder Ton startet direkt im Tippen auf seinen Knopf.
 */
export function StopOverview({ unitId, name, onBack, onPlayDialogue }: StopOverviewProps) {
  const { hasVoice } = useVoices();
  const unit = getUnit(unitId);
  if (!unit) return null;
  const mute = !hasVoice;
  return (
    <SimplePage className="ov">
      <TextButton onClick={onBack}>Zurück zur Linie</TextButton>
      <Label as="p" tone="accent" className="ov__kicker">
        Haltestelle {unit.stop}
      </Label>
      <Es as="h1" size="card" className="ov__title">
        {unit.title_es}
      </Es>
      <p className="ov__sub">
        {unit.title_de}. {unit.can_do_de}
      </p>

      <section className="ov__sec" aria-labelledby="ov-cards">
        <Label as="h2" id="ov-cards">
          Karten
        </Label>
        <ul className="ov__list">
          {unit.items.map((item) => (
            <li key={item.id} className="ov__row">
              <div className="ov__text">
                <Es id={`ov-${item.id}`}>{item.es}</Es>
                {item.kind === "frame" && item.example && <Es className="ov__example">{item.example.es}</Es>}
                <p className="ov__de">{item.de}</p>
                {item.note_de && <p className="ov__note">{item.note_de}</p>}
              </div>
              <AudioButton disabled={mute} describedBy={`ov-${item.id}`} onClick={() => speak(speakTextOf(item))} />
            </li>
          ))}
        </ul>
      </section>

      <section className="ov__sec" aria-labelledby="ov-grammar">
        <Label as="h2" id="ov-grammar">
          Grammatik
        </Label>
        <h3 className="ov__h3">{unit.grammar.topic_de}</h3>
        <p className="ov__expl">{unit.grammar.explanation_de}</p>
        <table className="ov__table">
          <tbody>
            {unit.grammar.table.map((row) => (
              <tr key={row.label_de + row.es}>
                <th scope="row">{row.label_de}</th>
                <td>
                  <Es>{row.es}</Es>
                </td>
                <td>{row.de}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="ov__list">
          {unit.grammar.examples.map((example, index) => (
            <li key={example.es} className="ov__row">
              <div className="ov__text">
                <Es id={`ov-ex-${index}`}>{example.es}</Es>
                <p className="ov__de">{example.de}</p>
              </div>
              <AudioButton disabled={mute} describedBy={`ov-ex-${index}`} onClick={() => speak(example.es)} />
            </li>
          ))}
        </ul>
      </section>

      <section className="ov__sec" aria-labelledby="ov-dialogue">
        <Label as="h2" id="ov-dialogue">
          Dialog
        </Label>
        <p className="ov__expl">{unit.dialogue.setting_de}</p>
        <div className="ov__play">
          <TextButton onClick={() => onPlayDialogue(unit.id)}>Dialog noch einmal spielen</TextButton>
        </div>
        <ul className="ov__list">
          {unit.dialogue.lines.map((line, index) => (
            <li key={index} className="ov__row">
              <div className="ov__text">
                <p className="ov__speaker">{line.speaker}</p>
                <Es id={`ov-line-${index}`}>{fillName(line.es, name)}</Es>
                <p className="ov__de">{fillName(line.de, name)}</p>
              </div>
              <AudioButton disabled={mute} describedBy={`ov-line-${index}`} onClick={() => speak(line.es)} />
            </li>
          ))}
        </ul>
      </section>
    </SimplePage>
  );
}
