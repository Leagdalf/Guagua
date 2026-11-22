# Design

Stand 22.11.2026. Florian hat aus sechs Entwürfen die Mischung gewählt: die Gestaltung des Tagebuch-Entwurfs, die Linie des Fahrplan-Entwurfs und den Berg des Insel-Entwurfs. Hauptgerät ist ein iPad, auf dem iPhone bleibt die App benutzbar.

Die Vorlagen liegen als HTML in docs/mockups/project:

| Datei | Zeigt |
|---|---|
| `iPad-Start.dc.html` | Startseite auf dem iPad, 820 × 1180 |
| `iPad-Aufgabe.dc.html` | Aufgabe mit Rückmeldung auf dem iPad |
| `Mix-Start.dc.html` | Startseite auf dem Telefon, 390 × 844 |
| `Mix-Aufgabe.dc.html` | Aufgabe mit Rückmeldung auf dem Telefon |

Maße, Farben und Abstände dort ablesen. Die übrigen Dateien im Ordner sind verworfene Entwürfe. Weicht eine Vorlage von diesem Dokument ab, gilt dieses Dokument.

## Leitidee

Die App sieht aus wie eine Seite in einem Reisetagebuch: helles Papier, Tinte, feine Linien, ein gelber Marker. Darauf liegt der Kurs als Buslinie mit Haltepunkten. Im Kopf der Startseite steht ein Berg, an dessen Flanke dieselbe Linie bergauf läuft. Die Endstation ist der Gipfel.

Die App soll nach diesem einen Kurs aussehen und nicht nach einer beliebigen Lern-App. Deshalb gibt es keine Maskottchen, keine Konfetti-Kaskaden und keine Illustrationen aus Bilddatenbanken. Der Berg ist die einzige Illustration.

## Farben

| Name | Wert | Einsatz |
|---|---|---|
| página | `#FAFBFC` | Hintergrund der App, gesperrte Haltepunkte |
| tinta | `#18233D` | Text, Ränder der Haltepunkte, Kontur des Bergs, Grundlinie |
| atlántico | `#2546C7` | Linie, Hauptknopf, Textknöpfe, abgeschlossene Haltepunkte |
| plátano | `#FFE56B` | Marker, heutige Haltestelle, Fahne am Gipfel |
| mojo | `#B3261E` | Falsch, Warnung |
| drago | `#1C6B48` | Richtig |
| ceniza | `#5A6474` | Nebentext, Beschriftungen, gesperrte Namen |
| raya | `#D8DDE5` | Haarlinien ohne Bedeutung |
| teide | `#C9824F` | Fläche des Bergs |
| nieve | `#FFFFFF` | Schrift auf atlántico, Schneekappe |

Kontraste nach WCAG 2, am 22.11.2026 berechnet:

| Vordergrund auf Hintergrund | Verhältnis |
|---|---|
| tinta auf página | 15,05 zu 1 |
| tinta auf plátano | 12,38 zu 1 |
| nieve auf atlántico | 7,56 zu 1 |
| atlántico auf página | 7,29 zu 1 |
| mojo auf página | 6,31 zu 1 |
| drago auf página | 6,24 zu 1 |
| atlántico auf plátano | 6,00 zu 1 |
| ceniza auf página | 5,78 zu 1 |
| tinta auf teide | 5,04 zu 1 |

Auf plátano steht immer tinta. Die Farbe raya hat gegen página nur 1,32 zu 1 und taugt deshalb nur für Haarlinien ohne Bedeutung. Die Farbe teide hat gegen página 2,99 zu 1. Sie kommt nur als Fläche des Bergs vor, immer mit Kontur in tinta, nie als Schrift.

Es gibt nur das helle Thema.

## Schrift

Zwei Familien mit fester Aufgabenteilung:

| Schrift | Rolle | Paket |
|---|---|---|
| Newsreader, kursiv | Alles Spanische und die Namen der Haltestellen | `@fontsource/newsreader` |
| Figtree | Deutsch und die gesamte Bedienung | `@fontsource/figtree` |

Die Trennung ist eine Lernhilfe: Was kursiv in der Serifenschrift steht, ist Spanisch. Beide Schriften werden mit der App ausgeliefert, damit sie offline da sind. Nur die Schnitte laden, die vorkommen (Newsreader kursiv 400 und 500, Figtree 400, 500, 600), und nur die lateinischen Zeichensätze. Die Lizenzdatei der Pakete beim Einbinden prüfen und unter „Über“ nennen.

