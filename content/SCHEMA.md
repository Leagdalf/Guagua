# Schema der Lerninhalte

Alle Inhalte sind JSON-Dateien in UTF-8. Die App bündelt sie beim Build, zur Laufzeit wird nichts nachgeladen. `node tools/validate-content.mjs` prüft jede hier genannte Regel und muss vor jedem Commit an `content/` fehlerfrei laufen.

## Dateien

| Datei | Inhalt |
|---|---|
| `course.json` | Kursname, Reihenfolge der Einheiten, empfohlene Daten |
| `units/u01.json` bis `units/u10.json` | Je eine Haltestelle |
| `phrasebook.json` | Sprachführer mit Kategorien |
| `reference.json` | Zahlen 0 bis 100, Wochentage |

## Einheit (`units/uNN.json`)

| Feld | Typ | Regel |
|---|---|---|
| `id` | Text | `u` plus zweistellige Nummer, passend zum Dateinamen und zur Reihenfolge |
| `stop` | Zahl | Nummer der Haltestelle, beginnt bei 1 |
| `title_es`, `title_de` | Text | Name der Haltestelle und deutsches Thema |
| `can_do_de` | Text | Ein Satz in der Ich-Form, was man danach kann |
| `tips_de` | Liste von Texten | Optional, zum Beispiel Aussprache |
| `grammar` | Objekt | siehe unten |
| `items` | Liste | 12 bis 16 Lernkarten |
| `dialogue` | Objekt | 5 bis 10 Zeilen |
| `cloze` | Liste | mindestens 4 Lückensätze |
| `build` | Liste | mindestens 3 Satzbau-Aufgaben |
| `mission` | Objekt | Aufgabe für draußen |
| `canarias_de` | Text | Eine belegte Besonderheit der Kanaren |

### Lernkarte (`items[]`)

| Feld | Regel |
|---|---|
| `id` | `uNN-iMM`, im ganzen Kurs eindeutig. Ids ändern sich nie, weil der Lernfortschritt daran hängt. |
| `es` | Spanisch, kleingeschrieben außer Eigennamen. Über alle Einheiten eindeutig. |
| `de` | Deutsch. Über alle Einheiten eindeutig, damit Auswahlaufgaben nie zwei richtige Antworten haben. |
| `kind` | `word` (ein Wort, auch mit Artikel), `phrase` (feste Wendung) oder `frame` (Satzmuster mit Lücke) |
| `note_de` | Optionaler Hinweis, höchstens zwei Sätze |
| `example` | Pflicht bei `frame`: `{ "es": "...", "de": "..." }`, ein vollständiger Satz mit gefüllter Lücke |

Ein Satzmuster enthält in `es` und `de` je ein Auslassungszeichen `…` (ein Zeichen, U+2026). Vorgelesen wird bei Satzmustern `example.es`, sonst `es`. Satzmuster kommen nie in Schreibaufgaben vor.

### Grammatik (`grammar`)

`topic_de`, `explanation_de` (höchstens 6 Sätze), `table` (mindestens 3 Zeilen mit `label_de`, `es`, `de`) und `examples` (mindestens 3 Paare `es` und `de`).

### Dialog (`dialogue`)

`setting_de` beschreibt die Szene. Jede Zeile in `lines` hat `speaker`, `es`, `de` und `learner`. Die Lernende heißt als Sprecherin immer `Tú`, genau dann ist `learner` wahr. Zwei Zeilen desselben Sprechers folgen nie direkt aufeinander. Mindestens zwei Zeilen gehören der Lernenden.

Der einzige erlaubte Platzhalter ist `{name}`. Die App ersetzt ihn durch den Namen aus dem Profil. Er ist nur im Dialog erlaubt und muss in `es` und `de` gleich oft vorkommen.

### Lückensatz (`cloze[]`)

`id` (`uNN-cMM`), `es` mit genau einer Lücke aus drei Unterstrichen `___`, `answer`, `options` (2 bis 4 Einträge ohne Dubletten, `answer` ist enthalten) und `de`. Die deutsche Übersetzung muss die Lösung eindeutig machen, wenn grammatisch mehrere Optionen möglich wären.

### Satzbau (`build[]`)

`id` (`uNN-bMM`), `tokens` (3 bis 8 Bausteine in richtiger Reihenfolge, ohne Leerzeichen innerhalb eines Bausteins, Satzzeichen hängen am Wort) und `de`. Die App mischt die Bausteine. Die Lösung ist `tokens` mit Leerzeichen verbunden.

### Mission (`mission`)

`id` (`uNN-m`), `title_de`, `task_de` (was genau zu tun ist, in der Du-Form) und `say` (2 bis 3 spanische Sätze zum Mitnehmen).

## Sprachführer (`phrasebook.json`)

`categories[]` mit `id`, `title_de`, optional `note_de` und `phrases[]`. Jeder Satz hat `id` (`pb-<kategorie>-NN`), `es`, `de` und optional `note_de`.

## Nachschlagen (`reference.json`)

`numbers` enthält 101 Einträge `{ "n": 0, "es": "cero" }` bis 100. `weekdays` enthält sieben Paare `es` und `de`.

## Regeln für alle spanischen Texte

- Jedes `¿` hat ein `?`, jedes `¡` ein `!`.
- Keine doppelten Leerzeichen, keine Leerzeichen am Rand.
- Kanarischer Gebrauch: ustedes statt vosotros, papas statt patatas, guagua statt autobús.
- Weibliche Form für die Lernende, männliche Form im Hinweis.
- Niveau A1: Präsens, `ir a` für Zukunft, keine Nebensätze mit Konjunktiv außer festen Wendungen aus dem Sprachführer.

## Regeln für alle deutschen Texte

- Du-Form.
- Tatsachen über die Kanaren nur mit Beleg in docs/08-quellen.md.
- Keine Füllsätze. Ein Hinweis steht nur dort, wo er einen Fehler verhindert oder etwas erklärt, das aus der Übersetzung nicht hervorgeht.
