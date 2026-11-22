import { speak } from "../../audio";
import { phrasebook } from "../../core/content";
import { SpanishText, SpeakButton } from "./parts";
import { searchPhrasebook } from "./search";

/** Kategorien und Sätze zur Suche, oder der leere Zustand mit Text. */
export function PhrasebookResults({ query, hasVoice }: { query: string; hasVoice: boolean }) {
  const categories = searchPhrasebook(phrasebook.categories, query);

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
          <h2 id={`pb-cat-${category.id}`} className="pb-label pb-cat-title">
            {category.title_de}
          </h2>
          {category.note_de ? <p className="pb-cat-note">{category.note_de}</p> : null}
          <ul className="pb-list">
            {category.phrases.map((phrase) => (
              <li key={phrase.id} className="pb-row">
                <div className="pb-text">
                  <SpanishText>{phrase.es}</SpanishText>
                  <p className="pb-de">{phrase.de}</p>
                  {phrase.note_de ? <p className="pb-note">{phrase.note_de}</p> : null}
                </div>
                <SpeakButton onSpeak={() => speak(phrase.es)} disabled={!hasVoice} label={phrase.es} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
