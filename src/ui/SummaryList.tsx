import type { ReactNode } from "react";
import { cx } from "./cx";

export interface SummaryItem {
  /** Bezeichnung links, zum Beispiel „Neue Karten“. */
  label: string;
  /** Wert rechts, zum Beispiel „15“. */
  value: ReactNode;
}

export interface SummaryListProps {
  items: readonly SummaryItem[];
  className?: string;
}

/** Zusammenfassung am Ende einer Haltestelle: Zeilen aus Bezeichnung und Wert, getrennt durch Haarlinien. */
export function SummaryList({ items, className }: SummaryListProps) {
  return (
    <dl className={cx("summary", className)}>
      {items.map((item) => (
        <div key={item.label} className="summary__row">
          <dt className="summary__label">{item.label}</dt>
          <dd className="summary__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
