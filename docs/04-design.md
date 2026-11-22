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
| Deutsche große Zeile im Block „Heute“ | Figtree | 34 px | 44 px | 600 |
| Deutsche Frage in einer Aufgabe, Titel einer Mission | Figtree | 24 px | 32 px | 600 |
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
- Die offene Haltestelle heißt in der Linie „heute“, solange sie die Haltestelle des Tages ist. Ist die Haltestelle des Tages schon geschafft, heißt die nächste „offen“. Tippen auf eine offene oder laufende Haltestelle beginnt sie, auch wenn heute schon eine geschafft ist. Gesperrte Haltestellen tragen für Screenreader den Text „gesperrt“.
- Eine Beschriftung in Großbuchstaben, die innerhalb einer Ansicht einen neuen Abschnitt beginnt, hat 24 px Abstand nach oben (iPad 32 px).
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

Der Berg ist Schmuck mit Bedeutung, aber keine Bedienung: `aria-hidden`, nicht antippbar. Der Stand steht als Text bei der Linie („1 von 10 abgeschlossen“).

## Aufbau der Ansichten

Unter 700 px Breite gilt das Telefon-Raster, ab 700 px das iPad-Raster.

| Ansicht | Telefon | iPad |
|---|---|---|
| Startseite | Eine Spalte: Kopf mit Datum, „Tag n“ und Berg, Block „Heute“, Zeile mit der offenen Mission, Linie zum Scrollen. Der Hauptknopf sitzt fest über der unteren Leiste. | Kopf über die volle Breite. Darunter zwei gleich breite Spalten mit 48 px Abstand: links Block „Heute“, Hauptknopf und die offene Mission mit ihren Sätzen zum Mitnehmen, rechts die ganze Linie mit allen elf Punkten. |
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

## Fahrplan der Einheit

Jede Lerneinheit beginnt mit einer Übersicht dessen, was heute kommt. Sie greift die Liste zum Abhaken aus dem Tagebuch-Entwurf auf.

- Oben die Beschriftung („Heute · Haltestelle 2“) und der Name der Haltestelle mit Marker. Bei einer Sitzung nur zum Wiederholen oder der freien Runde steht dort die deutsche große Zeile („Wiederholen“, „10 Karten extra“).
- Darunter die Schritte als Liste mit Haarlinien, jede Zeile mindestens 48 px hoch. Links ein Kästchen von 20 px mit 1,5 px Rand in tinta und 4 px Eckenradius, erledigt gefüllt in atlántico mit Haken in nieve. Dann der Name des Schritts, rechts in ceniza eine kurze Angabe: „16 Karten“, „15 Karten“, das Grammatikthema, der Ort des Dialogs, „18 Aufgaben“, der Titel der Mission.
- Wiederholen steht nur in der Liste, wenn es heute aussteht. Schon erledigte Schritte der Haltestelle sind abgehakt.
- Der Hauptknopf heißt „Beginnen“ oder, wenn die Haltestelle schon läuft, „Weiter bei Schritt 3“. Erst dieses Tippen baut die erste Aufgabe und spricht sie. So startet auch der erste Ton der Einheit in einem Tippen, und die Stimmenliste des Geräts hatte Zeit zu laden.

Die Angabe rechts in einer Fahrplanzeile steht in einer Zeile und ist rechtsbündig. Nur lange Angaben wie ein Grammatikthema dürfen umbrechen, dann bekommt die Angabe bis zu zwei Drittel der Zeilenbreite.

## Rollenspiel, Schreiben, Zeigen

- Rollenspiel im Dialog: Die Zeilen der anderen Person erscheinen wie beim Anhören. Bei einer eigenen Zeile steht nur die deutsche Vorgabe in ceniza und der Hauptknopf „Aufdecken“. Danach erscheint die spanische Lösung mit Marker und wird gesprochen, darunter stehen zwei Antwortzeilen: „Saß“ und „Noch mal“. „Noch mal“ verdeckt die Zeile wieder, höchstens einmal je Zeile. Nach „Aufdecken“ geht der Fokus auf die aufgedeckte Zeile, damit auch ein Screenreader die Lösung vorliest.
- Schreiben: oben die deutsche Frage (24 px, iPad 32 px), darunter das Eingabefeld für Spanisch. Darüber oder darunter eine Reihe Textknöpfe für die Zeichen á é í ó ú ñ ü ¿ ¡, jeder mindestens 44 px breit und hoch, die das Zeichen an der Schreibmarke einfügen. Der Hauptknopf heißt „Prüfen“ und ist gesperrt, solange das Feld leer ist. Stimmt bis auf einen Akzent alles, lautet die Rückmeldung „Richtig. Achte auf den Akzent: está.“ Unter dem Feld steht der Textknopf „Weiß ich nicht“. Nach einer falschen Eingabe steht unter der Rückmeldung der Textknopf „Meine Antwort stimmt auch“. Das Feld heißt „Deine Antwort“, die Zeichenknöpfe heißen für Screenreader „á einfügen“ und so weiter.
- Zeigen im Sprachführer: Vollbild auf página über der ganzen App, auch über der unteren Leiste. Der Satz steht so groß, wie er in vier Zeilen passt (mindestens 48 px, iPad 72 px), zentriert in der Höhe, darunter klein in ceniza die Übersetzung. Unten zwei Textknöpfe „Langsam vorlesen“ und „Schließen“, kein Hauptknopf.
- Sterne im Sprachführer: Der Stern ist ein Strichsymbol rechts in der Zeile, gemerkt gefüllt in plátano mit Kontur in tinta, mit dem Namen „Merken“ oder „Nicht mehr merken“.

## Paare, Satzbau, Eingabe, Zusammenfassung

