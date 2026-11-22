import { cx } from "./cx";
import { Es } from "./Es";

export interface SentenceWord {
  id: string;
  text: string;
}

export interface SentenceBuilderProps {
  /** Alle Bausteine in fester Reihenfolge. Gesetzte hinterlassen einen leeren Platz. */
  words: readonly SentenceWord[];
  /** Ids der gesetzten Bausteine in der Reihenfolge des Satzes. */
  placed: readonly string[];
  /** Tippen auf einen freien Baustein. */
  onPlace?: (id: string) => void;
  /** Tippen auf ein Wort in der Satzzeile nimmt es zurück. */
  onRemove?: (id: string) => void;
  /** Name der Satzzeile für Screenreader. */
  sentenceLabel?: string;
  /** Name der Bausteine für Screenreader. */
  wordsLabel?: string;
  className?: string;
}

/**
 * Satzbau: oben die Satzzeile auf einer Grundlinie, darunter die Wortknöpfe. Alles Spanisch (Newsreader kursiv, `lang="es"`).
 * Den Hauptknopf „Prüfen“ setzt der Aufrufer; er bleibt gesperrt, bis alle Bausteine gesetzt sind.
 */
export function SentenceBuilder({
  words,
  placed,
  onPlace,
  onRemove,
  sentenceLabel = "Dein Satz",
  wordsLabel = "Bausteine",
  className,
}: SentenceBuilderProps) {
  const byId = new Map(words.map((w) => [w.id, w]));
  const placedSet = new Set(placed);
  return (
    <div className={cx("builder", className)}>
      <div role="group" aria-label={sentenceLabel} className="builder__sentence">
        {placed.map((id) => {
          const word = byId.get(id);
          if (!word) return null;
          return (
            <button key={id} type="button" className="builder__placed" onClick={() => onRemove?.(id)}>
              <Es size="inherit">{word.text}</Es>
            </button>
          );
        })}
      </div>
      <div role="group" aria-label={wordsLabel} className="builder__words">
        {words.map((word) =>
          placedSet.has(word.id) ? (
            <span key={word.id} className="chip chip--empty" aria-hidden="true">
              <Es size="inherit">{word.text}</Es>
            </span>
          ) : (
            <button key={word.id} type="button" className="chip" onClick={() => onPlace?.(word.id)}>
              <Es size="inherit">{word.text}</Es>
            </button>
          ),
        )}
      </div>
    </div>
  );
}
