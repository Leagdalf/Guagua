# Arbeitspakete

Acht Pakete, AP0 bis AP7. Jedes hat einen Zuständigen, eigene Dateien und prüfbare Abnahmekriterien. Die Hauptsitzung in Claude Code koordiniert, Subagenten setzen um.

## Reihenfolge

| Phase | Pakete | Wie |
|---|---|---|
| 0 | AP0 Gerüst | Hauptsitzung, allein |
| 1 | AP1 Kernlogik, AP2 Oberfläche, AP3 Ton und Sprachführer | drei `pwa-builder` gleichzeitig |
| 2 | AP4 Lerneinheit, AP5 Linie, Missionen, Mehr | zwei `pwa-builder` gleichzeitig |
| 3 | AP6 PWA und Deployment | ein `pwa-builder`, Freigabe durch Florian vor dem Veröffentlichen |
| 4 | AP7 Abnahme | `qa-reviewer`, danach Gerätetest mit Florian |

Parallele Pakete teilen sich keine Dateien. Braucht ein Agent eine Änderung in fremden Dateien, meldet er das an die Hauptsitzung und ändert nichts selbst.

Nach jeder Phase prüft `qa-reviewer` die Abnahmekriterien der Phase. Erst wenn sein Bericht keine Blocker enthält, startet die nächste.

## Schnitt für den ersten Abend

Ziel: Am Morgen des 23.11. kann sie Haltestelle 1 auf dem iPad machen.

| Am ersten Abend (MVP) | Danach, bis zum genannten Tag |
|---|---|
| Erster Start mit Name und Stimmentest | Aufgabentyp „Schreiben“ (wird erstmals am 27.11. gebraucht, wenn die Karten von Haltestelle 1 in Fach 3 fällig sind; bis dahin springt „Erinnern“ ein) |
| Linie mit Zuständen | Rollenspiel im Dialog (bis 24.11.) |
| Lerneinheit mit Erkennen, Hören, Erinnern, Paare, Lücke, Satzbau | Export und Import (bis 25.11.) |
| Dialog anhören | Ruhemodus, Lernzeit-Anzeige (bis 25.11.) |
| Karteikasten und Wiederholrunde | Spickzettel (bis 25.11.) |
| Missionen abhaken | „Zeigen“-Vollbild im Sprachführer, Sterne (bis 24.11.) |
| Sprachführer mit Ton und Suche | Endstation (bis 02.12.) |
| Offline, Installation, Deployment | Playwright-Ablauftest (bis 25.11.) |

Die Pakete unten beschreiben den vollen Umfang. Punkte, die nicht zum MVP gehören, sind mit „(später)“ markiert und bekommen eigene Folgeaufträge.

## AP0 Gerüst

Zuständig: Hauptsitzung.

Aufgaben:

1. Vite-Projekt mit React und TypeScript im bestehenden Ordner anlegen, ohne `content/`, `docs/`, `tools/`, `.claude/` oder `CLAUDE.md` zu überschreiben.
2. Vitest einrichten. `npm test` führt Unit-Tests und `node tools/validate-content.mjs` aus.
3. `src/core/types.ts` aus `content/SCHEMA.md` und docs/02-spezifikation.md, Abschnitt 4.2 ableiten. `src/core/content.ts` importiert alle JSON-Dateien und exportiert sie typisiert.
4. `src/core/config.ts` mit den Stellgrößen aus Abschnitt 5 der Spezifikation.
5. Ordner anlegen: `src/core`, `src/audio`, `src/ui`, `src/styles`, `src/features/{session,home,missions,phrasebook,more,onboarding}`.
6. `git init`, erster Commit. Kein Remote.

Abnahme:

- `npm run build` und `npm test` laufen ohne Fehler.
- Ein Test belegt: `content.ts` liefert 10 Einheiten und 154 Karten.
- `git status` ist sauber, `node_modules` und `dist` sind ignoriert.

## AP1 Kernlogik

Zuständig: `pwa-builder`. Dateien: `src/core/**` außer `types.ts`, `content.ts`, `config.ts` (nur lesen, Änderungswünsche melden).

Aufgaben: Karteikasten, Wiederholrunde, Aufgabenerzeugung mit falschen Antworten, Antwortprüfung fürs Schreiben, Punkte, Serie, Lernzeit, Speichern und Laden des Fortschritts, Ablaufsteuerung der sechs Schritte, Export und Import (später). Alles als reine Funktionen ohne React, mit austauschbarer Uhr und austauschbarem Zufall.

Abnahme, jeweils durch Unit-Tests belegt:

