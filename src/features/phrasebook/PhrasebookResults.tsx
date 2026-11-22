import { speak } from "../../audio";
import { allItems, phrasebook, unitOfItem } from "../../core/content";
import { AudioButton, Es, Label } from "../../ui";
import { buildSections, type PhraseRow, type Section } from "./rows";
import { StarIcon } from "./StarIcon";

/** Id der Überschrift einer Kategorie; die Sprungliste springt dorthin. */
export function categoryHeadingId(categoryId: string): string {
  return `pb-cat-${categoryId}`;
}

export interface PhrasebookResultsProps {
  query: string;
  hasVoice: boolean;
  /**
   * Gemerkte Sätze und Karten (ids). `null` oder weggelassen: kein Profil, dann gibt es keine Sterne und keine Kategorie „Gemerkt“.
   */
  favorites?: readonly string[] | null;
  onToggleFavorite?: (id: string) => void;
  /** Öffnet den Satz im Vollbild. Ohne diese Eigenschaft gibt es keinen Knopf „Zeigen“. */
  onShow?: (phrase: { es: string; de: string }) => void;
}

/**
 * Kategorien und Sätze zur Suche, bei einer Suche danach „Aus dem Kurs“ mit den Lernkarten, oder der leere Zustand mit Text.
 * Überschriften: h2 je Kategorie unter dem h1 der Ansicht.
 */
export function PhrasebookResults({ query, hasVoice, favorites, onToggleFavorite, onShow }: PhrasebookResultsProps) {
  const marked = favorites ?? [];
  const { sections, course } = buildSections({
    categories: phrasebook.categories,
    items: allItems,
    unitOfItem,
    favorites: favorites ?? null,
    query,
  });
  const canStar = favorites != null && onToggleFavorite !== undefined;

  if (sections.length === 0 && course === null) {
    return (
      <p className="pb-empty" role="status">
        Nichts gefunden für „{query.trim()}“. Probiere ein anderes Wort, auf Spanisch oder Deutsch.
      </p>
    );
  }

  const all: Section[] = course ? [...sections, course] : sections;

  return (
    <>
      {all.map((section) => (
        <section key={section.id} className="pb-category" aria-labelledby={categoryHeadingId(section.id)}>
          <Label as="h2" id={categoryHeadingId(section.id)}>
            {section.title_de}
          </Label>
          {section.note_de ? <p className="pb-cat-note">{section.note_de}</p> : null}
          <ul className="pb-list">
            {section.rows.map((row) => (
              <Row
                key={row.id}
                row={row}
                sectionId={section.id}
                hasVoice={hasVoice}
                isMarked={marked.includes(row.id)}
                canStar={canStar}
                onToggleFavorite={onToggleFavorite}
                onShow={onShow}
              />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

interface RowProps {
  row: PhraseRow;
  sectionId: string;
  hasVoice: boolean;
  isMarked: boolean;
  canStar: boolean;
  onToggleFavorite: ((id: string) => void) | undefined;
  onShow: ((phrase: { es: string; de: string }) => void) | undefined;
}

function Row({ row, sectionId, hasVoice, isMarked, canStar, onToggleFavorite, onShow }: RowProps) {
  // Eine Zeile kann in „Gemerkt“, in ihrer Kategorie und in „Aus dem Kurs“ stehen: die id des Textes trägt den Abschnitt.
  const esId = `pb-es-${sectionId}-${row.id}`;
  const spokenId = row.example ? `${esId}-example` : esId;
  return (
    <li className="pb-row">
      <div className="pb-text">
        <Es as="p" id={esId}>
          {row.es}
        </Es>
        <p className="pb-de">{row.de}</p>
        {row.example ? (
          <>
            <Es as="p" id={spokenId} className="pb-example">
              {row.example.es}
            </Es>
            <p className="pb-de">{row.example.de}</p>
          </>
        ) : null}
        {row.note_de ? <p className="pb-note">{row.note_de}</p> : null}
        {row.origin ? (
          <p className="pb-origin">
            Haltestelle {row.origin.stop} · <Es as="span" size="inherit">{row.origin.title_es}</Es>
          </p>
        ) : null}
      </div>
      <div className="pb-actions">
        <AudioButton onClick={() => speak(row.speakText)} disabled={!hasVoice} describedBy={spokenId} />
        {onShow ? (
          <button type="button" className="text-btn pb-show-btn" aria-describedby={spokenId} onClick={() => onShow(row.show)}>
            Zeigen
          </button>
        ) : null}
        {canStar && onToggleFavorite ? (
          <button
            type="button"
            className={isMarked ? "text-btn pb-star pb-star--on" : "text-btn pb-star"}
            aria-label={isMarked ? "Nicht mehr merken" : "Merken"}
            aria-describedby={spokenId}
            onClick={() => onToggleFavorite(row.id)}
          >
            <StarIcon />
          </button>
        ) : null}
      </div>
    </li>
  );
}
