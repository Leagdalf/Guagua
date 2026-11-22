# Spezifikation

Verbindlich für alle Arbeitspakete. Wo etwas fehlt oder sich widerspricht, fragt der Agent nach, statt zu raten.

## 1. Rahmen

| Punkt | Festlegung |
|---|---|
| Art | Web-App (PWA) für iOS Safari, installiert über „Zum Home-Bildschirm“ |
| Sprache der Oberfläche | Deutsch, Du-Form |
| Zielgerät | iPad im Hoch- und Querformat, Breite 744 bis 1366 CSS-Pixel. Unter 700 Pixel Breite (iPhone, 375 bis 430) zeigt die App dieselben Ansichten in einer Spalte. Raster und Höchstbreiten stehen in docs/04-design.md. |
| Netz | Nach dem ersten Laden vollständig offline nutzbar |
| Daten | Nur lokal im Browser-Speicher. Kein Server, kein Tracking, keine Anfragen an Dritte. |
| Technik | Vite, React, TypeScript, vite-plugin-pwa, Vitest. Kein Router, keine State-Bibliothek, kein UI-Framework. |

Paketstände laut `npm view` am 22.11.2026: vite 8.3.8, react 19.3.1, typescript 7.0.2, vite-plugin-pwa 2.0.0, @vite-pwa/assets-generator 2.0.0, vitest 5.1.1, @playwright/test 1.65.1, @fontsource/newsreader 5.3.0, @fontsource/figtree 5.3.0. Vitest 5 verlangt Node 22.12 oder neuer (installiert ist Node 26.13.1 mit npm 11.20.0), vite-plugin-pwa 2.0.0 nennt Vite 8 als unterstützt. Diese Stände können neuer sein als das Wissen des Modells. Vor jeder Konfiguration die Doku des installierten Pakets lesen und keine API aus dem Gedächtnis annehmen.

## 2. Aufbau der App

Fünf Bereiche. Vier liegen in der Leiste am unteren Rand, die Lerneinheit läuft im Vollbild ohne Leiste.

| Bereich | Zweck |
|---|---|
| Linie | Startansicht. Zeigt die zehn Haltestellen und die Endstation, den heutigen Schritt und die offene Mission. |
| Lerneinheit | Geführter Ablauf einer Tageseinheit im Vollbild. |
| Missionen | Alle Missionen, offen und erledigt. |
| Sprachführer | Sätze nach Situation zum Nachschlagen, Anhören und Vorzeigen. |
| Mehr | Spickzettel, Einstellungen, Fortschritt sichern, Über die App. |

### 2.1 Erster Start

1. Läuft die App in Safari und nicht vom Home-Bildschirm, erscheint zuerst die Anleitung zum Installieren (Teilen, dann „Zum Home-Bildschirm“). Ein Link „Trotzdem im Browser weitermachen“ überspringt sie. Erkennung über `navigator.standalone` und `display-mode: standalone`.
2. Name eingeben. Pflichtfeld, höchstens 30 Zeichen.
3. Stimme testen: Ein Knopf spielt „Hola, {name}“. Gibt es mehrere spanische Stimmen, stehen sie zur Wahl. Gibt es keine, erklärt ein Hinweis, wo man sie in den iOS-Einstellungen lädt, und die App läuft ohne Ton weiter.
4. Weiter zur Linie.

Der Speicher einer Web-App auf dem Home-Bildschirm ist von Safari getrennt. Deshalb steht die Installation vor der Namenseingabe.

### 2.2 Linie

