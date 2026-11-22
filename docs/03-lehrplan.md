# Lehrplan

Die Inhalte liegen fertig in `content/`. Dieses Dokument erklärt den Aufbau. Bei Abweichungen gelten die JSON-Dateien.

## Die Linie

Die Daten sind eine Empfehlung. Eine Haltestelle öffnet, sobald die vorige abgeschlossen ist, unabhängig vom Kalender.

| Nr. | Empfohlen am | Haltestelle | Thema | Grammatik | Karten | Mission |
|---|---|---|---|---|---|---|
| 1 | Mo 23.11. | ¡Hola! | Begrüßen und vorstellen | ser in der Einzahl: soy, eres, es | 16 | Dreimal grüßen |
| 2 | Di 24.11. | En el café | Getränke bestellen | Artikel und Geschlecht: un, una, el, la | 15 | Bestellen ohne Englisch |
| 3 | Mi 25.11. | Los números | Zahlen und Preise | Zahlen bauen | 15 | Preis erfragen |
| 4 | Do 26.11. | En el restaurante | Essen bestellen | tener: tengo, tienes, tiene | 16 | Ein Gericht auf Spanisch |
| 5 | Fr 27.11. | ¿Dónde está? | Wege und Orte | estar für Orte, hay für „es gibt“ | 15 | Nach dem Weg fragen |
| 6 | Sa 28.11. | De compras | Einkaufen | querer: quiero, quieres, quiere | 16 | Einkauf auf Spanisch |
| 7 | So 29.11. | Yo y tú | Ins Gespräch kommen | Verben auf -ar: hablo, hablas, habla, hablamos | 15 | Drei Sätze Gespräch |
| 8 | Mo 30.11. | Me gusta | Vorlieben, Strand und Wetter | gustar: me gusta, me gustan | 16 | Drei Dinge, die dir gefallen |
| 9 | Di 01.12. | ¿Cuándo? | Zeiten und Pläne | ir: voy, vas, va, vamos | 15 | Uhrzeit erfragen und Plan machen |
| 10 | Mi 02.12. | En ruta | Unterwegs und in der Unterkunft | poder und necesitar | 15 | Ein Anliegen auf Spanisch |
| Endstation | Do 03.12. | Repaso final | 30 gemischte Aufgaben über alle Karten | | | |

Summe: 154 Karten, davon 72 Einzelwörter, 63 Wendungen und 19 Satzmuster mit Lücke (zum Beispiel „quiero …“).

## Warum diese Reihenfolge

Die Grammatik folgt der üblichen A1-Abfolge: erst sein und haben, dann Orte, Wünsche, regelmäßige Verben, Vorlieben, Zukunft, können. Jeder Baustein hängt an einer Urlaubssituation, in der man ihn sofort braucht.

- Haltestelle 1 bis 3 liefern das, was vom ersten Tag an trägt: grüßen, bestellen, Preise verstehen.
- Haltestelle 4 bis 6 decken Restaurant, Wege und Einkauf ab. Damit sind die häufigsten Alltagssituationen erreichbar.
- Haltestelle 7 bis 10 öffnen das Gespräch: über sich sprechen, Vorlieben, Pläne, Hilfe erbitten. Mit „ir a“ aus Haltestelle 9 kann sie über die Zukunft reden, ohne eine neue Zeitform zu lernen.

## Was jede Haltestelle enthält

| Teil | Inhalt | Feld in der JSON-Datei |
|---|---|---|
| Kann-Beschreibung | Ein Satz, was sie danach kann | `can_do_de` |
| Karten | 15 oder 16 Wörter und Wendungen mit Übersetzung, teils mit Hinweis | `items` |
| Grammatik | Erklärung, Tabelle, drei Beispielsätze | `grammar` |
| Lückensätze | Vier Sätze zur Grammatik mit Auswahl | `cloze` |
| Satzbau | Drei Sätze zum Zusammensetzen | `build` |
| Dialog | Sechs bis neun Zeilen aus einer Urlaubsszene | `dialogue` |
| Mission | Eine Aufgabe für draußen mit zwei bis drei Sätzen zum Mitnehmen | `mission` |
| Kanaren-Notiz | Eine Besonderheit der Inseln | `canarias_de` |

Haltestelle 1 hat zusätzlich sieben Aussprachehinweise (`tips_de`).

## Kanarisches Spanisch

Die Inhalte folgen dem Sprachgebrauch der Kanaren, wo er vom Festland abweicht:

- Für „ihr“ steht ustedes mit der Verbform der dritten Person. Vosotros-Formen kommen nicht vor.
- Kartoffeln heißen papas, der Bus guagua.
- Die Aussprachehinweise erklären, dass z und c vor e oder i wie s klingen. Die Systemstimme des iPads spricht meist Festland-Spanisch. Die App lässt die Wahl zwischen allen spanischen Stimmen des Geräts, auch lateinamerikanischen, die dem kanarischen Klang näherkommen.

Alle Kanaren-Notizen sind gegen Quellen geprüft, siehe docs/08-quellen.md.

## Weibliche Formen

Die Lernende ist eine Frau. Wo Spanisch nach Geschlecht unterscheidet, steht die weibliche Form, mit Hinweis auf die männliche: encantada, alérgica, vegetariana.

## Sprachführer

56 Sätze zum Nachschlagen und Vorzeigen, getrennt vom Kurs: Notfall und Gesundheit (6), Unverträglichkeiten und Sonderwünsche (10), Im Restaurant (9), Unterkunft (7), Unterwegs (7), Einkaufen (5), Strand und Ausflug (6), Höflich bleiben (6).

## Nicht enthalten

Diese A1-Themen fehlen und sind Kandidaten für die Zeit nach dem Urlaub:

- Familie, Berufe, Personen beschreiben
- Tagesablauf und reflexive Verben (me levanto, me ducho)
- vollständige Konjugation der Verben auf -er und -ir, Mehrzahlformen außer nosotros
- Uhrzeiten mit Minuten, Datum und Monate
- Vergangenheit (pretérito perfecto)
- Possessivbegleiter (mi, tu, su) und Demonstrativa (este, esta)

Neue Haltestellen entstehen als weitere Dateien `content/units/u11.json` und folgende. Das Schema steht in `content/SCHEMA.md`, der Agent `content-editor` kennt die Regeln.
