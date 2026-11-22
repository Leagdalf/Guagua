# Start am Computer

## Vorher prüfen

In einer Eingabeaufforderung im Projektordner:

```
node --version
git --version
gh auth status
claude --version
```

Node muss 22.12 oder neuer sein, das verlangt Vitest 5 (Stand 22.11.2026). Die Prüfskripte in `tools/` sind mit Node 22.23 gelaufen. Fehlt `gh` oder die Anmeldung, lässt sich alles bis auf die Veröffentlichung trotzdem bauen.

Der Ordner gehört nicht in die Vault, weil dort nur Markdown liegen soll. Er liegt unter `C:\Users\flori\guagua`.

## Claude Code starten

Im Projektordner `claude` aufrufen. `.claude/settings.json` setzt das Modell auf `sonnet`, die Subagenten tragen `model: sonnet` in ihrer Definition. Mit `/model` lässt sich das prüfen.

## Auftrag für die erste Sitzung

Diesen Text einfügen:

```
Lies CLAUDE.md, docs/01-produkt-brief.md und docs/05-arbeitspakete.md vollständig.

Ziel dieser Sitzung: der MVP aus dem Abschnitt „Schnitt für den ersten Abend“,
veröffentlicht und auf dem iPad installierbar.

Vorgehen:
1. Prüfe node, npm, git und gh und melde, was fehlt.
2. Führe AP0 selbst aus und committe.
3. Starte AP1, AP2 und AP3 gleichzeitig als drei pwa-builder-Subagenten. Gib jedem
   den vollständigen Text seines Arbeitspakets, die Liste seiner Dateien und die
   Abschnitte der Spezifikation mit, die er braucht. Nur MVP-Umfang: Punkte mit
   „(später)“ bleiben weg.
4. Lass qa-reviewer die Abnahmekriterien von AP0 bis AP3 prüfen. Behebe Blocker
   über pwa-builder, bis der Bericht keinen mehr enthält.
5. Starte AP4 und AP5 gleichzeitig, danach wieder qa-reviewer.
6. Führe AP6 bis zum lokalen Build aus. Halte dann an und frag mich, bevor du ein
   öffentliches Repository anlegst oder etwas veröffentlichst.
7. Nach meiner Freigabe: veröffentlichen, Adresse nennen und mich Punkt für Punkt
   durch den Gerätetest in docs/06-deployment-und-ipad.md führen.

Regeln: ein Commit je Arbeitspaket. Keine Änderung an content/ außer durch
content-editor. Bei Widersprüchen in den Unterlagen nachfragen statt raten.
Zum Schluss eine Liste: was fertig ist, was offen ist, was du nicht prüfen konntest.
```

## Folgeaufträge

Für die Tage danach, je ein Auftrag pro Sitzung:

```
Lies CLAUDE.md und in docs/05-arbeitspakete.md den Abschnitt „Folgeaufträge nach
dem MVP“. Setze Folgeauftrag <Nummer> um: pwa-builder baut, qa-reviewer prüft gegen
die Spezifikation. Veröffentliche erst, wenn npm test grün ist und ich zugestimmt habe.
```

Wenn ihr beim Lernen einen Fehler in den Inhalten findet:

```
Im Inhalt stimmt etwas nicht: <Karte oder Satz, was falsch ist>.
Lass content-editor das prüfen und korrigieren. Ids bleiben unverändert.
```

## Eintrag für die Vault

Der Computer war am 22.11. nicht erreichbar, deshalb fehlt der Eintrag in `Projekte.md` noch. Auftrag an Claude Code, sobald der Ordner steht:

```
Suche in C:\Users\flori\OneDrive\Vault die Datei Projekte.md. Hänge den folgenden
Eintrag an, im Format der vorhandenen Einträge. Ändere sonst nichts an der Datei
und lege in der Vault keine anderen Dateien an.

Guagua: Spanisch-Lern-App fürs iPad (Web-App)
- Status: in Entwicklung seit 22.11.2026, Termin 03.12.2026 (Ende Teneriffa-Urlaub)
- Ziel: A1-Einstieg mit Urlaubsbezug in zehn Tageseinheiten, 15 bis 20 Minuten am Tag
- Entscheidungen: Web-App statt nativer iOS-App (kein Mac, kein Developer-Konto),
  Entwicklung mit Claude Code und Sonnet-Subagenten, Hosting über GitHub Pages
- Ordner: C:\Users\flori\guagua (Unterlagen in docs, Inhalte in content)
- Nächster Schritt: MVP bauen und aufs iPad bringen (docs/07-kickoff.md)
```