- Abstände 0, 1, 3, 6, 12 Tage. Richtig hebt um ein Fach, falsch setzt auf Fach 1 mit Fälligkeit morgen.
- Simulation über elf Tage mit lauter richtigen Antworten ergibt dieselben Tageswerte wie `node tools/simulate-reviews.mjs` bei Grenze 40: 0, 16, 15, 15, 32, 30, 31, 31, 31, 31, 40.
- Wiederholrunde sortiert nach Fach, dann Fälligkeit, und endet bei 40 Karten.
- Keine Auswahlaufgabe enthält zwei gleiche Antworten oder die richtige Antwort doppelt. Geprüft über alle 154 Karten in beiden Richtungen.
- Antwortprüfung: „esta“ für „está“ ist richtig mit Hinweis, „manana“ für „mañana“ ist falsch, „¿Cuánto cuesta?“ und „cuanto cuesta“ gelten als gleich bis auf den Akzent-Hinweis.
- Kaputtes oder fremdes JSON im Speicher führt zu einem definierten Fehlerzustand, nicht zu einem Absturz und nicht zum Überschreiben.
- Satzmuster erscheinen nie als Schreibaufgabe.

## AP2 Oberfläche

Zuständig: `pwa-builder`. Dateien: `src/ui/**`, `src/styles/**`, `index.html`.

Aufgaben: Farben, Schriften und Abstände aus docs/04-design.md als CSS-Variablen. Schriften über die Fontsource-Pakete einbinden. Bausteine: Hauptknopf, Textknopf, Marker, Antwortzeile mit Zuständen, Tonknopf, Haltepunkt, Linie, Berg mit den Zuständen der zehn Haltepunkte, Fortschritt der Einheit, untere Leiste, Hinweisleiste. Dazu die beiden Seitenraster aus dem Design-Dokument: eine Spalte unter 700 Pixel Breite, das iPad-Raster darüber. Eine Vorschauseite unter `?preview` zeigt alle Bausteine in allen Zuständen.

Abnahme:

- Die Vorschauseite zeigt jeden Baustein in jedem Zustand, bei 390, 820 und 1180 Pixel Breite ohne waagerechtes Scrollen.
- Im gebauten CSS kommt keine der Schriften Inter, Roboto, Arial als erste Wahl vor, kein `linear-gradient`, und `box-shadow` steht nur in der Marker-Regel.
- Spanischer Beispieltext steht kursiv in Newsreader und trägt `lang="es"`.
- Tippflächen messen mindestens 44 mal 44 Pixel.
- Untere Leiste und Hauptknopf berücksichtigen `env(safe-area-inset-bottom)`.
- Alle Farbpaare stammen aus der Kontrasttabelle im Design-Dokument.

## AP3 Ton und Sprachführer

Zuständig: `pwa-builder`. Dateien: `src/audio/**`, `src/features/phrasebook/**`.

Aufgaben: Tonmodul nach Abschnitt 3 der Spezifikation. Sprachführer nach Abschnitt 2.6, im MVP ohne Sterne und ohne „Zeigen“. Bis AP2 fertig ist, mit einfachen Platzhalter-Bausteinen arbeiten und diese am Ende ersetzen.

Abnahme:

- Unit-Tests mit nachgebildetem `speechSynthesis`: Stimmenwahl in der Reihenfolge gespeichert, es-ES, es-MX, es-US, sonstige; leere Liste führt zum Zustand „kein Ton“; `…` und `{name}` werden vor dem Sprechen ersetzt.
- `speak` wird nur aus Klick-Behandlungen aufgerufen. Im Code gibt es keinen Aufruf aus Zeitgebern oder Effekten.
- Die Suche nach „medico“ findet „Necesito un médico.“ Die Suche nach „WASSER“ findet genau zwei Sätze: „Otra agua, por favor.“ und „No hay agua caliente.“ Die Suche nach „xyz“ zeigt einen leeren Zustand mit Text.
- Alle Sätze werden angezeigt (seit dem 23.11.2026 sind es 61 in 9 Kategorien), der Hinweis zur Notrufnummer steht über den Sätzen der Kategorie „Notfall und Gesundheit“.

## AP4 Lerneinheit

Zuständig: `pwa-builder`. Dateien: `src/features/session/**`. Voraussetzung: AP1 bis AP3.

Aufgaben: Die sechs Schritte nach Abschnitt 2.3 mit den Aufgabentypen aus 2.4. Rollenspiel und Schreiben (später). Zwischenstand speichern und fortsetzen. Rückmeldung nach jeder Antwort wie beschrieben.

Abnahme:

