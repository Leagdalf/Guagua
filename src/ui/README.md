# Bausteine (src/ui)

Alles kommt aus `src/ui/index.ts`. Die Bausteine zeigen nur an: keine Lernlogik, kein Aufruf der Sprachausgabe. Zustände und Handler kommen als Props. Stile laden über `src/styles` (macht `src/main.tsx`). Vorschau aller Bausteine in allen Zuständen: Adresse mit `?preview`, nur im Entwicklungsmodus (`npm run dev`). Im gebauten Bündel ist sie nicht enthalten.

Spanischer Text: immer `<Es>` oder Klasse `es` plus `lang="es"`, auch nicht in einem `aria-label`. Farben nur über die CSS-Variablen `--pagina --tinta --atlantico --platano --mojo --drago --ceniza --raya --teide --nieve`, Schriften `--font-es` und `--font-de`. Abstände `--s1` bis `--s12` (4 bis 48 px), Seitenrand `--edge` (28 px, ab 700 px Breite 48 px).

## Regel: `speak` nur aus Klick-Behandlungen

`speak(` steht außerhalb von `src/audio` nur direkt in einer JSX-Eigenschaft `on…={…}` oder im Rumpf einer Funktion, deren Name mit `handle` beginnt, nie in einem Effekt, Zeitgeber, Promise-Rückruf und nie nach einem `await`. Der Test `src/audio/speakRule.test.ts` liest alle Quelldateien unter `src` außer Tests und bricht bei jedem Verstoß; Bausteine in `src/ui` rufen `speak` selbst nie auf, ein Tonknopf bekommt den Aufruf als `onClick`.

## Text

| Baustein | Props | Verwendung |
|---|---|---|
| `Es` | `as?` (`span` `p` `h1` `h2` `h3` `div` `li`), `size?` (`text` 20/24 px, `card` 48/72, `today` 50/68, `stop` 23/26, `inherit`), `className?`, `id?`, `children` | Jeder spanische Text; setzt Newsreader kursiv und `lang="es"`. In einer Antwortzeile und in Paaren ist er 20/24 px, auch mit `size="inherit"`. |
| `Marker` | `children`, `className?` | Gelber Balken hinter der Zeile, die gerade dran ist; um Text oder `Es` legen, einmal je Ansicht. |
| `Label` | `as?` (`p` `h1` `h2` `h3` `span`), `tone?` (`muted` `accent`), `section?`, `className?`, `id?`, `children` | Beschriftung in Großbuchstaben, zum Beispiel „Heute · Haltestelle 2“. `id` für `aria-labelledby`. `section` für eine Beschriftung, die innerhalb der Ansicht einen neuen Abschnitt beginnt: Klasse `label--section`, 24 px Abstand nach oben (iPad 32 px, Token `--label-gap`). Nicht für die erste Beschriftung einer Ansicht. Eigene Abschnitte in Großbuchstaben setzen `margin-top: var(--label-gap)` statt eines festen Werts (so die Klassen `sec`, `ov__sec`, `mi__take`). |

## Knöpfe

| Baustein | Props | Verwendung |
|---|---|---|
| `PrimaryButton` | `children`, `onClick?`, `href?` (macht einen Link), `type?`, `disabled?`, `className?` | Hauptknopf, genau einer je Ansicht. `disabled`: Fläche raya, Schrift ceniza, nicht antippbar (zum Beispiel „Prüfen“ ohne Eingabe); ein gesperrter Knopf wird nie ein Link. |
| `TextButton` | `children`, `onClick?`, `disabled?`, `type?`, `aria-label?`, `className?` | Nebenaktion wie „Abhaken“, mindestens 44 px hoch. |
| `AudioButton` | `onClick?`, `variant?` (`normal` „Anhören“, `slow` „Langsam“), `disabled?`, `label?`, `describedBy?`, `className?` | Tonknopf; `onClick` ruft `speak` direkt auf, `disabled` ohne spanische Stimme. `describedBy` ist die id des spanischen Satzes (`<Es id>`), den der Knopf spricht: Ein Screenreader liest ihn so auf Spanisch vor, ohne `aria-label` mit spanischem Text. |
| `ActionBar` | `children`, `aboveTabs?`, `className?` | Untere Leiste für den Hauptknopf, hält `env(safe-area-inset-bottom)` frei; `aboveTabs` wenn darunter die `TabBar` sitzt. |

## Aufgaben

