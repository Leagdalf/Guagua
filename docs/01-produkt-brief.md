# Produkt-Brief: Guagua

Stand 22.11.2026. Auftraggeber ist Florian. Die Entscheidungen in Abschnitt 5 hat er am 22.11.2026 getroffen.

## 1. Worum es geht

Florians Freundin lernt im Teneriffa-Urlaub Spanisch. Sie fängt bei null an, hat 15 bis 20 Minuten am Tag und benutzt ein iPad. Der Urlaub endet am 03.12.2026.

Die App gibt ihr einen systematischen A1-Einstieg, dessen Beispiele aus dem Urlaub stammen: Café, Restaurant, Markt, Strand, Fähre. Nach jeder Tageseinheit hat sie einen Satz, den sie am selben Tag draußen ausprobieren kann.

Der Arbeitstitel „Guagua“ ist das kanarische Wort für Bus. Der Kurs ist als Buslinie mit zehn Haltestellen gebaut, eine pro Urlaubstag.

## 2. Was in elf Tagen realistisch ist

Zehn Lerntage mit 15 bis 20 Minuten ergeben 150 bis 200 Minuten, also rund drei Stunden. Cambridge nennt als Richtwert etwa 90 bis 100 angeleitete Lernstunden bis zum Niveau A1. Die Zahl gilt für Englisch, als Größenordnung passt sie auch für Spanisch (Quelle in docs/08-quellen.md).

Die App deckt deshalb einen Ausschnitt von A1 ab, keinen Abschluss:

| Baustein | Umfang |
|---|---|
| Lernkarten (Wörter und Wendungen) | 154 |
| Grammatikbausteine | 10 |
| Dialoge | 10 mit zusammen 74 Zeilen |
| Missionen für draußen | 10 |
| Sätze im Sprachführer | 56 in 8 Kategorien |

Was von A1 fehlt, steht in docs/03-lehrplan.md unter „Nicht enthalten“.

## 3. Woran wir am 03.12. Erfolg messen

| Kriterium | Zielwert | Woher die Zahl kommt |
|---|---|---|
| Haltestellen abgeschlossen | 10 von 10 | App, Ansicht „Linie“ |
| Missionen erledigt | mindestens 7 von 10 | App, Ansicht „Missionen“ |
| Abschlussrunde an der Endstation | mindestens 24 von 30 richtig | App |
| Lernzeit pro Tag | Median zwischen 15 und 20 Minuten | App misst die aktive Zeit je Tag |
| Essen bestellen ohne Englisch | einmal gelungen | Mission 4, eigene Einschätzung |

Liegt die gemessene Lernzeit nach den ersten drei Tagen über 20 Minuten, wird die Obergrenze der Wiederholungen gesenkt (siehe Spezifikation, Abschnitt 5).

## 4. Wie die App lehrt

Florian hat drei Lernstile gewählt. Jeder hat eine feste Entsprechung in der App.

| Lernstil | Umsetzung |
|---|---|
| Echte Aufgaben vor Ort | Jede Haltestelle endet mit einer Mission für draußen, zum Beispiel ein Getränk auf Spanisch bestellen. Die Mission wird später abgehakt, mit kurzer Notiz, wie es lief. |
| Spielerisch | Punkte, Tagesserie und eine Linie, die sich Haltestelle für Haltestelle füllt. Es gibt keine Leben, keinen Zeitdruck und keinen Punktabzug. |
| Ruhig und strukturiert | Karteikasten mit festen Wiederholabständen, Spickzettel für Grammatik und Zahlen, ein Ruhemodus, der Punkte und Animationen ausblendet. |

Eine Tageseinheit läuft immer gleich ab: Wiederholen, neue Karten, Grammatik, Dialog, Abschlussrunde, Mission.

## 5. Getroffene Entscheidungen

