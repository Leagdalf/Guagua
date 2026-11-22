import { cx } from "./cx";

export interface TabItem {
  id: string;
  label: string;
}

/** Die vier Reiter der App. */
export const tabItems: readonly TabItem[] = [
  { id: "line", label: "Linie" },
  { id: "missions", label: "Missionen" },
  { id: "phrasebook", label: "Sprachführer" },
  { id: "more", label: "Mehr" },
];

export interface TabBarProps {
  /** Standard: `tabItems`. */
  items?: readonly TabItem[];
  /** id des aktiven Reiters. */
  active: string;
  onSelect?: (id: string) => void;
  className?: string;
}

/** Untere Leiste mit Reitern aus Text. Der aktive Reiter trägt oben einen Strich in atlántico. */
export function TabBar({ items = tabItems, active, onSelect, className }: TabBarProps) {
  return (
    <nav aria-label="Bereiche" className={cx("tabbar", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="tab"
          aria-current={item.id === active ? "page" : undefined}
          onClick={() => onSelect?.(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
