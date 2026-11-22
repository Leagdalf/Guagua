import { useCallback, useState } from "react";
import { NoVoiceNotice, useVoices } from "../../audio";
import { phrasebook } from "../../core/content";
import { progressStore, useStoreState } from "../../state";
import { SimplePage, TextField } from "../../ui";
import { toggleFavoriteInStore } from "./favorites";
import { JumpList } from "./JumpList";
import { PhrasebookResults } from "./PhrasebookResults";
import { ShowPortal } from "./ShowOverlay";
import "./phrasebook.css";

const toggleFavorite = (id: string) => toggleFavoriteInStore(progressStore, id);

/**
 * Sprachführer (docs/02-spezifikation.md, 2.6): Suche, Kategorien, Anhören, Sterne zum Merken, Vollbild „Zeigen“.
 * Braucht keine Props. Gehört in `AppShell`, das das einzige `main` liefert. Überschriften: h1 „Sprachführer“, h2 je Kategorie.
 * Ohne Profil (Speicher nicht bereit) gibt es keine Sterne; der Rest läuft.
 */
export function PhrasebookView({ initialQuery = "" }: { initialQuery?: string } = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [shown, setShown] = useState<{ es: string; de: string } | null>(null);
  const { hasVoice } = useVoices();
  const store = useStoreState();
  const close = useCallback(() => setShown(null), []);

  return (
    <>
      <NoVoiceNotice />
      <SimplePage className="pb">
        <h1 className="pb-title">Sprachführer</h1>
        <TextField
          className="pb-search"
          label="Suchen"
          type="search"
          placeholder="Spanisch oder Deutsch"
          value={query}
          onChange={setQuery}
          enterKeyHint="search"
        />
        {query.trim() === "" ? <JumpList categories={phrasebook.categories} /> : null}
        <PhrasebookResults
          query={query}
          hasVoice={hasVoice}
          favorites={store.status === "ready" ? store.progress.favorites : null}
          onToggleFavorite={toggleFavorite}
          onShow={setShown}
        />
      </SimplePage>
      {shown ? <ShowPortal phrase={shown} hasVoice={hasVoice} onClose={close} /> : null}
    </>
  );
}
