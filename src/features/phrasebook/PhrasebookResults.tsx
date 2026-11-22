import { speak } from "../../audio";
import { phrasebook } from "../../core/content";
import { AudioButton, Es, Label } from "../../ui";
import { searchPhrasebook } from "./search";

/** Kategorien und Sätze zur Suche, oder der leere Zustand mit Text. Überschriften: h2 je Kategorie unter dem h1 der Ansicht. */
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
          <Label as="h2" id={`pb-cat-${category.id}`}>
            {category.title_de}
          </Label>
          {category.note_de ? <p className="pb-cat-note">{category.note_de}</p> : null}
          <ul className="pb-list">
            {category.phrases.map((phrase) => (
              <li key={phrase.id} className="pb-row">
                <div className="pb-text">
                  <Es as="p" id={`pb-es-${phrase.id}`}>
                    {phrase.es}
                  </Es>
                  <p className="pb-de">{phrase.de}</p>
                  {phrase.note_de ? <p className="pb-note">{phrase.note_de}</p> : null}
                </div>
                <AudioButton
                  onClick={() => speak(phrase.es)}
                  disabled={!hasVoice}
                  describedBy={`pb-es-${phrase.id}`}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