- Senkrechte Linie mit elf Punkten: Haltestelle 1 bis 10 und die Endstation. Zustände: gesperrt, offen, läuft, abgeschlossen.
- Oben der Kopf mit Datum, Tageszähler und Berg, darunter der Block „Heute“ mit dem nächsten Schritt: fällige Wiederholungen, die offene Haltestelle oder „Für heute fertig“.
- Eine offene Mission bleibt angeheftet, bis sie erledigt oder übersprungen ist.
- Punkte und Serie stehen nicht auf der Startseite. Sie erscheinen in der Zusammenfassung am Ende einer Haltestelle und unter „Mehr, Über“. Im Ruhemodus fehlen sie überall.
- Auf dem iPad steht die Linie mit allen elf Punkten neben dem Block „Heute“, auf dem Telefon darunter.
- Tippen auf eine abgeschlossene Haltestelle öffnet deren Übersicht: Karten, Grammatik, Dialog zum Wiederanhören.
- Tippen auf eine offene oder laufende Haltestelle beginnt sie, auch wenn heute schon eine geschafft ist. Zwei Haltestellen an einem Tag sind möglich.
- Knopf „10 Karten extra“ startet jederzeit eine freie Wiederholrunde. Sie ist reine Übung: Sie ändert keine Fächer und gibt keine Punkte, zählt aber für die Serie (Entscheidung der Hauptsitzung vom 22.11.2026, weil sich sonst Karten vor ihrer Fälligkeit hochstufen ließen).

Haltestelle n+1 öffnet, wenn die Abschlussrunde von Haltestelle n beendet ist. Das Datum spielt keine Rolle. Die Endstation öffnet nach Haltestelle 10.

### 2.3 Lerneinheit

Sechs Schritte in fester Reihenfolge. Nach jedem Schritt wird der Stand gespeichert, eine abgebrochene Einheit setzt beim selben Schritt fort.

| Schritt | Ablauf | Richtzeit |
|---|---|---|
| 1 Wiederholen | Fällige Karten, höchstens 40 Karten oder 6 Minuten. Entfällt, wenn nichts fällig ist. | bis 6 min |
| 2 Neue Karten | In Blöcken zu vier: jede Karte ansehen und anhören, danach die vier als Paare zuordnen. | 4 bis 5 min |
| 3 Grammatik | Erklärung, Tabelle, Beispiele mit Ton, danach die vier Lückensätze. | 3 min |
| 4 Dialog | Erst anhören, dann Rollenspiel. | 3 min |
| 5 Abschlussrunde | Jede neue Karte einmal als Aufgabe, dazu die drei Satzbau-Aufgaben. | 3 bis 4 min |
| 6 Mission | Mission des Tages mit Sätzen zum Mitnehmen, danach Zusammenfassung. | 1 min |

Jede Lerneinheit beginnt mit einer Übersicht der heutigen Schritte (docs/04-design.md, „Fahrplan der Einheit“). Erst das Tippen auf ihren Hauptknopf baut die erste Aufgabe. Die Grenze von 6 Minuten zählt aktive Zeit nach Abschnitt 5.4, keine Pausen im Hintergrund.

Wiederholen steht einmal am Tag am Anfang, auch wenn eine Haltestelle vom Vortag bei einem späteren Schritt liegt. Danach geht es am gespeicherten Schritt weiter. Endet die Runde an der Grenze von 40 Karten oder 6 Minuten, bleibt der Rest fällig und kommt am nächsten Tag. Ein Neuladen mitten in der Abschlussrunde wertet keine Aufgabe doppelt: Schon beantwortete Aufgaben kommen nicht erneut.

Die Richtzeiten rechnen mit 8 Sekunden je Aufgabe. Das ist eine Annahme. Die App misst die aktive Zeit, damit sie sich prüfen lässt (Abschnitt 5.4).

Dialog im Detail:

- Anhören: Die Zeilen erscheinen einzeln. Jedes Tippen auf „Weiter“ zeigt die nächste Zeile und spricht sie. Die Übersetzung liegt verdeckt darunter und erscheint beim Antippen.
- Rollenspiel: Zeilen der anderen Person werden gesprochen. Bei den eigenen Zeilen steht nur die deutsche Vorgabe. Sie spricht laut, tippt auf „Aufdecken“, hört die Lösung und wählt „Saß“ oder „Noch mal“. Das Ergebnis ändert keine Karten.

### 2.4 Aufgabentypen