| Baustein | Props | Verwendung |
|---|---|---|
| `AnswerRow` | `state?` (`selectable` `correct` `wrong` `locked`), `onClick?`, `children`, `className?` | Eine Antwortzeile; nach der Antwort richtige Zeile `correct`, gewählte falsche `wrong`, übrige `locked`. Haken und Kreuz haben 2,4 px Strich; `wrong` streicht den Text durch (2 px, in mojo). |
| `AnswerList` | `children`, `label?`, `className?` | Umschließt die Antwortzeilen und zieht die Haarlinien. |
| `Feedback` | `result` (`correct` `wrong` `accent`), `solution`, `hint?`, `className?` | Rückmeldung unter den Antworten: Haken oder Kreuz mit „Richtig.“, „Falsch. Richtig ist:“ oder „Richtig. Achte auf den Akzent:“, dann der Lösungssatz (`solution`, Spanisches als `<Es>`), darunter der Hinweis in ceniza. `role="status"`. |
| `PairsBoard` | `left`, `right` (je `PairItem[]`: `id`, `text`, `state` = `selectable` `selected` `found` `wrong`), `onSelect?(side, id)`, `leftLabel?`, `rightLabel?`, `className?` | Paare: links Spanisch (der Baustein setzt `lang="es"`), rechts Deutsch. Gewählt mit Marker, gefunden in ceniza mit Haken und gesperrt, falsch mit Kreuz. Die Zustände je Zeile setzt der Aufrufer. |
| `SentenceBuilder` | `words` (`{id, text}[]`, feste Reihenfolge), `placed` (ids in Satzreihenfolge), `onPlace?(id)`, `onRemove?(id)`, `sentenceLabel?`, `wordsLabel?`, `className?` | Satzbau: Satzzeile auf Grundlinie, darunter die Wortknöpfe; gesetzte hinterlassen einen leeren Platz mit Rand in raya. Alles Spanisch. Den Hauptknopf „Prüfen“ (`PrimaryButton disabled`, bis `placed.length === words.length`) setzt der Aufrufer. |
| `TextField` | `label`, `value?`, `defaultValue?`, `onChange?(value)`, `placeholder?`, `spanish?`, `type?` (`text` `search`), `name?`, `disabled?`, `help?`, `autoComplete?`, `enterKeyHint?`, `className?` | Eingabefeld: Beschriftung darüber, Unterstrich 1,5 px, im Fokus 2,5 px in atlántico. `spanish`: Newsreader kursiv 24/32 px, `lang="es"`, keine Autokorrektur. `search` schaltet die Autokorrektur ebenfalls ab. |
| `TextArea` | wie `TextField` ohne `type`, `autoComplete`, `enterKeyHint`; dazu `rows?` (3) | Mehrzeiliges Feld, sonst gleich. |
| `SummaryList` | `items` (`{label, value}[]`), `className?` | Zusammenfassung am Ende einer Haltestelle: Zeilen aus Bezeichnung und Wert mit Haarlinien. `value` darf ein `<Es>` sein. |
| `UnitHeader` | `current`, `total?` (6), `counter?` (zum Beispiel „5 von 18“), `onClose?`, `closeLabel?` | Kopf der Lerneinheit mit Schließen, kurzer Linie und Zähler. |
| `UnitProgress` | `current`, `total?` (6), `className?` | Nur die sechs Punkte: kleiner als `current` erledigt, gleich aktuell, größer offen. |

## Haltestellen

| Baustein | Props | Verwendung |
|---|---|---|
| `StopDot` | `state` (`locked` `open` `running` `done`), `terminus?`, `small?`, `className?` | Einzelner Haltepunkt; `terminus` für die Endstation (Quadrat), reine Zierde. |
| `Line` | `stops` (je `id`, `name`, `topic`, `state`, `terminus?`, `selectable?`, `statusText?`), `title?`, `summary?`, `onSelect?(id)`, `className?` | Die Linie mit Namen, Themen und Zuständen; `open` und `running` bekommen den Marker, `selectable` macht die Zeile antippbar. `statusText` ersetzt den Zustandstext (Standard bei `open` ist „heute“; eine offene Haltestelle, die nicht die des Tages ist, bekommt „offen“). Gesperrte Zeilen tragen für Screenreader den Text „gesperrt“ (Klasse `vh`). Am Telefon steht rechts nur ein kurzer Text (Thema bei gesperrt, sonst der Zustand, bei der Endstation „Endstation“); ein Name bricht nie um. |
| `Mountain` | `stops` (bis zu zehn `StopState`, fehlende zählen als `locked`), `className?` | Der Berg mit zehn Haltepunkten; 180 px breit, ab 700 px 340 px. |
| `MOUNTAIN_POINTS` | Konstante | Die zehn Mittelpunkte `[cx, cy]` im `viewBox` `0 0 180 119`, von unten nach oben, aus docs/04-design.md. Für Zeichnungen, die denselben Weg brauchen. |

## Leiste und Hinweis

| Baustein | Props | Verwendung |
|---|---|---|
| `TabBar` | `items?` (Standard `tabItems`), `active` (id), `onSelect?(id)`, `className?` | Untere Leiste mit vier Reitern aus Text. |
| `tabItems` | Konstante `[{id, label}]` | `line` „Linie“, `missions` „Missionen“, `phrasebook` „Sprachführer“, `more` „Mehr“. Die ids sind das, was `onSelect` zurückgibt. |
| `Notice` | `text`, `actionLabel?`, `onAction?`, `className?` | Hinweisleiste in Gelb, zum Beispiel „Neue Version bereit.“ mit Knopf „Neu laden“. |

## Raster

| Baustein | Props | Verwendung |
|---|---|---|
| `AppShell` | `tabs?`, `notice?`, `children` | Rahmen der Startseite, Missionen, Sprachführer und Mehr: Hinweis oben, das einzige `main`, `TabBar` fest unten. Ansichten darin bringen kein eigenes `main` mit. |
| `HomePage` | `header`, `today`, `action`, `mission?`, `line` | Startseite: Telefon eine Spalte, iPad zwei Spalten, höchstens 1000 px; `action` ist eine `ActionBar aboveTabs` mit dem Hauptknopf. |
| `HomeHeader` | `date`, `progress`, `stops` | Kopf der Startseite mit Datum, „Tag n“ (ohne „von 10“) und Berg. |
| `Today` | `label`, `title`, `titleLang?` (`es` mit Marker, `de` in Figtree 600, 34 px, iPad 44 px), `text` (`ReactNode`) | Block „Heute“ ohne Hauptknopf; die Erklärzeile ist 16 px, auf dem iPad 19 px und darf spanische Wörter als `<Es size="inherit">` enthalten. |
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
