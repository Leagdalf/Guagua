import { useState } from "react";
import { NoVoiceNotice, useVoices } from "../../audio";
import { PhrasebookResults } from "./PhrasebookResults";
import "./phrasebook.css";

/** Sprachführer (docs/02-spezifikation.md, 2.6), MVP ohne Sterne und „Zeigen“. Braucht keine Props. */
export function PhrasebookView() {
  const [query, setQuery] = useState("");
  const { hasVoice } = useVoices();

  return (
    <main className="pb">
      <h1 className="pb-title">Sprachführer</h1>
      <NoVoiceNotice />

      <label className="pb-search">
        <span className="pb-label">Suchen</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Spanisch oder Deutsch"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
      </label>

      <PhrasebookResults query={query} hasVoice={hasVoice} />
    </main>
  );
}