| Typ | Beschreibung | Eingesetzt für |
|---|---|---|
| Erkennen | Spanisch lesen, aus vier deutschen Antworten wählen | Wiederholen Fach 1, Abschlussrunde |
| Hören | Nur Ton, aus vier deutschen Antworten wählen. Ohne Stimme wird daraus „Erkennen“. | Wiederholen Fach 2 |
| Schreiben | Deutsch lesen, Spanisch tippen | Wiederholen Fach 3 bis 5, nur `word` und `phrase` |
| Erinnern | Deutsch lesen, aus vier spanischen Antworten wählen | Satzmuster ab Fach 3. Ersetzt „Schreiben“, solange dieser Typ noch nicht gebaut ist. |
| Paare | Vier spanische und vier deutsche Kärtchen zuordnen | Neue Karten |
| Lücke | Lückensatz mit Auswahl | Grammatik |
| Satzbau | Bausteine in die richtige Reihenfolge tippen | Abschlussrunde |

Falsche Antworten zur Auswahl stammen aus derselben Einheit und möglichst derselben Kartenart, sonst aus den Nachbareinheiten. Bei Satzmustern zeigt die Aufgabe den Beispielsatz. Die Auswahl ist bei gleichem Startwert reproduzierbar, damit Tests stabil laufen.

Prüfung beim Schreiben: Groß- und Kleinschreibung, Leerzeichen am Rand und die Zeichen `¿ ? ¡ ! . ,` zählen nicht. Stimmt der Rest, ist die Antwort richtig. Fehlt nur ein Akzent auf einem Vokal, gilt sie als richtig und die App zeigt die Schreibweise mit Akzent. Ein n statt ñ ist falsch.

Nach jeder Antwort: richtige Lösung zeigen, bei Fehlern zusätzlich die gewählte Antwort, dazu der Hinweis der Karte, falls vorhanden. Weiter geht es erst durch Tippen.

### 2.5 Missionen

- Liste aller zehn Missionen mit Zustand: gesperrt, offen, erledigt, übersprungen.
- Eine Mission wird mit dem Abschluss ihrer Haltestelle offen.
- „Erledigt“ fragt „Wie lief es?“ mit drei Antworten (leicht, ging so, schwer) und einem freien Notizfeld. Beides ist freiwillig.
- Übersprungene Missionen lassen sich später nachholen. Keine Mission sperrt eine Haltestelle.

### 2.6 Sprachführer

- Kategorien als Liste, darin die Sätze: Spanisch groß, Deutsch klein, Knopf zum Anhören, Stern zum Merken.
- Suche über Spanisch und Deutsch, ohne Rücksicht auf Akzente und Groß- und Kleinschreibung.
- „Zeigen“ öffnet den Satz im Vollbild in sehr großer Schrift, damit man das Gerät dem Gegenüber hinhalten kann. Darunter klein die Übersetzung und ein Knopf für langsames Vorlesen.
- Gemerkte Sätze stehen als eigene Kategorie oben.
- Ein Hinweis der Kategorie (zum Beispiel die Notrufnummer) steht über der Liste.

### 2.7 Mehr

- Spickzettel: Grammatiktabellen der begonnenen Haltestellen, Zahlen 0 bis 100 mit Ton, Wochentage, Aussprachehinweise.
- Einstellungen: Name, Stimme mit Testknopf, Sprechtempo (normal, langsam), Ruhemodus.
- Fortschritt sichern: Export als JSON-Datei über das Teilen-Menü, als Ersatz Kopieren in die Zwischenablage. Import aus Datei oder eingefügtem Text mit Rückfrage. Vor jedem Import legt die App eine Sicherung des aktuellen Stands an.
- Über: Version, Stand der Inhalte, Punkte und Serie (nicht im Ruhemodus), Lernzeit je Tag, Schriftlizenzen und der Satz „Code und Lerninhalte sind mit KI-Unterstützung entstanden. Fehler gefunden? Bitte melden, dann wird die Karte korrigiert.“

### 2.8 Endstation

Öffnet nach Haltestelle 10. 30 Aufgaben über alle Karten: zuerst Karten in Fach 1 bis 3, der Rest zufällig, Aufgabentyp nach Fach. Danach die Ansicht „Deine Linie“ mit Karten je Fach, erledigten Missionen, aktiven Tagen, gesamter Lernzeit und dem Ergebnis der 30 Aufgaben.

## 3. Ton

Web Speech API, `speechSynthesis`. Keine Audiodateien.

