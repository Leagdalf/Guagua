import { createElement, type ReactNode } from "react";
import { TextButton } from "./buttons";
import { cx } from "./cx";
import { Es, Marker } from "./Es";
import { Mountain } from "./Mountain";
import type { StopState } from "./types";

/** Beschriftung in Großbuchstaben (13/14 px, Laufweite 0,1 em). */
export function Label({
  as = "p",
  tone = "muted",
  className,
  id,
  children,
}: {
  as?: "p" | "h1" | "h2" | "h3" | "span";
  tone?: "muted" | "accent";
  className?: string;
  /** Zum Beispiel für `aria-labelledby` eines Abschnitts. */
  id?: string;
  children: ReactNode;
}) {
  return createElement(as, { id, className: cx("label", tone === "accent" && "label--accent", className) }, children);
}

/** Rahmen der App: Inhalt, darunter fest die untere Leiste. Ein Hinweis steht ganz oben. */
export function AppShell({ tabs, notice, children }: { tabs?: ReactNode; notice?: ReactNode; children: ReactNode }) {
  return (
    <div className="shell">
      {notice}
      <main className="shell__main">{children}</main>
      {tabs}
    </div>
  );
}

/** Einfache Seite (Missionen, Sprachführer, Mehr): eine Spalte, höchstens 680 px breit, zentriert. */
export function SimplePage({ footer, className, children }: { footer?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cx("simple", className)}>
      {children}
      {footer}
    </div>
  );
}

/** Lerneinheit: Spalte mit Rand, auf dem iPad 620 px breit und zentriert. `footer` ist die untere Leiste mit dem Hauptknopf. */
export function LessonPage({ header, footer, children }: { header?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="lesson">
      {header}
      <div className="lesson__body">{children}</div>
      {footer}
    </div>
  );
}

/** Kopf der Startseite: Datum, „Tag n von 10“ und der Berg. */
export function HomeHeader({ date, progress, stops }: { date: string; progress: string; stops: readonly StopState[] }) {
  return (
    <header className="home__header">
      <p>{date}</p>
      <p>{progress}</p>
      <Mountain stops={stops} />
    </header>
  );
}

/** Block „Heute“: Beschriftung, große Zeile, Erklärzeile. Den Hauptknopf gibt die Startseite getrennt hinein. */
export function Today({
  label,
  title,
  titleLang = "es",
  text,
}: {
  label: string;
  title: string;
  /** `es`: Spanisch mit Marker. `de`: Deutsch in Figtree 600. */
  titleLang?: "es" | "de";
  text: string;
}) {
  return (
    <div className="home__today">
      <Label tone="accent">{label}</Label>
      {titleLang === "es" ? (
        <Es as="h1" size="today" className="today__title">
          <Marker>{title}</Marker>
        </Es>
      ) : (
        <h1 className="today__title today__title--de">{title}</h1>
      )}
      <p className="today__text">{text}</p>
    </div>
  );
}

/** Offene Mission auf der Startseite. Telefon: eine Zeile. iPad: mit Beschreibung und Sätzen zum Mitnehmen. */
export function MissionRow({
  title,
  text,
  phrases,
  actionLabel = "Abhaken",
  onAction,
  label = "Mission offen",
}: {
  title: string;
  text?: string;
  /** Spanische Sätze zum Mitnehmen, nur auf dem iPad sichtbar. */
  phrases?: readonly string[];
  actionLabel?: string;
  onAction?: () => void;
  label?: string;
}) {
  return (
    <section className="home__mission">
      <div className="mission">
        <Label as="h2" className="mission__label">
          {label}
        </Label>
        <TextButton className="mission__action" onClick={onAction}>
          {actionLabel}
        </TextButton>
        <p className="mission__title">{title}</p>
        {text && <p className="mission__text">{text}</p>}
        {phrases && phrases.length > 0 && (
          <ul className="mission__phrases">
            {phrases.map((p) => (
              <Es as="li" key={p}>
                {p}
              </Es>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Startseite. Telefon: eine Spalte, Hauptknopf (`action`, eine ActionBar) fest über der unteren Leiste.
 * iPad: Kopf über die volle Breite, links Heute, Hauptknopf und Mission, rechts die Linie; Inhalt höchstens 1000 px.
 */
export function HomePage({
  header,
  today,
  action,
  mission,
  line,
}: {
  header: ReactNode;
  today: ReactNode;
  action: ReactNode;
  mission?: ReactNode;
  line: ReactNode;
}) {
  return (
    <div className="home">
      {header}
      {today}
      <div className="home__action">{action}</div>
      {mission}
      <div className="home__line">{line}</div>
    </div>
  );
}
