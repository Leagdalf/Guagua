import { describe, expect, it } from "vitest";
import { createProgressStore } from "../../core/store";
import type { StorageLike } from "../../core/store";
import { allPhrases, phrasebook } from "../../core/content";
import { FAVORITES_CATEGORY_ID, toggleFavoriteInStore, withFavorites } from "./favorites";

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
const now = () => new Date("2026-11-22T10:00:00Z");

describe("Merken im Fortschritt", () => {
  it("Merken und Entmerken ändert favorites und übersteht Serialisieren und Neulesen", () => {
    const storage = memory();
    const store = createProgressStore({ storage, now });
    expect(store.createProfile("Anna")).toBe(true);
    const [a, b] = [allPhrases[0]!.id, allPhrases[5]!.id];

    toggleFavoriteInStore(store, a);
    toggleFavoriteInStore(store, b);
    const read = () => {
      const state = createProgressStore({ storage, now }).getSnapshot();
      return state.status === "ready" ? state.progress.favorites : null;
    };
    expect(read()).toEqual([a, b]);

    toggleFavoriteInStore(store, a);
    const live = store.getSnapshot();
    expect(live.status === "ready" && live.progress.favorites).toEqual([b]);
    expect(read()).toEqual([b]);
  });

  it("ohne Profil passiert nichts und nichts wird geschrieben", () => {
    const storage = memory();
    const store = createProgressStore({ storage, now });
    toggleFavoriteInStore(store, allPhrases[0]!.id);
    expect(store.getSnapshot().status).toBe("empty");
    expect(storage.data.size).toBe(0);
  });
});

describe("withFavorites", () => {
  it("ohne gemerkte Sätze (oder nur unbekannte ids) keine Kategorie „Gemerkt“", () => {
    expect(withFavorites(phrasebook.categories, []).map((c) => c.id)).toEqual(phrasebook.categories.map((c) => c.id));
    expect(withFavorites(phrasebook.categories, ["gibt-es-nicht"])).toHaveLength(phrasebook.categories.length);
  });

  it("mit gemerkten Sätzen steht „Gemerkt“ ganz oben, in der Reihenfolge des Sprachführers, Originale bleiben", () => {
    const late = allPhrases[allPhrases.length - 1]!;
    const early = allPhrases[1]!;
    const result = withFavorites(phrasebook.categories, [late.id, early.id]);
    expect(result[0]).toMatchObject({ id: FAVORITES_CATEGORY_ID, title_de: "Gemerkt" });
    expect(result[0]!.phrases.map((p) => p.id)).toEqual([early.id, late.id]);
    expect(result.slice(1)).toEqual(phrasebook.categories);
    expect(result[1]!.title_de).toBe("Notfall und Gesundheit");
  });
});
