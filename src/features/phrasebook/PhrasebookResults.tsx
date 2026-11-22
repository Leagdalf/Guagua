import { speak } from "../../audio";
import { phrasebook } from "../../core/content";
import type { Phrase } from "../../core/types";
import { AudioButton, Es, Label } from "../../ui";
import { withFavorites } from "./favorites";
import { searchPhrasebook } from "./search";
import { StarIcon } from "./StarIcon";

export interface PhrasebookResultsProps {
  query: string;
  hasVoice: boolean;
  /**
   * Gemerkte Sätze (ids). `null` oder weggelassen: kein Profil, dann gibt es keine Sterne und keine Kategorie „Gemerkt“.
   */
  favorites?: readonly string[] | null;
  onToggleFavorite?: (id: string) => void;
  /** Öffnet den Satz im Vollbild. Ohne diese Eigenschaft gibt es keinen Knopf „Zeigen“. */
  onShow?: (phrase: Phrase) => void;
}

/** Kategorien und Sätze zur Suche, oder der leere Zustand mit Text. Überschriften: h2 je Kategorie unter dem h1 der Ansicht. */
export function PhrasebookResults({ query, hasVoice, favorites, onToggleFavorite, onShow }: PhrasebookResultsProps) {
  const marked = favorites ?? [];
  const categories = searchPhrasebook(favorites ? withFavorites(phrasebook.categories, marked) : phrasebook.categories, query);
  const canStar = favorites != null && onToggleFavorite !== undefined;

  if (categories.length === 0) {
    return (
      <p className="pb-empty" role="status">
        Nichts gefunden für „{query.trim()}“. Probiere ein anderes Wort, auf Spanisch oder Deutsch.
      </p>
    );
  }

  return (
    <>
      {categories.map((category) => (
        <section key={category.id} className="pb-category" aria-labelledby={`pb-cat-${category.id}`}>
          <Label as="h2" id={`pb-cat-${category.id}`}>
            {category.title_de}
          </Label>
          {category.note_de ? <p className="pb-cat-note">{category.note_de}</p> : null}
          <ul className="pb-list">
            {category.phrases.map((phrase) => {
              // Ein Satz kann in „Gemerkt“ und in seiner Kategorie stehen: die id des Textes trägt die Kategorie.
              const esId = `pb-es-${category.id}-${phrase.id}`;
              const isMarked = marked.includes(phrase.id);
              return (
                <li key={phrase.id} className="pb-row">
                  <div className="pb-text">
                    <Es as="p" id={esId}>
                      {phrase.es}
                    </Es>
                    <p className="pb-de">{phrase.de}</p>
                    {phrase.note_de ? <p className="pb-note">{phrase.note_de}</p> : null}
                  </div>
                  <div className="pb-actions">
                    <AudioButton onClick={() => speak(phrase.es)} disabled={!hasVoice} describedBy={esId} />
                    {onShow ? (
                      <button type="button" className="text-btn pb-show-btn" aria-describedby={esId} onClick={() => onShow(phrase)}>
                        Zeigen
                      </button>
                    ) : null}
                    {canStar ? (
                      <button
                        type="button"
                        className={isMarked ? "text-btn pb-star pb-star--on" : "text-btn pb-star"}
                        aria-label={isMarked ? "Nicht mehr merken" : "Merken"}
                        aria-describedby={esId}
                        onClick={() => onToggleFavorite(phrase.id)}
                      >
                        <StarIcon />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
