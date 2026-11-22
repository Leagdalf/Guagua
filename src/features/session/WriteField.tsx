import { useLayoutEffect, useRef } from "react";
import { TextField } from "../../ui";
import { insertAtCaret, SPECIAL_CHARS } from "./writeInput";

export interface WriteFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Eingabetaste im Feld: wie „Prüfen“. */
  onSubmit: () => void;
  disabled?: boolean;
}

/**
 * Eingabefeld für Spanisch mit Reihe der Zeichenknöpfe (á é í ó ú ñ ü ¿ ¡). Das Feld schaltet Autokorrektur, automatische
 * Großschreibung und Rechtschreibprüfung ab und trägt `lang="es"` (`TextField` mit `spanish`). Ein Zeichenknopf fügt an der
 * Schreibmarke ein und lässt den Fokus im Feld, damit die Tastatur stehen bleibt.
 */
export function WriteField({ value, onChange, onSubmit, disabled }: WriteFieldProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const caret = useRef<number | null>(null);

  // Nach dem Einfügen steht die Schreibmarke hinter dem neuen Zeichen.
  useLayoutEffect(() => {
    if (caret.current === null) return;
    const input = wrap.current?.querySelector("input");
    if (input) {
      input.focus();
      input.setSelectionRange(caret.current, caret.current);
    }
    caret.current = null;
  });

  const insert = (char: string): void => {
    const input = wrap.current?.querySelector("input");
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? start;
    const next = insertAtCaret(value, start, end, char);
    caret.current = next.caret;
    onChange(next.value);
  };

  return (
    <div ref={wrap} className="sx-write">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) onSubmit();
        }}
      >
        <TextField label="Deine Antwort" spanish value={value} onChange={onChange} disabled={disabled} enterKeyHint="go" />
      </form>
      <div className="sx-chars" role="group" aria-label="Sonderzeichen">
        {SPECIAL_CHARS.map((char) => (
          <button
            key={char}
            type="button"
            lang="es"
            className="sx-char es"
            aria-label={`${char} einfügen`}
            disabled={disabled}
            // Der Fokus bleibt im Feld, sonst schließt sich die Tastatur bei jedem Tippen.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insert(char)}
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
}