| Verwendung | Schrift | Telefon | iPad | Schnitt |
|---|---|---|---|---|
| Spanisch auf der Lernkarte | Newsreader kursiv | 48 px | 72 px | 400 |
| Name der heutigen Haltestelle auf der Startseite | Newsreader kursiv | 50 px | 68 px | 400 |
| Spanisch im Vollbild „Zeigen“ | Newsreader kursiv | so groß, wie der Satz in vier Zeilen passt, mindestens 48 px | mindestens 72 px | 400 |
| Name einer Haltestelle in der Linie | Newsreader kursiv | 23 px | 26 px | 400, heute 500 |
| Spanisch im Fließtext, Dialog, Listen | Newsreader kursiv | 20 px | 24 px | 400 |
| Deutsch, Bedienung | Figtree | 17 px | 19 px | 400 |
| Knöpfe | Figtree | 17 px | 19 px | 600 |
| Erklärzeile im Block „Heute“ | Figtree | 16 px | 19 px | 400, in ceniza |
| Nebentext | Figtree | 14 bis 16 px | 16 px | 400 |
| Beschriftung in Großbuchstaben | Figtree | 13 px | 14 px | 600, Laufweite 0,1 em |

Zeilenhöhe 1,4 für Deutsch und 1,05 für großes Spanisch. Keine Schrift unter 13 px, Eingabefelder mindestens 16 px.

## Marker

Der Marker ist ein gelber Balken hinter dem unteren Drittel einer spanischen Zeile, wie mit einem Textmarker gezogen. Er zeigt, was gerade dran ist: das Spanische der aktuellen Aufgabe und die heutige Haltestelle, auf der Startseite im Block „Heute“ und in der Linie.

Umsetzung als eine CSS-Regel auf einem Inline-Element: `box-shadow: inset 0 -0.34em 0` in plátano, dazu `box-decoration-break: clone` mit dem `-webkit-`-Präfix, damit der Balken bei Zeilenumbruch jede Zeile unterlegt. Das ist die einzige Stelle mit `box-shadow`.

## Formen

- Die Linie ist 3 px breit in atlántico.
- Haltepunkte sind Kreise mit 20 px Durchmesser (iPad 22 px) und 2 px Rand in tinta. Die Endstation ist ein Quadrat gleicher Größe mit 4 px Eckenradius.

| Zustand | Füllung |
|---|---|
| gesperrt | página |
| offen (die heutige) | plátano |
| läuft (begonnen, nicht abgeschlossen) | plátano mit einem Punkt von 8 px in tinta |
| abgeschlossen | atlántico mit Haken in nieve |

- Es gibt keine Karten und keine Kästen. Gruppen entstehen durch Abstand und durch Haarlinien von 1 px in raya. Die Grundlinie unter dem Berg ist 1,5 px in tinta.
- Der Hauptknopf ist eine volle Fläche in atlántico mit Schrift in nieve, 54 px hoch (iPad 60 px), 8 px Eckenradius. Pro Ansicht gibt es genau einen. Gesperrt (zum Beispiel „Prüfen“ ohne Eingabe) ist die Fläche raya und die Schrift ceniza. Dieses Paar hat 4,39 zu 1 und kommt nur am gesperrten Knopf vor.
- Nebenaktionen sind Textknöpfe in atlántico, Schnitt 600, mit mindestens 44 px Höhe: „Abhaken“, „Anhören“, „Langsam“.
- In der Linie steht am Telefon rechts neben dem Namen nur ein kurzer Text: das Thema bei gesperrten Haltestellen, sonst der Zustand („abgeschlossen“, „heute“, „läuft“), bei der Endstation „Endstation“. Kein Name bricht dort in zwei Zeilen um.
- Antwortflächen sind gestapelte Zeilen über die volle Spaltenbreite, getrennt durch Haarlinien, 56 px hoch (iPad 68 px). Links steht ein Kreis von 20 px mit 1,5 px Rand in ceniza. Kein Raster aus Kacheln.
- Rund sind nur Haltepunkte und Auswahlkreise.
- Symbole sind Strichzeichnungen mit 1,8 px Strich und kommen nur mit Funktion vor: Schließen, Lautsprecher, Haken, Kreuz, Stern im Sprachführer. Haken und Kreuz in der Rückmeldung einer Aufgabe haben 2,4 px Strich, damit sie auf Armlänge erkennbar sind.
- Keine Schatten, keine Verläufe.

