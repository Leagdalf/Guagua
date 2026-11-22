import { useState } from "react";
import { NoVoiceNotice, useVoices } from "../../audio";
import { SimplePage, TextField } from "../../ui";
import { PhrasebookResults } from "./PhrasebookResults";
import "./phrasebook.css";

/**
 * Sprachführer (docs/02-spezifikation.md, 2.6), MVP ohne Sterne und „Zeigen“. Braucht keine Props.
 * Gehört in `AppShell`, das das einzige `main` liefert. Überschriften: h1 „Sprachführer“, h2 je Kategorie.
 */
export function PhrasebookView() {
  const [query, setQuery] = useState("");
  const { hasVoice } = useVoices();

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
        <PhrasebookResults query={query} hasVoice={hasVoice} />
      </SimplePage>
    </>
  );
}