- Eine Funktion `speak(text, { slow })` für die ganze App. Sie bricht laufende Ausgabe ab, entfernt `…` und ersetzt `{name}`.
- Sprechtempo `rate` 0.9 normal und 0.6 langsam.
- Stimmenwahl: zuerst die gespeicherte Stimme, sonst die erste mit Sprache es-ES, dann es-MX, dann es-US, dann jede mit `es`. Die Liste kann beim Start leer sein und erst mit dem Ereignis `voiceschanged` kommen.
- iOS spielt nur, wenn `speak` direkt in der Behandlung eines Tippens aufgerufen wird. Automatisches Vorlesen der nächsten Karte passiert deshalb im Klick auf „Weiter“, nie zeitgesteuert.
- Ohne spanische Stimme bleiben alle Tonknöpfe sichtbar, aber deaktiviert, mit einmaligem Hinweis.
- Spanischer Text trägt im HTML `lang="es"`, auch wegen VoiceOver.

## 4. Daten

### 4.1 Inhalte

Typen ergeben sich aus `content/SCHEMA.md`. Die JSON-Dateien werden statisch importiert und landen im Bundle.

### 4.2 Fortschritt

Ein Objekt unter dem Schlüssel `guagua:v1` in `localStorage`. Speichern nach jeder Antwort.

```ts
interface Progress {
  schema: 1;
  profile: {
    name: string;
    createdAt: string;            // ISO-Zeitpunkt
    voiceURI: string | null;
    rate: "normal" | "slow";
    calm: boolean;                // Ruhemodus
  };
  cards: Record<string, {         // Schlüssel: Item-id
    box: 1 | 2 | 3 | 4 | 5;
    due: string;                  // lokaler Kalendertag, JJJJ-MM-TT
    right: number;
    wrong: number;
    lastSeen: string;             // lokaler Kalendertag
  }>;
  units: Record<string, {         // Schlüssel: Unit-id
    step: 1 | 2 | 3 | 4 | 5 | 6;  // nächster offener Schritt
    startedAt: string;
    completedAt?: string;
    answered?: string[];          // in der laufenden Abschlussrunde schon beantwortete Aufgaben
  }>;
  missions: Record<string, {      // Schlüssel: Mission-id
    state: "done" | "skipped";
    at: string;
    feeling?: "leicht" | "mittel" | "schwer";
    note?: string;
  }>;
  stats: {
    points: number;
    streak: number;
    lastActiveDay: string | null;
    lastReviewDay?: string;       // Tag der letzten beendeten Wiederholrunde
    activeMsByDay: Record<string, number>;
  };
  favorites: string[];            // ids aus dem Sprachführer
  finalReview?: { at: string; right: number; total: number };
}
```

Schlägt das Lesen fehl oder passt `schema` nicht, bietet die App den Import einer Sicherung oder einen Neustart an. Sie überschreibt nie stillschweigend.

## 5. Lernlogik

Alle Stellgrößen stehen in einer Datei `src/core/config.ts`.

### 5.1 Karteikasten

Fünf Fächer. Der Abstand bis zur nächsten Wiederholung hängt vom Fach ab.

| Fach | Abstand in Tagen |
|---|---|
| 1 | 0 |
| 2 | 1 |
| 3 | 3 |
| 4 | 6 |
| 5 | 12 |

- Eine neue Karte kommt nach Schritt 2 in Fach 1, fällig heute.
- Richtig: ein Fach höher, höchstens 5. Fällig am heutigen Tag plus Abstand des neuen Fachs.
- Falsch: zurück in Fach 1, fällig morgen. In derselben Runde kommt die Karte frühestens nach drei anderen Karten erneut, höchstens zweimal.
- „Richtig mit Akzent-Hinweis“ zählt als richtig.
- Nur Wiederholen, Abschlussrunde und Endstation ändern Fächer. Paare, Lücke, Satzbau und Dialog ändern keine.
- Tage sind lokale Kalendertage des Geräts. Die Funktion für „heute“ ist austauschbar, damit Tests Tage simulieren können.

### 5.2 Wiederholrunde

