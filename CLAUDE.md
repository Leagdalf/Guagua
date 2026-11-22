# Guagua

Web-App (PWA) fürs iPad, mit der eine Anfängerin im Teneriffa-Urlaub Spanisch lernt. Auf dem iPhone bleibt sie benutzbar. Zehn Tageseinheiten („Haltestellen“) plus Sprachführer. Termin: 03.12.2026. Auftraggeber: Florian.

## Stand

22.11.2026: Konzept, Lerninhalte, Prüfskripte und Agenten sind fertig. App-Code gibt es noch nicht. Der Fahrplan steht in docs/05-arbeitspakete.md.

Am selben Tag hat Florian die Gestaltung gewählt (Entwurf 6: Tagebuch-Gestaltung, Fahrplan-Linie, Berg) und das iPad als Hauptgerät festgelegt. docs/04-design.md und die Vorlagen in docs/mockups/project beschreiben diesen Stand. Die App wird über GitHub Pages ausgeliefert, Florian hat seit dem 22.11.2026 ein GitHub-Konto. Das Repository liegt bisher nur lokal, ohne Remote.

## Was wo steht

| Frage | Datei |
|---|---|
| Wozu, für wen, was gilt als Erfolg | docs/01-produkt-brief.md |
| Was die App tut, Datenmodell, Lernlogik, iOS-Regeln | docs/02-spezifikation.md |
| Aufbau der Lerninhalte | docs/03-lehrplan.md, content/SCHEMA.md |
| Farben, Schrift, Formen, Raster, Texte der Oberfläche | docs/04-design.md |
| Vorlagen der Gestaltung als HTML | docs/mockups/project (`iPad-*` fürs iPad, `Mix-*` fürs Telefon) |
| Arbeitspakete mit Abnahmekriterien | docs/05-arbeitspakete.md |
| Veröffentlichen, Installation, Gerätetest | docs/06-deployment-und-ipad.md |
| Belege | docs/08-quellen.md |

Vor jeder Aufgabe die Abschnitte lesen, die sie betrifft. Die Unterlagen sind verbindlich. Bei Lücken oder Widersprüchen nachfragen.

## Befehle

| Befehl | Zweck |
|---|---|
| `node tools/validate-content.mjs` | Lerninhalte prüfen, läuft schon jetzt |
| `node tools/simulate-reviews.mjs` | Wiederhollast durchrechnen |
| `npm run dev` | Entwicklungsserver (ab AP0) |
| `npm test` | Unit-Tests und Inhaltsprüfung (ab AP0) |
| `npm run build` | Produktions-Build (ab AP0) |

Node 26.13.1 und Git 2.56.1 sind seit dem 22.11.2026 installiert. Findet eine Shell `node`, `npm` oder `git` nicht, zuerst den Pfad setzen: `$env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;" + $env:Path`. Die GitHub CLI `gh` ist nicht installiert.

## Aufbau des Codes

```
src/core       Lernlogik ohne React: Typen, Inhalte, Karteikasten, Aufgaben, Speicher
src/audio      Sprachausgabe
src/ui         wiederverwendbare Bausteine
src/styles     CSS-Variablen, Schriften, Grundstile
src/features   Ansichten: session, home, missions, phrasebook, more, onboarding
content        Lerninhalte als JSON, werden ins Bundle importiert
tools          Prüfskripte ohne Abhängigkeiten
```

## Regeln

Technik:

- Vite, React, TypeScript, vite-plugin-pwa, Vitest. Kein Router, keine State-Bibliothek, kein UI-Framework, keine weiteren Abhängigkeiten ohne Rückfrage.
- Die installierten Pakete können neuer sein als dein Wissen. Lies deren Doku, bevor du konfigurierst.
- Lernlogik in `src/core` bleibt frei von React und vom Browser-Speicher. Uhr und Zufall werden hineingereicht.
- `speechSynthesis.speak` nur direkt aus einer Klick-Behandlung.
- Keine Anfragen an fremde Server, keine Analyse-Skripte, keine Schriften von einem CDN.
- Stellgrößen der Lernlogik stehen nur in `src/core/config.ts`.

Inhalte:

- `content/` ändert nur der Agent `content-editor`. Ids bleiben für immer gleich, weil der Lernfortschritt daran hängt.
- Nach jeder Änderung an `content/` muss `node tools/validate-content.mjs` ohne Fehler laufen.
- Keine erfundenen Tatsachen. Aussagen über die Kanaren brauchen einen Beleg in docs/08-quellen.md.

Gestaltung und Texte:

- docs/04-design.md gilt wörtlich: Farben, Schriften, Formen, Raster, die Liste „Was nicht vorkommt“. Die Vorlagen in docs/mockups/project zeigen das Zielbild.
- Oberfläche auf Deutsch in der Du-Form. Kein Lob-Automatismus, keine Emojis, keine Füllsätze.
- Spanischer Text steht kursiv in Newsreader und trägt `lang="es"`.

Sicherheit:

- Nichts tun, was sich nicht rückgängig machen lässt. Kein `git push --force`, kein `git reset --hard`, kein Löschen außerhalb des Projektordners.
- Vor dem Anlegen eines öffentlichen Repositorys und vor jeder Veröffentlichung Florian fragen.
- Keine persönlichen Daten in Code, Inhalten oder Commits. Der Name der Lernenden wird nur in der App eingegeben und bleibt auf dem Gerät.
- Keine E-Mails oder Nachrichten versenden.

## Arbeiten mit Subagenten

| Agent | Aufgabe | Schreibt in |
|---|---|---|
| `pwa-builder` | setzt ein Arbeitspaket um | die im Paket genannten Dateien |
| `content-editor` | ändert und erweitert Lerninhalte | `content/`, docs/08-quellen.md |
| `qa-reviewer` | prüft gegen Abnahmekriterien, berichtet | nichts |

Alle drei laufen mit `model: sonnet`. Die Hauptsitzung verteilt Pakete, hält die Reihenfolge aus docs/05-arbeitspakete.md ein und führt selbst nur AP0 aus. Jeder Auftrag an einen Subagenten enthält den vollständigen Text des Pakets, die Dateiliste und die nötigen Abschnitte der Spezifikation, weil Subagenten diese Unterhaltung nicht sehen.

## Fertig heißt

1. Jedes Abnahmekriterium des Pakets ist durch Test, Befehl oder Bildschirmfoto belegt.
2. `npm test` und `npm run build` laufen ohne Fehler.
3. Der Bericht nennt, was nicht geprüft werden konnte. Auf einem Windows-PC gehört dazu alles, was nur ein iPad oder iPhone zeigt.
4. Ein Commit je Paket mit einer Nachricht, die sagt, was sich für die Lernende ändert.