## Der Berg

Eine SVG-Zeichnung mit `viewBox="0 0 180 119"`, auf dem Telefon 180 × 119 px, auf dem iPad 340 × 225 px. Sie steht rechts im Kopf der Startseite und sitzt auf der Grundlinie. Der Berg erscheint außerdem in der Zusammenfassung am Ende einer Haltestelle und in der Ansicht „Deine Linie“ nach der Endstation. In Aufgaben kommt er nicht vor.

```html
<svg viewBox="0 0 180 119" aria-hidden="true">
  <path d="M10 118L78 36Q90 20 102 36L170 118Z" fill="#C9824F" stroke="#18233D" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M65.6 51L78 36Q90 20 102 36L114.4 51L102 44L90 54L78 44Z" fill="#FFFFFF" stroke="#18233D" stroke-width="2" stroke-linejoin="round"/>
  <path d="M90 28V9" fill="none" stroke="#18233D" stroke-width="2" stroke-linecap="round"/>
  <path d="M90 10h13l-3.5 4 3.5 4H90z" fill="#FFE56B" stroke="#18233D" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M6.5 108.2L64.6 38.1" fill="none" stroke="#2546C7" stroke-width="2.5" stroke-linecap="round"/>
  <!-- zehn Haltepunkte, siehe Tabelle -->
</svg>
```

Auf dem iPad sind die Striche etwas dünner, weil die Zeichnung größer dargestellt wird: Kontur 2,2, Kappe 1,8, Linie 2.

Die zehn Haltepunkte liegen auf der Linie an der linken Flanke, von unten nach oben:

| Haltestelle | cx | cy |
|---|---|---|
| 1 | 6.5 | 108.2 |
| 2 | 13 | 100.4 |
| 3 | 19.4 | 92.6 |
| 4 | 25.9 | 84.8 |
| 5 | 32.3 | 77 |
| 6 | 38.8 | 69.3 |
| 7 | 45.3 | 61.5 |
| 8 | 51.7 | 53.7 |
| 9 | 58.2 | 45.9 |
| 10 | 64.6 | 38.1 |

Zustände wie bei der Linie: gesperrt mit Radius 3,2 in página, abgeschlossen mit Radius 4 in atlántico, die heutige mit Radius 5,5 in plátano. Alle mit Rand in tinta. Die Fahne am Gipfel steht für die Endstation.

Der Berg ist Schmuck mit Bedeutung, aber keine Bedienung: `aria-hidden`, nicht antippbar. Der Stand steht daneben als Text („Tag 2 von 10“).

## Aufbau der Ansichten

Unter 700 px Breite gilt das Telefon-Raster, ab 700 px das iPad-Raster.

| Ansicht | Telefon | iPad |
|---|---|---|
| Startseite | Eine Spalte: Kopf mit Datum, „Tag n von 10“ und Berg, Block „Heute“, Zeile mit der offenen Mission, Linie zum Scrollen. Der Hauptknopf sitzt fest über der unteren Leiste. | Kopf über die volle Breite. Darunter zwei gleich breite Spalten mit 48 px Abstand: links Block „Heute“, Hauptknopf und die offene Mission mit ihren Sätzen zum Mitnehmen, rechts die ganze Linie mit allen elf Punkten. |
| Lerneinheit | Eine Spalte mit 28 px Rand. Oben Schließen, die kurze Linie mit sechs Punkten und der Zähler. Hauptknopf am unteren Rand über dem sicheren Rand. | Dieselbe Spalte, 620 px breit, zentriert. |
| Missionen, Sprachführer, Mehr | Eine Spalte mit 28 px Rand. | Eine Spalte, höchstens 680 px breit, zentriert. |

