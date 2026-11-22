import { allItems, course, units } from "./core/content";

// Platzhalter aus AP0. AP5 ersetzt diese Datei durch die Ansichten der App.
export function App() {
  return (
    <main>
      <h1>{course.title_de}</h1>
      <p>
        {units.length} Haltestellen, {allItems.length} Lernkarten. Das Gerüst steht, die Ansichten folgen.
      </p>
    </main>
  );
}
