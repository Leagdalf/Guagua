# Guagua

Spanisch lernen im Teneriffa-Urlaub: eine Web-App fürs iPad mit zehn Tageseinheiten und einem Sprachführer. „Guagua“ ist das kanarische Wort für Bus, der Kurs ist als Linie mit zehn Haltestellen gebaut.

Stand 22.11.2026: Dieser Ordner enthält die Vorbereitung. Konzept, Lerninhalte, Prüfskripte und die Agenten für Claude Code sind fertig, App-Code gibt es noch nicht.

## In fünf Schritten zur App auf dem iPad

1. Ordner an einen Platz außerhalb der Vault legen. Er liegt unter `C:\Users\flori\guagua`.
2. Die Prüfungen aus docs/07-kickoff.md laufen lassen (Node ab 22.12, git, gh, claude).
3. Im Ordner `claude` starten und den Auftrag aus docs/07-kickoff.md einfügen.
4. Wenn Claude vor der Veröffentlichung nachfragt: entscheiden, ob das Repository öffentlich sein darf.
5. App nach docs/06-deployment-und-ipad.md installieren und den Gerätetest abhaken.

## Inhalt des Ordners

| Pfad | Inhalt |
|---|---|
| `CLAUDE.md` | Regeln und Wegweiser für Claude Code |
| `.claude/agents/` | Drei Subagenten auf Sonnet: `pwa-builder`, `content-editor`, `qa-reviewer` |
| `.claude/settings.json` | Setzt das Modell der Hauptsitzung auf Sonnet |
| `docs/01-produkt-brief.md` | Ziel, Erfolgskriterien, Entscheidungen, offene Punkte |
| `docs/02-spezifikation.md` | Ansichten, Abläufe, Datenmodell, Lernlogik, iOS-Regeln, Tests |
| `docs/03-lehrplan.md` | Die zehn Haltestellen und was von A1 fehlt |
| `docs/04-design.md` | Farben mit Kontrastwerten, Schriften, Formen, Texte |
| `docs/05-arbeitspakete.md` | Acht Arbeitspakete mit Abnahmekriterien, Schnitt für den ersten Abend |
| `docs/06-deployment-und-ipad.md` | Veröffentlichen, Installieren, Gerätetest, Fehlerbilder |
| `docs/07-kickoff.md` | Aufträge zum Einfügen in Claude Code, Eintrag für die Vault |
| `docs/08-quellen.md` | Belege und was nicht belegt ist |
| `content/` | 10 Einheiten mit 154 Lernkarten, Sprachführer mit 56 Sätzen, Zahlen 0 bis 100 |
| `tools/validate-content.mjs` | Prüft die Inhalte, läuft ohne Installation |
| `tools/simulate-reviews.mjs` | Rechnet die tägliche Wiederhollast durch |

## Sofort ausprobieren

```
node tools/validate-content.mjs
```

Erwartete Ausgabe: `Inhalte in Ordnung: 10 Einheiten, 154 Lernkarten, 56 Sprachführer-Sätze, 308 eindeutige ids.`

## Herkunft

Konzept, Unterlagen und Lerninhalte hat Claude (Anthropic) am 22.11.2026 im Auftrag von Florian erstellt. Die spanischen Texte hat kein Mensch mit Spanisch als Muttersprache geprüft. Belege und Prüfstand stehen in docs/08-quellen.md.
