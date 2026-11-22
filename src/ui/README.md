# Bausteine (src/ui)

Alles kommt aus `src/ui/index.ts`. Die Bausteine zeigen nur an: keine Lernlogik, kein Aufruf der Sprachausgabe. Zustände und Handler kommen als Props. Stile laden über `src/styles` (macht `src/main.tsx`). Vorschau aller Bausteine: Adresse mit `?preview`.

Spanischer Text: immer `<Es>` oder Klasse `es` plus `lang="es"`. Farben nur über die CSS-Variablen `--pagina --tinta --atlantico --platano --mojo --drago --ceniza --raya --teide --nieve`, Schriften `--font-es` und `--font-de`. Abstände `--s1` bis `--s12` (4 bis 48 px), Seitenrand `--edge` (28 px, ab 700 px Breite 48 px).

## Text

| Baustein | Props | Verwendung |
|---|---|---|
| `Es` | `as?` (`span` `p` `h1` `h2` `h3` `div` `li`), `size?` (`text` 20/24 px, `card` 48/72, `today` 50/68, `stop` 23/26, `inherit`), `className?`, `children` | Jeder spanische Text; setzt Newsreader kursiv und `lang="es"`. |
| `Marker` | `children`, `className?` | Gelber Balken hinter der Zeile, die gerade dran ist; um Text oder `Es` legen, einmal je Ansicht. |
| `Label` | `as?` (`p` `h1` `h2` `h3` `span`), `tone?` (`muted` `accent`), `children` | Beschriftung in Großbuchstaben, zum Beispiel „Heute · Haltestelle 2“. |

## Knöpfe

| Baustein | Props | Verwendung |
|---|---|---|
| `PrimaryButton` | `children`, `onClick?`, `href?` (macht einen Link), `type?`, `className?` | Hauptknopf, genau einer je Ansicht; hat keinen deaktivierten Zustand, in der Ansicht weglassen. |
| `TextButton` | `children`, `onClick?`, `disabled?`, `type?`, `aria-label?`, `className?` | Nebenaktion wie „Abhaken“, mindestens 44 px hoch. |
| `AudioButton` | `onClick?`, `variant?` (`normal` „Anhören“, `slow` „Langsam“), `disabled?`, `label?`, `className?` | Tonknopf; `onClick` ruft `speak` direkt auf, `disabled` ohne spanische Stimme. |
| `ActionBar` | `children`, `aboveTabs?`, `className?` | Untere Leiste für den Hauptknopf, hält `env(safe-area-inset-bottom)` frei; `aboveTabs` wenn darunter die `TabBar` sitzt. |

## Aufgaben

| Baustein | Props | Verwendung |
|---|---|---|
| `AnswerRow` | `state?` (`selectable` `correct` `wrong` `locked`), `onClick?`, `children`, `className?` | Eine Antwortzeile; nach der Antwort richtige Zeile `correct`, gewählte falsche `wrong`, übrige `locked`. |
| `AnswerList` | `children`, `label?`, `className?` | Umschließt die Antwortzeilen und zieht die Haarlinien. |
| `UnitHeader` | `current`, `total?` (6), `counter?` (zum Beispiel „5 von 18“), `onClose?`, `closeLabel?` | Kopf der Lerneinheit mit Schließen, kurzer Linie und Zähler. |
| `UnitProgress` | `current`, `total?` (6), `className?` | Nur die sechs Punkte: kleiner als `current` erledigt, gleich aktuell, größer offen. |

Rückmeldung unter den Antworten selbst setzen: Lösungssatz in `p`, Hinweis in `p` mit Farbe `--ceniza`.

## Haltestellen

| Baustein | Props | Verwendung |
|---|---|---|
| `StopDot` | `state` (`locked` `open` `running` `done`), `terminus?`, `small?`, `className?` | Einzelner Haltepunkt; `terminus` für die Endstation (Quadrat), reine Zierde. |
| `Line` | `stops` (je `id`, `name`, `topic`, `state`, `terminus?`, `selectable?`), `title?`, `summary?`, `onSelect?(id)`, `className?` | Die Linie mit Namen, Themen und Zuständen; `open` und `running` bekommen den Marker, `selectable` macht die Zeile antippbar. |
| `Mountain` | `stops` (bis zu zehn `StopState`, fehlende zählen als `locked`), `className?` | Der Berg mit zehn Haltepunkten; 180 px breit, ab 700 px 340 px. |

## Leiste und Hinweis

| Baustein | Props | Verwendung |
|---|---|---|
| `TabBar` | `items?` (Standard `tabItems`: `line` `missions` `phrasebook` `more`), `active` (id), `onSelect?(id)`, `className?` | Untere Leiste mit vier Reitern aus Text. |
| `Notice` | `text`, `actionLabel?`, `onAction?`, `className?` | Hinweisleiste in Gelb, zum Beispiel „Neue Version bereit.“ mit Knopf „Neu laden“. |

## Raster

| Baustein | Props | Verwendung |
|---|---|---|
| `AppShell` | `tabs?`, `notice?`, `children` | Rahmen der Startseite, Missionen, Sprachführer und Mehr: Hinweis oben, Inhalt, `TabBar` fest unten. |
| `HomePage` | `header`, `today`, `action`, `mission?`, `line` | Startseite: Telefon eine Spalte, iPad zwei Spalten, höchstens 1000 px; `action` ist eine `ActionBar aboveTabs` mit dem Hauptknopf. |
| `HomeHeader` | `date`, `progress`, `stops` | Kopf der Startseite mit Datum, „Tag n von 10“ und Berg. |
| `Today` | `label`, `title`, `titleLang?` (`es` mit Marker, `de` in Figtree 600), `text` | Block „Heute“ ohne Hauptknopf. |
| `MissionRow` | `title`, `text?`, `phrases?`, `actionLabel?` („Abhaken“), `onAction?`, `label?` | Offene Mission der Startseite; Telefon eine Zeile, iPad mit Text und Sätzen zum Mitnehmen. |
| `LessonPage` | `header?`, `footer?`, `children` | Lerneinheit: Spalte, am iPad 620 px; `header` ist der `UnitHeader`, `footer` eine `ActionBar` mit dem Hauptknopf. |
| `SimplePage` | `footer?`, `className?`, `children` | Missionen, Sprachführer, Mehr: Spalte, am iPad höchstens 680 px. |

## Sonstiges

| Baustein | Verwendung |
|---|---|
| `applyCalm(on)` | Setzt oder entfernt `data-calm` am Wurzelelement; im Ruhemodus entfallen alle Übergänge und Animationen. |
| `CheckIcon`, `CrossIcon`, `SpeakerIcon` | Strichsymbole (1,8 px) für eigene Zeilen; nur mit Funktion verwenden. |
| Klasse `enter` | Auf das Wurzelelement einer neuen Aufgabe setzen: 150 ms, nur Deckkraft und 8 px Versatz. |
| Klasse `vh` | Nur für Screenreader sichtbar. |
