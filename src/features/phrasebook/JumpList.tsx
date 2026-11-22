import type { PhraseCategory } from "../../core/types";
import { categoryHeadingId } from "./PhrasebookResults";

export interface JumpListProps {
  categories: readonly Pick<PhraseCategory, "id" | "title_de">[];
}

/** Springt zur Überschrift und setzt den Fokus dorthin, damit Screenreader und Tastatur mitgehen. */
function handleJump(targetId: string) {
  const heading = document.getElementById(targetId);
  if (!heading) return;
  heading.setAttribute("tabindex", "-1");
  heading.scrollIntoView({ block: "start" });
  heading.focus({ preventScroll: true });
}

/** Sprungliste: die Kategorien als umbrechende Reihe von Textknöpfen unter dem Suchfeld. */
export function JumpList({ categories }: JumpListProps) {
  return (
    <nav className="pb-jump" aria-label="Kategorien">
      {categories.map((category) => {
        const target = categoryHeadingId(category.id);
        return (
          <button key={category.id} type="button" className="text-btn pb-jump__btn" data-target={target} onClick={() => handleJump(target)}>
            {category.title_de}
          </button>
        );
      })}
    </nav>
  );
}
