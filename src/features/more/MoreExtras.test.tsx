import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildExport, checkImport, summarizeProgress } from "../../core/backup";
import { allItems } from "../../core/content";
import { updateProfile } from "../../core/progress";
import { freshProgress, makeClock } from "../../core/testkit";
import type { Progress } from "../../core/types";
import { LoadErrorView } from "../onboarding/LoadErrorView";
import { afterUnit1, newClock } from "../home/testProgress";
import { CONTENT_DATE, aboutRows } from "./aboutModel";
import { BackupPage } from "./BackupPage";
import { oftenWrongItems } from "./cheatModel";
import { CheatSheetPage } from "./CheatSheetPage";
import { FeedbackPage } from "./FeedbackPage";
import { ImportConfirm } from "./ImportConfirm";
import { ImportPanel } from "./ImportPanel";
import { NEEDS_VOICE_TEXT, makeNumberTasks } from "./numbersModel";
import { NumbersPractice } from "./NumbersPractice";
import { checkTyped } from "./numbersModel";
import { createRng } from "../../core/random";
import { addNote } from "./feedbackModel";

const noop = () => {};
const count = (html: string, needle: string) => html.split(needle).length - 1;

function withWrong(base: Progress, entries: Record<string, number>): Progress {
  const cards = { ...base.cards };
  for (const [id, wrong] of Object.entries(entries)) cards[id] = { box: 1, due: "2026-11-24", right: 1, wrong, lastSeen: "2026-11-23" };
  return { ...base, cards };
}

describe("Stand der Inhalte", () => {
  it("ist das Datum des Builds, in Tests und im Entwicklungsserver gesetzt", () => {
    expect(__BUILD_DATE__).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CONTENT_DATE).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    expect(CONTENT_DATE).not.toBe("22.11.2026");
    const [y, m, d] = __BUILD_DATE__.split("-");
    expect(CONTENT_DATE).toBe(`${d}.${m}.${y}`);
  });

  it("Über die App: im Ruhemodus ohne Punkte und Serie, sonst mit", () => {
    const clock = newClock();
    const p = freshProgress(clock);
    expect(aboutRows(p, clock.current()).map((r) => r.label)).toEqual(["Version", "Stand der Inhalte", "Punkte", "Serie"]);
    expect(aboutRows(updateProfile(p, { calm: true }), clock.current()).map((r) => r.label)).toEqual(["Version", "Stand der Inhalte"]);
  });
});

describe("Oft falsch im Spickzettel", () => {
  const clock = newClock();
  const base = freshProgress(clock);
  const render = (p: Progress) => renderToStaticMarkup(<CheatSheetPage progress={p} onBack={noop} />);

  it("ohne Karten, die mindestens zweimal falsch waren, fehlt der Abschnitt", () => {
    expect(render(base)).not.toContain("Oft falsch");
    expect(render(withWrong(base, { "u01-i01": 1 }))).not.toContain("Oft falsch");
  });

  it("zeigt Spanisch, Deutsch und Tonknopf, nur Karten mit mindestens zwei Fehlern", () => {
    const first = allItems[0];
    const second = allItems[1];
    if (!first || !second) throw new Error("Inhalte");
    const html = render(withWrong(base, { [first.id]: 2, [second.id]: 1 }));
    expect(html).toContain("Oft falsch");
    expect(html).toContain(`id="wrong-${first.id}"`);
    expect(html).not.toContain(`id="wrong-${second.id}"`);
    expect(html).toContain(first.de.replace(/&/g, "&amp;"));
    expect(html).toContain(`<p id="wrong-${first.id}" lang="es" class="es">`);
    expect(count(html, `aria-describedby="wrong-`)).toBe(1);
  });

  it("höchstens zehn Karten, die meisten Fehler zuerst", () => {
    const ids = allItems.slice(0, 14).map((item) => item.id);
    const entries: Record<string, number> = {};
    ids.forEach((id, i) => (entries[id] = 2 + (i === 13 ? 5 : 0)));
    const list = oftenWrongItems(withWrong(base, entries));
    expect(list).toHaveLength(10);
    expect(list[0]?.id).toBe(ids[13]);
    expect(count(render(withWrong(base, entries)), 'id="wrong-')).toBe(10);
  });
});

describe("Zahlen üben im Spickzettel", () => {
  const clock = newClock();
  const html = renderToStaticMarkup(<CheatSheetPage progress={freshProgress(clock)} onBack={noop} />);

  it("ohne spanische Stimme ist der Knopf gesperrt, ein Satz sagt warum", () => {
    expect(html).toMatch(/<button[^>]*class="btn"[^>]*disabled=""[^>]*>Zahlen üben<\/button>/);
    expect(html).toContain(NEEDS_VOICE_TEXT);
  });
});

