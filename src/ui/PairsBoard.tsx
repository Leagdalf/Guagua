import { cx } from "./cx";
import { Es, Marker } from "./Es";
import { CheckIcon, CrossIcon } from "./icons";

/** selectable: wählbar. selected: gewählt (Marker). found: gefunden (Haken, nicht mehr wählbar). wrong: falsches Paar (Kreuz). */
export type PairState = "selectable" | "selected" | "found" | "wrong";

export interface PairItem {
  id: string;
  text: string;
  state: PairState;
}

export interface PairsBoardProps {
  /** Die spanischen Zeilen, links. Der Baustein setzt Newsreader kursiv und `lang="es"`. */
  left: readonly PairItem[];
  /** Die deutschen Zeilen, rechts. */
  right: readonly PairItem[];
  onSelect?: (side: "left" | "right", id: string) => void;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
}

const STATE_TEXT: Record<PairState, string | null> = {
  selectable: null,
  selected: "gewählt",
  found: "gefunden",
  wrong: "falsch",
};

function PairRow({ item, spanish, onSelect }: { item: PairItem; spanish: boolean; onSelect?: () => void }) {
  const text = spanish ? <Es size="inherit">{item.text}</Es> : item.text;
  const status = STATE_TEXT[item.state];
  return (
    <button
      type="button"
      className={cx("pair", `pair--${item.state}`)}
      onClick={onSelect}
      disabled={item.state === "found"}
      aria-pressed={item.state === "selected" ? true : undefined}
    >
      <span className="pair__text">{item.state === "selected" ? <Marker>{text}</Marker> : text}</span>
      <span className="pair__mark" aria-hidden="true">
        {item.state === "found" ? <CheckIcon /> : item.state === "wrong" ? <CrossIcon /> : null}
      </span>
      {(item.state === "found" || item.state === "wrong") && <span className="vh">{status}</span>}
    </button>
  );
}

/**
 * Paare: zwei Spalten, links Spanisch, rechts Deutsch. Gebaut wie Antwortzeilen, aber ohne Auswahlkreis.
 * Gewählt: Marker. Gefunden: ceniza mit Haken. Falsch: Kreuz an beiden Zeilen. Zeigt nur an, die Logik liegt beim Aufrufer.
 */
export function PairsBoard({ left, right, onSelect, leftLabel = "Spanisch", rightLabel = "Deutsch", className }: PairsBoardProps) {
  return (
    <div className={cx("pairs", className)}>
      <div role="group" aria-label={leftLabel} className="pairs__col">
        {left.map((item) => (
          <PairRow key={item.id} item={item} spanish onSelect={() => onSelect?.("left", item.id)} />
        ))}
      </div>
      <div role="group" aria-label={rightLabel} className="pairs__col">
        {right.map((item) => (
          <PairRow key={item.id} item={item} spanish={false} onSelect={() => onSelect?.("right", item.id)} />
        ))}
      </div>
    </div>
  );
}
