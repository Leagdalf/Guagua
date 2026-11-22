# Deployment und iPad

## 1. Hosting über GitHub Pages

Eine installierbare Web-App braucht eine HTTPS-Adresse, sonst läuft der Service Worker nicht. GitHub Pages liefert das kostenlos für öffentliche Repositorys. Für private Repositorys verlangt GitHub einen bezahlten Tarif.

Öffentlich heißt: Code und Lerninhalte kann jeder lesen, der die Adresse kennt. Im Repository stehen keine persönlichen Daten. Name und Fortschritt bleiben auf dem iPad. Die Seite trägt `noindex`.

Andere Anbieter, die auch private Repositorys kostenlos ausliefern, habe ich für dieses Projekt nicht geprüft.

### Ablauf

Der Agent hält vor Schritt 2 an und wartet auf Florians Freigabe.

1. Prüfen: `gh auth status` zeigt ein angemeldetes Konto.
2. Repository anlegen und hochladen: `gh repo create guagua --public --source=. --remote=origin --push`
3. Auf github.com im Repository unter Settings, Pages als Quelle „GitHub Actions“ wählen.
4. Workflow `.github/workflows/deploy.yml`: Node einrichten, `npm ci`, `npm test`, `npm run build`, den Ordner `dist` als Pages-Artefakt hochladen und veröffentlichen. Die aktuellen Versionen der offiziellen Pages-Aktionen in der GitHub-Doku nachschlagen und nicht aus dem Gedächtnis eintragen.
5. In `vite.config.ts` den Pfad des Repositorys als `base` setzen (`/guagua/`). `start_url` und `scope` im Manifest müssen dazu passen.
6. Nach dem ersten Lauf ist die App unter `https://<github-name>.github.io/guagua/` erreichbar.

## 2. Installation auf dem iPad

1. Die Adresse in Safari öffnen. Am einfachsten schickt Florian sie sich selbst oder ihr als Nachricht.
2. Auf das Teilen-Symbol tippen, dann „Zum Home-Bildschirm“ und „Hinzufügen“.
3. Safari schließen und Guagua über das neue Symbol öffnen.
4. Erst jetzt den Namen eingeben. Die installierte App hat einen eigenen Speicher. Was vorher in Safari eingegeben wurde, kommt dort nicht an.
5. Einmal mit Netz bis zur Linie durchklicken, damit alle Dateien geladen sind.

## 3. Gerätetest

Von Florian am iPad abzuhaken, bevor sie anfängt. Auffälligkeiten mit Bildschirmfoto an die Hauptsitzung geben.

- [ ] Die App startet vom Home-Bildschirm ohne Adresszeile und Safari-Leisten.
- [ ] Symbol und Name auf dem Home-Bildschirm stimmen.
- [ ] Der Stimmentest spricht Spanisch. Notieren, welche Stimmen zur Wahl stehen.
- [ ] Der Tonknopf einer Lernkarte spielt beim ersten Tippen.
- [ ] „Weiter“ spricht die nächste Karte ohne zweites Tippen.
- [ ] Im Kontrollzentrum den Stumm-Modus einschalten und Ton testen. Ergebnis notieren. Bleibt die App stumm, bekommt der Stimmentest einen Hinweis darauf.
- [ ] Das iPad drehen: Startseite und eine Aufgabe sind im Hoch- und im Querformat vollständig sichtbar.
- [ ] Die untere Leiste liegt über dem Home-Balken, oben ist nichts von der Statusleiste verdeckt.
- [ ] Flugmodus einschalten, App ganz schließen, neu öffnen, eine Aufgabe lösen.
- [ ] Mitten in einer Einheit die App schließen und neu öffnen: Sie setzt am selben Schritt fort.
- [ ] Am nächsten Tag: Fortschritt ist noch da, die Karten von gestern sind fällig.
- [ ] Nach einer neuen Veröffentlichung erscheint „Neue Version bereit“.
- [ ] Sobald „Schreiben“ gebaut ist: Die Tastatur verdeckt weder Aufgabe noch Knopf, ñ und Akzente lassen sich durch langes Drücken eingeben.

## 4. Spanische Stimmen

Die App benutzt die Stimmen, die iOS mitbringt. Bessere Stimmen lassen sich in den iOS-Einstellungen nachladen, bei bisherigen iOS-Versionen unter Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch. Der Pfad kann je nach iOS-Version anders heißen.

Ob eine nachgeladene Stimme in der Web-App auftaucht, zeigt nur der Test auf dem Gerät: nach dem Laden die App schließen, neu öffnen und unter „Mehr, Einstellungen“ die Stimmenliste ansehen.

Die Standardstimme spricht meist Spanisch vom Festland. Eine mexikanische oder US-spanische Stimme kommt dem kanarischen Klang näher, weil auch sie z und c wie s spricht.

## 5. Neue Versionen während des Urlaubs

Jeder Push auf den Hauptzweig veröffentlicht neu. Die App prüft beim Öffnen mit Netz, ob es eine neue Version gibt, und zeigt dann den Hinweis mit Knopf zum Neuladen. Der Fortschritt bleibt erhalten, weil er getrennt von den App-Dateien gespeichert ist.

Kommt der Hinweis nicht: App ganz schließen, mit Netz neu öffnen, eine halbe Minute warten, erneut schließen und öffnen.

## 6. Fortschritt und Speicher

- Der Fortschritt liegt im Speicher der installierten Web-App. Wer das Symbol vom Home-Bildschirm löscht, löscht ihn mit.
- Safari löscht die Daten einer Webseite, wenn sie an sieben Tagen mit Safari-Nutzung nicht besucht wurde. Laut WebKit gilt diese Grenze für Safari und nicht für Web-Apps auf dem Home-Bildschirm, die ihren eigenen Zähler haben (Quelle in docs/08-quellen.md). Auch deshalb gehört die App auf den Home-Bildschirm.
- Sobald der Export gebaut ist: einmal in der Woche und vor dem Heimflug sichern.

## 7. Fehlerbilder

| Beobachtung | Wahrscheinliche Ursache | Abhilfe |
|---|---|---|
| Weiße Seite unter der Pages-Adresse | `base` passt nicht zum Namen des Repositorys | `vite.config.ts` prüfen, neu veröffentlichen |
| Kein Ton | Keine spanische Stimme, Stumm-Modus an oder Aufruf außerhalb eines Tippens | Stimmenliste und Stumm-Modus prüfen, sonst Fehler an `pwa-builder` |
| Name und Fortschritt fehlen nach der Installation | Eingabe erfolgte in Safari statt in der installierten App | In der installierten App neu beginnen oder Sicherung importieren |
| Alte Version trotz Veröffentlichung | Service Worker hat noch den alten Stand | Vorgehen aus Abschnitt 5 |
| App startet offline nicht | Erster Start war nicht vollständig geladen | Einmal mit Netz öffnen und bis zur Linie gehen |
