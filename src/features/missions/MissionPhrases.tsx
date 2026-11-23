import { useState } from "react";
import { speak, useVoices } from "../../audio";
import { AudioButton, Es } from "../../ui";
import { ShowPortal } from "../phrasebook/ShowOverlay";
import "../phrasebook/phrasebook.css";
import { toggledIndex } from "./missionsModel";
import "./missionPhrases.css";

export interface MissionPhrasesProps {
  /** Vorsatz für die ids der Sätze, damit sie auf der Seite eindeutig bleiben. */
  idPrefix: string;
  /** Spanische Sätze zum Mitnehmen. */
  phrases: readonly string[];
  /** Übersetzung je Satz, `null` wo sie fehlt: Dann fehlt nur der Knopf zum Aufdecken. */
  translations: readonly (string | null)[];
}

/**
 * Sätze zum Mitnehmen einer Mission (Spezifikation 2.9, Punkt 4): Jeder Satz hat Anhören, Langsam, Zeigen
 * (das Vollbild aus dem Sprachführer) und, wenn vorhanden, eine aufdeckbare Übersetzung.
 * Der Ton startet jeweils direkt im Tippen auf seinen Knopf.
 */
export function MissionPhrases({ idPrefix, phrases, translations }: MissionPhrasesProps) {
  const { hasVoice } = useVoices();
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  const [shown, setShown] = useState<number | null>(null);

  const toggle = (index: number): void => setRevealed((current) => toggledIndex(current, index));

  const shownPhrase = shown === null ? undefined : phrases[shown];

  return (
    <>
      <ul className="mp">
        {phrases.map((phrase, index) => {
          const id = `${idPrefix}-say-${index}`;
          const de = translations[index] ?? null;
          const open = revealed.has(index);
          return (
            <li key={phrase} className="mp__item">
              <Es as="p" id={id}>
                {phrase}
              </Es>
              <div className="mp__actions">
                <AudioButton disabled={!hasVoice} describedBy={id} onClick={() => speak(phrase)} />
                <AudioButton variant="slow" disabled={!hasVoice} describedBy={id} onClick={() => speak(phrase, { slow: true })} />
                <button type="button" className="text-btn" aria-describedby={id} onClick={() => setShown(index)}>
                  Zeigen
                </button>
                {de !== null && (
                  <button
                    type="button"
                    className="text-btn"
                    aria-describedby={id}
                    aria-expanded={open}
                    aria-controls={`${id}-de`}
                    onClick={() => toggle(index)}
                  >
                    {open ? "Übersetzung verdecken" : "Übersetzung aufdecken"}
                  </button>
                )}
              </div>
              {de !== null && open && (
                <p className="mp__de" id={`${id}-de`}>
                  {de}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {shownPhrase !== undefined && shown !== null ? (
        <ShowPortal phrase={{ es: shownPhrase, de: translations[shown] ?? "" }} hasVoice={hasVoice} onClose={() => setShown(null)} />
      ) : null}
    </>
  );
}
