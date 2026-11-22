import { cx } from "./cx";
import { Es, Marker } from "./Es";
import { Label } from "./layout";
import { StopDot } from "./StopDot";
import type { StopState } from "./types";

export interface LineStop {
  id: string;
  /** Spanischer Name der Haltestelle. */
  name: string;
  /** Deutsches Thema. */
  topic: string;
  state: StopState;
  /** Endstation: Quadrat statt Kreis. */
  terminus?: boolean;
  /** Antippbar, zum Beispiel abgeschlossene Haltestellen mit ihrer Übersicht. */
  selectable?: boolean;
}

export interface LineProps {
  stops: readonly LineStop[];
  /** Überschrift über der Linie, zum Beispiel „Deine Linie“. */
  title?: string;
  /** Rechts neben der Überschrift, zum Beispiel „1 von 10 abgeschlossen“. */
  summary?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

const STATUS_TEXT: Record<StopState, string | null> = {
  locked: null,
  open: "heute",
  running: "läuft",
  done: "abgeschlossen",
};

/**
 * Die Linie: Liste der Haltestellen mit Haltepunkt, spanischem Namen, deutschem Thema und Zustand.
 * Telefon: Thema und Zustand rechts. iPad: Thema und Zustand unter dem Namen.
 */
export function Line({ stops, title, summary, onSelect, className }: LineProps) {
  return (
    <div className={cx("line-block", className)}>
      {(title || summary) && (
        <div className="line-block__head">
          {title && (
            <Label as="h2" tone="muted">
              {title}
            </Label>
          )}
          {summary && <p className="line-block__summary">{summary}</p>}
        </div>
      )}
      <ol className="line">
        {stops.map((stop) => {
          const status = STATUS_TEXT[stop.state];
          const marked = stop.state === "open" || stop.state === "running";
          const body = (
            <>
              <Es size="stop" className="stop__name">
                {marked ? <Marker>{stop.name}</Marker> : stop.name}
              </Es>
              <span className="stop__meta">
                <span className="stop__topic">{stop.topic}</span>
                {status && (
                  <>
                    <span className="stop__sep"> · </span>
                    <span className="stop__status">{status}</span>
                  </>
                )}
              </span>
            </>
          );
          return (
            <li key={stop.id} className={cx("stop", `stop--${stop.state}`, stop.terminus && "stop--terminus")}>
              <StopDot state={stop.state} terminus={stop.terminus} />
              {stop.selectable && onSelect ? (
                <button type="button" className="stop__body" onClick={() => onSelect(stop.id)}>
                  {body}
                </button>
              ) : (
                <div className="stop__body">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