| Frage | Entscheidung | Folge |
|---|---|---|
| Wie kommt die App aufs iPad? | Web-App (PWA), über Safari auf den Home-Bildschirm | Kein Mac, kein Apple-Developer-Konto, kein App Store. Entwicklung am Windows-PC. |
| Lernziel | A1 mit Schwerpunkt und Beispielen aus dem Urlaub | Grammatik in fester Reihenfolge, Wortschatz aus Urlaubssituationen. |
| Tagespensum | 15 bis 20 Minuten | Höchstens 16 neue Karten pro Tag, Wiederholen auf 40 Karten oder 6 Minuten begrenzt. |
| Lernstil | Alle drei: Aufgaben vor Ort, spielerisch, ruhig | Siehe Abschnitt 4. |
| Wer entwickelt? | Claude Code mit Subagenten auf Sonnet | Agenten und Arbeitspakete liegen in `.claude/agents` und docs/05-arbeitspakete.md. |
| Gerät | iPad als Hauptgerät, das iPhone bleibt benutzbar | Ab 700 Pixel Breite gilt das iPad-Raster, darunter eine Spalte. Hoch- und Querformat. |
| Gestaltung | Entwurf 6 aus sechs Mockups: Tagebuch-Gestaltung, Fahrplan-Linie, Berg | docs/04-design.md, Vorlagen in docs/mockups/project. Punkte und Serie stehen nicht auf der Startseite. |

## 6. Was die erste Version bewusst nicht kann

- Kein App Store und kein TestFlight. Beides braucht ein bezahltes Apple-Developer-Konto, bei einer nativen App zusätzlich einen Mac.
- Kein Server, kein Login, keine Synchronisierung zwischen Geräten. Der Fortschritt liegt nur auf dem Gerät, auf dem sie lernt.
- Keine Spracherkennung. In Web-Apps auf dem Home-Bildschirm ist sie unter iOS unzuverlässig, die Quellen widersprechen sich. Stattdessen: nachsprechen und sich selbst einschätzen.
- Kein KI-Gesprächspartner. Dafür bräuchte es einen Server mit API-Schlüssel.
- Keine vosotros-Formen. Auf den Kanaren sagt man ustedes.

## 7. Offene Punkte für Florian

1. Modell und iPadOS-Version ihres iPads notieren (Einstellungen, Allgemein, Info). Die Agenten brauchen die Angabe für den Gerätetest.
2. GitHub-Konto vorhanden und `gh` am PC angemeldet? Sonst vor dem Deployment einrichten.
3. Das Repository muss für kostenloses GitHub Pages öffentlich sein. Code und Lerninhalte sind dann für jeden lesbar, persönliche Daten stehen nicht darin. Wenn das nicht passt, vor AP6 Bescheid geben. Florian hat am 22.11.2026 ein GitHub-Konto angelegt, die App geht über GitHub Pages. Die Freigabe für das öffentliche Repository holt die Hauptsitzung vor AP6 ein.
4. Bleibt der Name „Guagua“ auf dem Home-Bildschirm?
5. Den Sprachführer-Block „Unverträglichkeiten und Sonderwünsche“ durchsehen. Er enthält gängige Beispiele (Gluten, Milch, Nüsse, Soja, Meeresfrüchte) und lässt sich in `content/phrasebook.json` ergänzen.

## 8. Risiken

| Risiko | Folge | Gegenmaßnahme |
|---|---|---|
| Die App wird später fertig als geplant | Jeder verlorene Tag kostet eine von zehn Haltestellen | Haltestellen sind nicht an ein Datum gebunden, zwei pro Tag sind möglich. Der MVP-Schnitt in docs/05-arbeitspakete.md legt fest, was zuerst kommt. |
| Auf dem iPad fehlt eine spanische Stimme oder sie klingt schlecht | Hörübungen fallen aus | Stimmenauswahl in den Einstellungen, Hinweis zum Nachladen, alle Übungen funktionieren auch ohne Ton. |
| Fortschritt geht verloren | Motivation bricht ein | Export und Import als Datei, automatische Sicherung vor jedem Import. |
| Unterwegs kein Netz | App startet nicht | Nach dem ersten Laden läuft alles offline, auch Schrift und Inhalte. |
| Fehler in den Lerninhalten | Sie lernt etwas Falsches | Prüfskript `tools/validate-content.mjs`, Agent `content-editor`, Quellenliste in docs/08-quellen.md. |