Fällig sind Karten mit `due` kleiner oder gleich heute. Reihenfolge: niedrigstes Fach zuerst, bei Gleichstand ältestes Fälligkeitsdatum. Die Runde endet nach 40 Karten oder 6 Minuten. Der Rest bleibt fällig.

Durchgerechnet mit den 154 Karten bei einer Haltestelle pro Tag (`node tools/simulate-reviews.mjs`): Sind alle Antworten richtig, fallen von Tag 5 bis Tag 10 täglich 30 bis 32 Wiederholungen an, ohne Rückstand. Ist jede fünfte Antwort falsch, erreicht die Runde ab Tag 6 die Grenze von 40 und der Rückstand wächst bis Tag 10 auf 29 Karten in höheren Fächern. Mit einer Grenze von 30 wären es im selben Fall 69.

### 5.3 Punkte und Serie

| Ereignis | Punkte |
|---|---|
| Richtige Antwort in Wiederholen, Abschlussrunde, Endstation | 10 |
| Dialog beendet | 20 |
| Mission erledigt | 50 |
| Haltestelle abgeschlossen | 100 |

Es gibt keinen Abzug. Die Serie zählt aufeinanderfolgende Kalendertage mit einer abgeschlossenen Haltestelle oder mindestens 10 wiederholten Karten. Im Ruhemodus rechnet die App weiter, zeigt aber weder Punkte noch Serie noch Animationen.

### 5.4 Lernzeit

Aktive Zeit läuft, solange eine Lerneinheit oder Wiederholrunde im Vordergrund ist. Nach 60 Sekunden ohne Eingabe pausiert die Uhr. Die Summe je Kalendertag steht unter „Mehr, Über“.

## 6. iOS und PWA

- Manifest mit Name „Guagua“, `display: standalone`, ohne festgelegte Ausrichtung (Hoch- und Querformat), `start_url` und `scope` relativ zum Hosting-Pfad.
- Zusätzlich `apple-touch-icon` mit 180 Pixel als PNG und die Meta-Angaben für Web-Apps auf dem Home-Bildschirm.
- `viewport-fit=cover` und Abstände über `env(safe-area-inset-*)`, damit Leiste und Knöpfe nicht unter Notch oder Home-Balken liegen.
- Höhe über `100dvh`, nicht `100vh`.
- Eingabefelder mit mindestens 16 Pixel Schrift, sonst zoomt Safari beim Fokus.
- Tippflächen mindestens 44 mal 44 Punkt, `touch-action: manipulation`.
- Service Worker hält alle Dateien vor, auch Schriften. Neue Version: Hinweis „Neue Version bereit“ mit Knopf zum Neuladen, nie mitten in einer Aufgabe.
- `<meta name="robots" content="noindex">`.
- Keine Spracherkennung, keine Push-Mitteilungen, kein Zugriff auf Mikrofon oder Standort.

## 7. Barrierefreiheit und Sprache

- Kontrast für Text mindestens 4,5 zu 1, Farbpaare in docs/04-design.md.
- Richtig und falsch nie nur über Farbe: zusätzlich Symbol und Text.
- Bewegung respektiert `prefers-reduced-motion`.
- Texte der Oberfläche folgen den Regeln in docs/04-design.md, Abschnitt „Texte“.

## 8. Tests

| Ebene | Was |
|---|---|
| Unit (Vitest) | Karteikasten mit simulierten Tagen, Reihenfolge und Grenze der Wiederholrunde, Antwortprüfung beim Schreiben, Auswahl der falschen Antworten, Punkte und Serie, Laden und Speichern des Fortschritts einschließlich kaputter Daten |
| Inhalte | `node tools/validate-content.mjs` als Teil von `npm test` |
| Ablauf (Playwright, WebKit, iPad-Viewport 820 × 1180, ein zweiter Durchlauf bei 390 × 844) | Erster Start, Haltestelle 1 komplett, Neuladen behält den Stand, zweiter simulierter Tag zeigt 16 fällige Karten, Sprachführer-Suche, Offline-Neuladen |
| Gerät | Checkliste in docs/06-deployment-und-ipad.md, von Hand auf dem iPad |

WebKit unter Windows ist nicht iOS Safari. Der Gerätetest ersetzt nichts davon.