describe("Zahlen üben: die Aufgabe", () => {
  const tasks = makeNumberTasks(createRng(3));
  const first = tasks[0];
  if (!first) throw new Error("Aufgaben");

  it("zeigt keine Zahl, nur Tonknöpfe, ein Ziffernfeld mit Zifferntastatur und „Prüfen“ (gesperrt ohne Eingabe)", () => {
    const html = renderToStaticMarkup(<NumbersPractice tasks={tasks} hasVoice onClose={noop} onAgain={noop} />);
    expect(html).toContain("Aufgabe 1 von 10");
    expect(html.match(/<button[^>]*audio-btn/g)).toHaveLength(2);
    expect(html).toContain("Anhören");
    expect(html).toContain("Langsam");
    expect(html).toMatch(/inputMode="decimal"|inputmode="decimal"/);
    expect(html).toMatch(/<button[^>]*class="btn"[^>]*disabled=""[^>]*>Prüfen<\/button>/);
    expect(html).not.toContain('lang="es"');
    expect(html).not.toMatch(/Punkte|richtig|falsch/i);
  });

  it("ohne Stimme sind die Tonknöpfe gesperrt", () => {
    const html = renderToStaticMarkup(<NumbersPractice tasks={tasks} hasVoice={false} onClose={noop} onAgain={noop} />);
    expect(count(html, "disabled")).toBeGreaterThanOrEqual(2);
  });

  it("nach der Antwort: Zahl in Ziffern und auf Spanisch (lang=es), Knopf „Weiter“, letzte Aufgabe „Fertig“", () => {
    const result = checkTyped(first, "0");
    const html = renderToStaticMarkup(<NumbersPractice tasks={tasks} hasVoice onClose={noop} onAgain={noop} initialResult={result} />);
    expect(html).toContain(result.digits);
    expect(html).toContain(`lang="es" class="es">${result.spanish}`);
    expect(html).toContain(">Weiter<");
    const last = renderToStaticMarkup(
      <NumbersPractice tasks={tasks} hasVoice onClose={noop} onAgain={noop} initialIndex={9} initialResult={checkTyped(tasks[9] ?? first, "1")} />,
    );
    expect(last).toContain(">Fertig<");
  });
});

describe("Rückmeldung", () => {
  const clock = newClock();
  const render = (p: Progress) => renderToStaticMarkup(<FeedbackPage progress={p} now={clock.now} onUpdate={noop} onBack={noop} />);

  it("ohne Notizen: Satz statt Liste, Teilen gesperrt", () => {
    const html = render(freshProgress(clock));
    expect(html).toContain("Noch keine Notizen");
    expect(html).toMatch(/<button[^>]*text-btn[^>]*disabled=""[^>]*>Teilen<\/button>/);
    expect(html).toMatch(/<button[^>]*class="btn"[^>]*disabled=""[^>]*>Notiz speichern<\/button>/);
  });

  it("mit Notizen: Liste mit Datum und Löschen je Notiz, Teilen frei, Name taucht nicht im Teilen-Text auf", () => {
    let p = freshProgress(clock, "Zebrafinke");
    p = addNote(p, "Hat mir gefehlt", clock.now);
    p = addNote(p, "Fehler gefunden", clock.now);
    const html = render(p);
    expect(html).toContain("Hat mir gefehlt");
    expect(html).toContain("23.11.2026");
    expect(count(html, ">Löschen<")).toBe(2);
    expect(html).toContain('aria-label="Notiz vom 23.11.2026 löschen"');
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Teilen<\/button>/);
    expect(html).toContain("nicht deinen Namen");
  });
});