- Haltestelle 1 lässt sich von Anfang bis Ende durchspielen. Danach sind 16 Karten in Fach 2 oder 1, die Einheit ist abgeschlossen, Mission 1 ist offen.
- App neu laden mitten in Schritt 3 setzt bei Schritt 3 fort.
- Mit simuliertem Folgetag startet die Einheit mit „Wiederholen“ und zeigt 16 Karten.
- Der Ton der nächsten Karte startet im selben Tippen, das die Karte zeigt.
- Ohne spanische Stimme wird aus „Hören“ die Aufgabe „Erkennen“, die Einheit bleibt durchspielbar.

## AP5 Linie, Missionen, Mehr, erster Start

Zuständig: `pwa-builder`. Dateien: `src/features/{home,missions,more,onboarding}/**`, `src/App.tsx`. Voraussetzung: AP1 bis AP3.

Aufgaben: Abschnitte 2.1, 2.2, 2.5 und 2.7 der Spezifikation. Spickzettel, Ruhemodus, Export und Import, Lernzeit-Anzeige (später). Endstation nach 2.8 (später).

Abnahme:

- Erster Start: Installationshinweis nur außerhalb des Home-Bildschirm-Modus, Name ist Pflicht, Stimmentest spielt „Hola“ mit dem Namen.
- Die Linie zeigt nach Abschluss von Haltestelle 1 den ersten Punkt als abgeschlossen und den zweiten als offen.
- Der Block „Heute“ zeigt für die drei Zustände aus dem Design-Dokument die passenden Texte.
- Bei 820 Pixel Breite steht die Linie mit allen elf Punkten neben dem Block Heute, bei 390 Pixel darunter. Der Berg zeigt denselben Stand wie die Linie.
- Mission erledigen vergibt 50 Punkte genau einmal. Überspringen und späteres Erledigen funktionieren.
- Einstellungen ändern Name, Stimme und Tempo dauerhaft.

## AP6 PWA und Deployment

Zuständig: `pwa-builder`. Dateien: `vite.config.ts`, `public/**`, `.github/workflows/**`. Voraussetzung: AP4 und AP5.

Aufgaben: Manifest, App-Symbol nach Design-Dokument, Service Worker mit Vorhalten aller Dateien, Update-Hinweis, Meta-Angaben für iOS nach Abschnitt 6. Workflow für GitHub Pages. Vor dem Anlegen des öffentlichen Repositorys und vor dem ersten Push fragt die Hauptsitzung Florian.

Abnahme:

- `npm run build`, dann `npm run preview`: Die App lädt, nach Abschalten des Netzes im Browser lädt sie erneut vollständig, einschließlich Schriften.
- Das Manifest enthält Name, Symbole in 192 und 512 Pixel, `display: standalone`. `apple-touch-icon` mit 180 Pixel ist verlinkt.
- Unter der Pages-Adresse funktionieren Start, Neuladen und Offline-Start. Der Pfad des Repositorys ist in `base`, `start_url` und `scope` berücksichtigt.
- Die Seite stellt nach dem ersten Laden keine Anfragen an fremde Domains (im Netzwerk-Protokoll geprüft).
- Ein zweiter Build mit geänderter Versionsnummer zeigt in der laufenden App den Hinweis „Neue Version bereit“.

## AP7 Abnahme

Zuständig: `qa-reviewer`, danach Florian am iPad.

Aufgaben: Alle Abnahmekriterien von AP0 bis AP6 erneut prüfen. Playwright-Ablauf mit WebKit und iPad-Viewport schreiben lassen (später, durch `pwa-builder`). Design gegen docs/04-design.md prüfen, Texte gegen den Abschnitt „Texte“. Gerätetest nach docs/06-deployment-und-ipad.md.

Abnahme:

- Bericht mit einer Zeile je Kriterium: erfüllt, nicht erfüllt oder nicht prüfbar, mit Beleg (Testname, Befehl, Datei und Zeile).
- Kein offener Blocker.
- Gerätetest von Florian abgehakt.

## Folgeaufträge nach dem MVP

In dieser Reihenfolge, jeder als eigener Auftrag an `pwa-builder` mit anschließender Prüfung:

1. Rollenspiel im Dialog, „Zeigen“ und Sterne im Sprachführer (bis 24.11.)
2. Export und Import, Ruhemodus, Lernzeit, Spickzettel, Playwright-Ablauf (bis 25.11.)
3. Aufgabentyp „Schreiben“ (bis 26.11.)
4. Endstation (bis 02.12.)
5. Nach dem Urlaub: neue Haltestellen durch `content-editor`, siehe docs/03-lehrplan.md