- Paare: zwei Spalten nebeneinander, links die vier spanischen Zeilen, rechts die vier deutschen. Jede Zeile ist wie eine Antwortzeile gebaut (Haarlinien, 56 px, iPad 68 px), aber ohne Auswahlkreis. Gewählt: Marker hinter dem Text, auch beim deutschen. Gefunden: Text in ceniza mit Haken in drago, nicht mehr wählbar. Falsches Paar: Beide Zeilen zeigen das Kreuz in mojo, bis die nächste Zeile angetippt wird.
- Satzbau: Oben steht die Satzzeile auf einer Grundlinie von 1,5 px in tinta, mindestens 56 px hoch, sie bricht um. Darunter liegen die Bausteine als Wortknöpfe: Newsreader kursiv 20 px (iPad 24 px), Rand 1,5 px in tinta, 8 px Eckenradius, mindestens 48 px hoch und 44 px breit, 8 px Abstand. Ein gesetzter Baustein wandert in die Satzzeile und hinterlässt einen leeren Platz mit Rand in raya. Tippen auf ein Wort in der Satzzeile nimmt es zurück. Der Hauptknopf heißt „Prüfen“ und ist gesperrt, bis alle Bausteine gesetzt sind.
- Eingabefelder (Name, Notiz, Suche, Schreiben): Beschriftung darüber im Stil der Großbuchstaben-Beschriftung, darunter das Feld ohne Kasten mit Unterstrich von 1,5 px in tinta, im Fokus 2,5 px in atlántico. Schrift 17 px (iPad 19 px). Wird Spanisch getippt, steht es in Newsreader kursiv mit 24 px (iPad 32 px).
- Zusammenfassung am Ende einer Haltestelle: der Berg mit dem neuen Stand, eine Zeile Anerkennung, darunter eine Liste mit Haarlinien (neue Karten, richtige Antworten, Punkte und Serie außer im Ruhemodus), danach die Mission mit ihren Sätzen zum Mitnehmen.
- Wo die Vorlagen Zwischenwerte benutzen, zum Beispiel 14 px zwischen Haltepunkt und Name, gelten die Werte der Vorlagen.

## Bewegung

- Übergänge zwischen Aufgaben 150 ms, nur Deckkraft und 8 px Versatz.
- Kein Wackeln, kein Aufblitzen des ganzen Bildschirms.
- Abschluss einer Haltestelle: Der Punkt auf der Linie füllt sich, die Linie wächst zum nächsten Punkt, am Berg rückt die Markierung einen Punkt höher. Das ist die einzige längere Animation (600 ms). Sie läuft in der Zusammenfassung am Ende der Haltestelle: Der Berg erscheint mit dem alten Stand und wechselt dann auf den neuen.
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
| Nur Mission offen | Heute | Für heute fertig (Deutsch, Figtree 600) | Morgen geht es weiter mit Haltestelle 3, Los números. Draußen wartet deine Mission. | Mission ansehen |
| Alles erledigt | Heute | Für heute fertig (Deutsch, Figtree 600) | Morgen: Haltestelle 3, Los números | 10 Karten extra |

Die offene Mission steht nur einmal auf der Startseite: in der angehefteten Zeile, nicht zusätzlich im Block „Heute“. Gibt es keine nächste Haltestelle mehr, entfällt der Satz mit „Morgen“. „10 Karten extra“ erscheint nur, wenn es Karten aus abgeschlossenen Haltestellen gibt.

Weitere Fälle:

| Zustand | Beschriftung | Große Zeile | Erklärzeile | Hauptknopf |
|---|---|---|---|---|
| Nichts fällig, Haltestelle offen | Heute · Haltestelle 2 | En el café | Getränke bestellen. 15 neue Karten. | Haltestelle beginnen |
| Wiederholen fällig, Haltestelle läuft schon | Heute · Haltestelle 2 | En el café | Erst 16 Karten wiederholen, dann weiter bei Schritt 3 von 6. | Mit Wiederholen beginnen |
| Nichts fällig, Haltestelle läuft schon | Heute · Haltestelle 2 | En el café | Weiter bei Schritt 3 von 6: Grammatik. | Haltestelle fortsetzen |
| Nur Wiederholen, alle Haltestellen geschafft | Heute | Wiederholen (Deutsch, Figtree 600) | 12 Karten sind fällig. | Mit Wiederholen beginnen |
| Endstation offen, nichts fällig | Heute · Endstation | Repaso final (Spanisch, mit Marker) | 30 gemischte Aufgaben über alle Karten. | Endstation beginnen |
| Endstation offen, Wiederholen fällig | Heute · Endstation | Repaso final | Erst 12 Karten wiederholen, dann 30 gemischte Aufgaben. | Mit Wiederholen beginnen |
| Endstation geschafft | Heute | Linie geschafft (Deutsch, Figtree 600) | 26 von 30 richtig an der Endstation. | Deine Linie ansehen |

Die Schritte heißen: 1 Wiederholen, 2 Neue Karten, 3 Grammatik, 4 Dialog, 5 Abschlussrunde, 6 Mission.

Im Kopf der Startseite steht unter dem Datum „Tag n“: die Kalendertage seit dem ersten Start, ohne Obergrenze und ohne „von 10“.

## Was nicht vorkommt

- Inter, Roboto, Arial oder die Systemschrift als Hauptschrift
- Farbverläufe
- Schatten, Karten mit Rahmen, Kästen in Kästen
- drei Kacheln mit Symbol nebeneinander als Startseite
- Symbole als Schmuck ohne Funktion
- Fotos, generierte Bilder oder weitere Illustrationen neben dem Berg
- Emojis