describe("Fortschritt sichern: Rückfrage mit Vergleich und letzte Sicherung", () => {
  const { clock, progress } = afterUnit1();
  const empty = freshProgress(makeClock("2026-11-20"), "Ana");

  it("zeigt aktuellen und importierten Stand nebeneinander und warnt bei weniger Karten und älterem Stand", () => {
    const check = checkImport(buildExport(empty, clock.now));
    if (!check.ok) throw new Error("Import");
    const html = renderToStaticMarkup(<ImportConfirm summary={check.summary} current={summarizeProgress(progress, null)} onConfirm={noop} onCancel={noop} />);
    expect(html).toContain("Dein Stand");
    expect(html).toContain(">Import<");
    expect(html).toContain("Karten");
    expect(html).toContain("Abgeschlossene Haltestellen");
    expect(html).toContain("Zuletzt gelernt");
    expect(html).toContain("Punkte");
    expect(html).toContain("Achtung.");
    expect(html).toContain("weniger Karten");
    expect(html).toContain("älter");
    expect(html).toContain("Jetzt importieren");
    expect(count(html, 'class="btn')).toBe(1);
  });

  it("ohne Warnung, wenn nichts schlechter wird; im Ruhemodus keine Punkte", () => {
    const check = checkImport(buildExport(progress, clock.now));
    if (!check.ok) throw new Error("Import");
    const html = renderToStaticMarkup(<ImportConfirm summary={check.summary} current={summarizeProgress(progress, null)} onConfirm={noop} onCancel={noop} />);
    expect(html).not.toContain("Achtung.");
    const calm = updateProfile(progress, { calm: true });
    const calmHtml = renderToStaticMarkup(<ImportConfirm summary={check.summary} current={summarizeProgress(calm, null)} onConfirm={noop} onCancel={noop} />);
    expect(calmHtml).not.toContain("Punkte");
    const calmImport = checkImport(buildExport(calm, clock.now));
    if (!calmImport.ok) throw new Error("Import");
    expect(renderToStaticMarkup(<ImportConfirm summary={calmImport.summary} current={null} onConfirm={noop} onCancel={noop} />)).not.toContain("Punkte");
  });

  it("die Rückfrage zum Zurückholen heißt so und hat denselben Vergleich", () => {
    const check = checkImport(buildExport(empty, clock.now));
    if (!check.ok) throw new Error("Import");
    const html = renderToStaticMarkup(
      <ImportConfirm summary={check.summary} current={summarizeProgress(progress, null)} kind="backup" onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toContain("Sicherung zurückholen?");
    expect(html).toContain("Jetzt zurückholen");
    expect(html).toContain("Achtung.");
  });

  it("die Seite nennt, von wann die letzte Sicherung ist, und bietet das Zurückholen an", () => {
    const backup = { key: "k", at: new Date(2026, 10, 22, 18, 30).toISOString(), progress };
    const html = renderToStaticMarkup(
      <BackupPage progress={progress} now={clock.now} onReplace={() => ({ ok: true, backupKey: null })} getBackup={() => backup} onBack={noop} />,
    );
    expect(html).toContain("Vom 22.11.2026, 18:30 Uhr");
    expect(html).toContain("1 von 10 Haltestellen");
    expect(html).toContain("Letzte Sicherung zurückholen");
    expect(html).toContain("drei neuesten");
    const none = renderToStaticMarkup(
      <BackupPage progress={progress} now={clock.now} onReplace={() => ({ ok: true, backupKey: null })} getBackup={() => null} onBack={noop} />,
    );
    expect(none).toContain("noch keine automatische Sicherung");
    expect(none).not.toContain("Letzte Sicherung zurückholen");
  });

  it("das Einfügefeld hat Autokorrektur, Großschreibung und Rechtschreibprüfung aus", () => {
    const html = renderToStaticMarkup(<ImportPanel onChecked={noop} />);
    expect(html).toMatch(/<textarea[^>]*autoCorrect="off"|<textarea[^>]*autocorrect="off"/);
    expect(html).toMatch(/<textarea[^>]*autoCapitalize="none"|<textarea[^>]*autocapitalize="none"/);
    expect(html).toMatch(/<textarea[^>]*spellCheck="false"|<textarea[^>]*spellcheck="false"/);
  });
});

describe("Fehleransicht: Import und letzte Sicherung", () => {
  const { progress } = afterUnit1();

  it("bietet neben „Neu beginnen“ Datei, Text und Prüfung an", () => {
    const html = renderToStaticMarkup(<LoadErrorView reason="invalid" onRestart={() => true} getBackup={() => null} />);
    expect(html).toContain("Neu beginnen");
    expect(html).toContain("Datei auswählen");
    expect(html).toContain('type="file"');
    expect(html).toContain("Text prüfen");
    expect(html).toMatch(/<textarea[^>]*autoCorrect="off"|<textarea[^>]*autocorrect="off"/);
    expect(html).not.toContain("Letzte Sicherung zurückholen");
  });

  it("mit einer Sicherung: nennt das Datum und bietet das Zurückholen an", () => {
    const backup = { key: "k", at: new Date(2026, 10, 22, 8, 5).toISOString(), progress };
    const html = renderToStaticMarkup(<LoadErrorView reason="unreadable" onRestart={() => true} getBackup={() => backup} />);
    expect(html).toContain("Vom 22.11.2026, 08:05 Uhr");
    expect(html).toContain("Letzte Sicherung zurückholen");
  });
});