- Im Querformat bleibt die Aufteilung. Der Inhalt der Startseite wird höchstens 1000 px breit und steht zentriert.
- Seitenränder: Telefon 28 px, iPad 48 px. Abstände in Schritten von 4 px.
- Ein Thema pro Ansicht. Die Lernkarte zeigt das spanische Wort, darunter den Knopf zum Anhören, nach der Antwort die Lösung und den Hinweis. Mehr steht nicht darauf.
- Hierarchie entsteht durch Schriftgröße und Abstand.
- Fortschritt innerhalb einer Einheit zeigt die kurze Linie mit sechs Punkten am oberen Rand, in derselben Formensprache wie die große Linie. Punkte 16 px (iPad 20 px).
- Die untere Leiste hat vier Reiter aus Text, ohne Symbole: Linie, Missionen, Sprachführer, Mehr. Der aktive Reiter steht in tinta mit Schnitt 600 und trägt oben einen Strich von 2 px in atlántico. Auf dem iPad stehen die Reiter zentriert, jeder mindestens 150 px breit.
- Punkte und Serie stehen nicht auf der Startseite. Sie erscheinen in der Zusammenfassung am Ende einer Haltestelle und unter „Mehr“.

## Rückmeldung in Aufgaben

- Richtig: Der Auswahlkreis wird zum Haken in drago, der Text bekommt Schnitt 600, rechts steht „richtig“ in drago.
- Falsch gewählt: Der Auswahlkreis wird zum Kreuz in mojo, der Text ist durchgestrichen mit Strich in mojo, rechts steht „deine Antwort“ in mojo. Die richtige Zeile wird zugleich wie oben markiert.
- Unter den Antworten steht die Lösung als Satz, darunter in ceniza der Hinweis der Karte.

## Bewegung

- Übergänge zwischen Aufgaben 150 ms, nur Deckkraft und 8 px Versatz.
- Kein Wackeln, kein Aufblitzen des ganzen Bildschirms.
- Abschluss einer Haltestelle: Der Punkt auf der Linie füllt sich, die Linie wächst zum nächsten Punkt, am Berg rückt die Markierung einen Punkt höher. Das ist die einzige längere Animation (600 ms).
- Bei `prefers-reduced-motion` und im Ruhemodus entfallen alle Animationen.

## App-Symbol

Quadrat in atlántico. Darin der Berg als Fläche in nieve ohne Kontur, an seiner linken Flanke ein Haltepunkt in plátano mit Rand in tinta. Kein Buchstabe, kein Verlauf. Als SVG anlegen und die PNG-Größen daraus erzeugen.

## Texte

- Du-Form, kurze Sätze, Verben statt Substantivketten.
- Knöpfe sagen, was passiert: „Weiter“, „Anhören“, „Langsam“, „Aufdecken“, „Mission erledigt“.
- Rückmeldungen nennen die Sache: „Richtig. Achte auf den Akzent: está.“ statt allgemeinem Lob.
- Keine Ausrufe-Ketten, keine Emojis, kein „Super gemacht!“ nach jeder Antwort. Eine Zeile Anerkennung gibt es am Ende einer Haltestelle.
- Spanische Wörter in deutschen Sätzen stehen kursiv in Newsreader und tragen `lang="es"`.
- Zahlen und Zustände konkret: „12 Karten fällig“, „Haltestelle 3 von 10“.

Der Block „Heute“ besteht aus Beschriftung, großer Zeile, Erklärzeile und Hauptknopf:

| Zustand | Beschriftung | Große Zeile | Erklärzeile | Hauptknopf |
|---|---|---|---|---|
| Wiederholungen fällig, Haltestelle offen | Heute · Haltestelle 2 | En el café (Spanisch, mit Marker) | Getränke bestellen. Erst 16 Karten wiederholen, dann 15 neue. | Mit Wiederholen beginnen |
| Nur Mission offen | Heute | Mission offen (Deutsch, Figtree 600) | Bestellen ohne Englisch | Mission ansehen |
| Alles erledigt | Heute | Für heute fertig (Deutsch, Figtree 600) | Morgen: Haltestelle 3, Los números | 10 Karten extra |

Ist nichts fällig und eine Haltestelle offen, lautet die Erklärzeile „Getränke bestellen. 15 neue Karten.“ und der Knopf „Haltestelle beginnen“.

## Was nicht vorkommt

- Inter, Roboto, Arial oder die Systemschrift als Hauptschrift
- Farbverläufe
- Schatten, Karten mit Rahmen, Kästen in Kästen
- drei Kacheln mit Symbol nebeneinander als Startseite
- Symbole als Schmuck ohne Funktion
- Fotos, generierte Bilder oder weitere Illustrationen neben dem Berg
- Emojis
