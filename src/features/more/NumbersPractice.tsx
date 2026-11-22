import { useState } from "react";
import type { FormEvent } from "react";
import { speak } from "../../audio";
import { AudioButton, Es, Label, PrimaryButton, TextButton } from "../../ui";
import { checkTyped, resultLine, spokenText } from "./numbersModel";
import type { PracticeResult, PracticeTask } from "./numbersModel";
import { SubPage } from "./SubPage";

export interface NumbersPracticeProps {
  /** Die Aufgaben dieser Runde. Der Ton der ersten Zahl startete schon im Tippen auf „Zahlen üben“. */
  tasks: readonly PracticeTask[];
  /** Ohne spanische Stimme sind die Tonknöpfe gesperrt. */
  hasVoice: boolean;
  /** Zurück zum Spickzettel. */
  onClose: () => void;
  /** Neue Runde. Der Aufrufer spricht die erste Zahl in dieser Klick-Behandlung. */
  onAgain: () => void;
  /** Nur für Tests: Aufgabe, mit der die Ansicht beginnt, und fertige Antwort dazu. */
  initialIndex?: number;
  initialResult?: PracticeResult | null;
}

/**
 * Zahlen üben (Spezifikation 2.9, Punkt 11): Die Ansicht zeigt keine Zahl, nur Tonknöpfe und ein Feld für Ziffern. Keine Wertung,
 * keine Punkte, kein Eintrag im Lernstand. Der Ton der nächsten Zahl startet im Tippen auf „Weiter“.
 */
export function NumbersPractice({ tasks, hasVoice, onClose, onAgain, initialIndex = 0, initialResult = null }: NumbersPracticeProps) {
  const [index, setIndex] = useState(initialIndex);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<PracticeResult | null>(initialResult);
  const [finished, setFinished] = useState(false);

  const task = tasks[index];
  const last = index >= tasks.length - 1;

  if (finished || !task) {
    return (
      <SubPage title="Zahlen üben" onBack={onClose}>
        <p className="page-lead" role="status">
          Die {tasks.length} Aufgaben sind durch. Es gibt dafür keine Punkte und keinen Eintrag in deinem Lernstand.
        </p>
        <div className="more__actions">
          <PrimaryButton onClick={onAgain} disabled={!hasVoice}>
            Noch einmal
          </PrimaryButton>
          <TextButton onClick={onClose}>Zum Spickzettel</TextButton>
        </div>
      </SubPage>
    );
  }

  const handleNext = (): void => {
    if (last) {
      setFinished(true);
      return;
    }
    const next = tasks[index + 1];
    setIndex(index + 1);
    setInput("");
    setResult(null);
    if (next) speak(spokenText(next));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (result) {
      handleNext();
      return;
    }
    if (input.trim().length === 0) return;
    setResult(checkTyped(task, input));
  };

  const text = spokenText(task);

  return (
    <SubPage title="Zahlen üben" onBack={onClose}>
      <Label as="p">
        Aufgabe {index + 1} von {tasks.length}
      </Label>
      <p className="sec__text">Höre die Zahl oder den Preis und tippe die Ziffern. Bei Preisen darfst du Komma oder Punkt benutzen.</p>
      <div className="more__actions">
        <AudioButton disabled={!hasVoice} onClick={() => speak(text)} />
        <AudioButton variant="slow" disabled={!hasVoice} onClick={() => speak(text, { slow: true })} />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field sec__text">
          <label className="label field__label" htmlFor="numbers-input">
            Deine Ziffern
          </label>
          <input
            id="numbers-input"
            className="field__input"
            type="text"
            inputMode="decimal"
            pattern="[0-9.,]*"
            enterKeyHint={result ? "next" : "done"}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={input}
            readOnly={result !== null}
            onChange={(event) => setInput(event.target.value)}
          />
        </div>

        {result && (
          <div className="more__msg" role="status">
            <p>{resultLine(result)}</p>
            <Es as="p">{result.spanish}</Es>
          </div>
        )}

        <div className="more__actions">
          <PrimaryButton type="submit" disabled={!result && input.trim().length === 0}>
            {result ? (last ? "Fertig" : "Weiter") : "Prüfen"}
          </PrimaryButton>
        </div>
      </form>
    </SubPage>
  );
}
