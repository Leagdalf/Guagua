import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { updateProfile } from "../../core/progress";
import { createProgressStore } from "../../core/store";
import type { StorageLike } from "../../core/store";
import pkg from "../../../package.json";
import { units } from "../../core/content";
import { newClock, newProgress, afterUnit1 } from "../home/testProgress";
import { AI_NOTE, CALM_EXPLANATION } from "./aboutModel";
import { AboutPage } from "./AboutPage";
import { buildExport, checkImport } from "../../core/backup";
import { BackupPage, ImportConfirm } from "./BackupPage";
import { BACKUP_HINT } from "./backupModel";
import { NO_GRAMMAR_TEXT } from "./cheatModel";
import { CheatSheetPage } from "./CheatSheetPage";
import { MoreView } from "./MoreView";
import { SettingsPage } from "./SettingsPage";
import { VoiceTest } from "./VoiceTest";

const noop = () => {};
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("Mehr: Liste mit vier Unterseiten", () => {
  const clock = newClock();
  const html = renderToStaticMarkup(<MoreView progress={newProgress(clock, "Ana")} day={clock.current()} onUpdate={noop} />);

  it("zeigt Spickzettel, Einstellungen, Fortschritt sichern und Über die App", () => {
    expect(html).toContain("Spickzettel");
    expect(html).toContain("Einstellungen");
    expect(html).toContain("Fortschritt sichern");
    expect(html).toContain("Über die App");
    expect(count(html, "more-menu__row")).toBe(4);
  });

  it("zeigt die Inhalte der Unterseiten noch nicht", () => {
    expect(html).not.toContain("Stimme testen");
    expect(html).not.toContain(AI_NOTE);
  });

  it("jede Unterseite hat den Textknopf „Zurück“", () => {
    const pages = ["cheat", "settings", "backup", "about"] as const;
    for (const initialPage of pages) {
      const out = renderToStaticMarkup(
        <MoreView progress={newProgress(clock, "Ana")} day={clock.current()} onUpdate={noop} initialPage={initialPage} />,
      );
      expect(out).toMatch(/<button[^>]*more__back[^>]*>Zurück<\/button>/);
    }
  });
});

describe("Einstellungen", () => {
  const clock = newClock();
  const html = renderToStaticMarkup(<SettingsPage progress={newProgress(clock, "Ana")} onUpdate={noop} onBack={noop} />);

  it("zeigt Name, Stimme mit Testknopf, Sprechtempo", () => {
    expect(html).toContain("Einstellungen");
    expect(html).toContain('value="Ana"');
    expect(html).toContain("Stimme testen");
    expect(html).toContain("Sprechtempo");
    expect(html).toContain("Normal");
    expect(html).toContain("Langsam");
  });

  it("hat den Schalter Ruhemodus mit einem erklärenden Satz", () => {
    expect(html).toContain("Ruhemodus");
    expect(html).toContain(CALM_EXPLANATION);
    const calm = renderToStaticMarkup(
      <SettingsPage progress={updateProfile(newProgress(clock, "Ana"), { calm: true })} onUpdate={noop} onBack={noop} />,
    );
    // Reihenfolge der Auswahlzeilen: Normal, Langsam, Aus, An
    expect([...html.matchAll(/aria-pressed="(true|false)"/g)].map((m) => m[1])).toEqual(["true", "false", "true", "false"]);
    expect([...calm.matchAll(/aria-pressed="(true|false)"/g)].map((m) => m[1])).toEqual(["true", "false", "false", "true"]);
  });

  it("ohne Stimme: Knopf sichtbar und gesperrt, Hinweis mit dem Pfad aus docs/06", () => {
    expect(html).toMatch(/<button[^>]*audio-btn[^>]*disabled/);
    expect(html).toContain("iOS-Einstellungen, Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch");
  });

  it("spanischer Text trägt lang=es", () => {
    expect(html).toContain('lang="es" class="es voice-test__hola">Hola, Ana</span>');
  });
});

describe("Spickzettel", () => {
  const clock = newClock();
  const render = (progress = newProgress(clock)) => renderToStaticMarkup(<CheatSheetPage progress={progress} onBack={noop} />);

  it("ohne begonnene Haltestelle steht ein Satz statt einer leeren Liste, keine Tabelle", () => {
    const html = render();
    expect(html).toContain(NO_GRAMMAR_TEXT);
    expect(html).not.toContain("gtable");
  });

  it("zeigt nur die Grammatik begonnener Haltestellen", () => {
    const { progress } = afterUnit1(clock);
    const html = render(progress);
    const first = units[0];
    const second = units[1];
    if (!first || !second) throw new Error("Inhalte");
    expect(html).not.toContain(NO_GRAMMAR_TEXT);
    expect(count(html, 'class="gram"')).toBe(1);
    expect(html).toContain(first.grammar.topic_de.replace(/&/g, "&amp;"));
    expect(html).not.toContain(second.grammar.topic_de.replace(/&/g, "&amp;"));
    // Beispiele mit Ton: ein Tonknopf je Beispiel
    expect(count(html, "audio-btn")).toBe(first.grammar.examples.length);
    expect(count(html, "<tr>")).toBe(first.grammar.table.length);
  });

  it("zeigt 101 Zahlen und sieben Wochentage mit Ton, spanisch ausgezeichnet", () => {
    const html = render();
    expect(count(html, 'class="ref__n"')).toBe(101);
    expect(html).toContain('<span class="ref__n">0</span><span lang="es" class="es">cero</span>');
    expect(html).toContain('<span class="ref__n">100</span><span lang="es" class="es">cien</span>');
    expect(count(html, 'class="ref__cell"') - 101).toBe(7);
    expect(html).toContain("lunes");
    expect(html).toContain("domingo");
    expect(html).toContain("Zahlen von 0 bis 100");
  });

  it("zeigt die Aussprachehinweise aus Haltestelle 1", () => {
    const html = render();
    expect(html).toContain("Aussprache");
    expect(html).toContain("Das h ist immer stumm");
  });
});

describe("Über die App", () => {
  const clock = newClock();

  it("zeigt Version, Stand, Punkte, Serie, Schriftlizenzen und den KI-Satz wörtlich", () => {
    const html = renderToStaticMarkup(<AboutPage progress={newProgress(clock, "Ana")} day={clock.current()} onBack={noop} />);
    expect(html).toContain(pkg.version);
    expect(html).toContain("22.11.2026");
    expect(html).toContain("Punkte");
    expect(html).toContain("Serie");
    expect(html).toContain("Newsreader (SIL Open Font License 1.1)");
    expect(html).toContain("Figtree (SIL Open Font License 1.1)");
    expect(AI_NOTE).toBe("Code und Lerninhalte sind mit KI-Unterstützung entstanden. Fehler gefunden? Bitte melden, dann wird die Karte korrigiert.");
    expect(html).toContain(AI_NOTE);
  });

  it("zeigt Punkte und Serie nach einer Haltestelle", () => {
    const { clock: c, progress } = afterUnit1();
    const out = renderToStaticMarkup(<AboutPage progress={progress} day={c.current()} onBack={noop} />);
    expect(out).toContain('Punkte</dt><dd class="summary__value">120</dd>');
    expect(out).toContain("1 Tag");
  });

  it("im Ruhemodus fehlen Punkte und Serie", () => {
    const { clock: c, progress } = afterUnit1();
    const calm = updateProfile(progress, { calm: true });
    const out = renderToStaticMarkup(<AboutPage progress={calm} day={c.current()} onBack={noop} />);
    expect(out).not.toMatch(/Punkte|Serie/);
    expect(out).toContain(pkg.version);
  });

  it("Lernzeit je Tag: Minuten, Summe, Median und der Zielwert, ohne Bewertung", () => {
    const base = newProgress(clock, "Ana");
    const progress = {
      ...base,
      stats: { ...base.stats, activeMsByDay: { "2026-11-23": 10 * 60_000, "2026-11-24": 20 * 60_000, "2026-11-25": 30 * 60_000 } },
    };
    const out = renderToStaticMarkup(<AboutPage progress={progress} day="2026-11-25" onBack={noop} />);
    expect(out).toContain("Lernzeit je Tag");
    expect(out).toContain('23.11.2026</dt><dd class="summary__value">10 min');
    expect(out).toContain('Summe</dt><dd class="summary__value">60 min');
    expect(out).toContain('Median</dt><dd class="summary__value">20 min');
    expect(out).toContain("Zielwert: Median zwischen 15 und 20 Minuten pro Tag.");
    expect(out.indexOf("25.11.2026")).toBeLessThan(out.indexOf("23.11.2026")); // neuester zuerst
  });

  it("ohne Lernzeit steht ein Satz, keine Summe", () => {
    const out = renderToStaticMarkup(<AboutPage progress={newProgress(clock, "Ana")} day={clock.current()} onBack={noop} />);
    expect(out).toContain("Noch keine Lernzeit gemessen");
    expect(out).not.toContain("Median</dt>");
  });
});

describe("Fortschritt sichern", () => {
  const clock = newClock();
  const html = renderToStaticMarkup(
    <BackupPage progress={newProgress(clock, "Ana")} now={clock.now} onReplace={() => ({ ok: true, backupKey: null })} onBack={noop} />,
  );

  it("nennt den Hinweis aus docs/06: Symbol löschen löscht den Lernstand, einmal in der Woche und vor dem Heimflug sichern", () => {
    expect(html).toContain(BACKUP_HINT);
    expect(BACKUP_HINT).toMatch(/Symbol vom Home-Bildschirm löschst/);
    expect(BACKUP_HINT).toMatch(/einmal in der Woche und vor dem Heimflug/);
  });

  it("bietet Datei, Zwischenablage und Import aus Datei oder Text; genau ein Hauptknopf", () => {
    expect(html).toContain("Als Datei speichern");
    expect(html).toContain("In die Zwischenablage kopieren");
    expect(html).toContain("Datei auswählen");
    expect(html).toContain('type="file"');
    expect(html).toContain("Text prüfen");
    expect(count(html, 'class="btn')).toBe(1);
  });

  it("zeigt vor der Rückfrage keinen Import-Knopf und keine Fehlermeldung", () => {
    expect(html).not.toContain("Jetzt importieren");
    expect(html).not.toContain("Nicht importiert");
  });
});
describe("Rückfrage vor dem Import", () => {
  it("zeigt Name, Karten, abgeschlossene Haltestellen, Punkte, Datum und fragt ausdrücklich", () => {
    const { clock, progress } = afterUnit1();
    const check = checkImport(buildExport(progress, clock.now));
    if (!check.ok) throw new Error("Import");
    const html = renderToStaticMarkup(<ImportConfirm summary={check.summary} currentName="Eva" onConfirm={noop} onCancel={noop} />);
    expect(html).toContain("Stand importieren?");
    expect(html).toContain('Name</dt><dd class="summary__value">Ana');
    expect(html).toContain("Karten</dt>");
    expect(html).toContain("Abgeschlossene Haltestellen</dt><dd class=\"summary__value\">1 von 10");
    expect(html).toContain('Punkte</dt><dd class="summary__value">120');
    expect(html).toContain("Exportiert am</dt><dd class=\"summary__value\">23.11.2026");
    expect(html).toContain("Dein aktueller Stand von Eva wird ersetzt");
    expect(html).toContain("Jetzt importieren");
    expect(html).toContain("Abbrechen");
    expect(count(html, 'class="btn')).toBe(1);
  });
});
describe("Stimmentest", () => {
  const voices = [
    { voiceURI: "a", name: "Mónica", lang: "es-ES" },
    { voiceURI: "b", name: "Paulina", lang: "es-MX" },
  ];

  it("bei mehreren spanischen Stimmen stehen sie zur Wahl, die gespeicherte ist gewählt", () => {
    const html = renderToStaticMarkup(<VoiceTest voices={voices} voiceURI="b" name="Ana" onPick={noop} />);
    expect(html).toContain("Mónica");
    expect(html).toContain("Paulina");
    expect(html).toContain("Automatisch");
    expect(html).not.toMatch(/<button[^>]*audio-btn[^>]*disabled/);
    expect(html).not.toContain("keine spanische Stimme da");
    const pressed = [...html.matchAll(/aria-pressed="(true|false)"/g)].map((m) => m[1]);
    expect(pressed).toEqual(["false", "false", "true"]);
  });

  it("bei einer Stimme keine Auswahl, der Knopf geht", () => {
    const html = renderToStaticMarkup(<VoiceTest voices={voices.slice(0, 1)} voiceURI={null} name="Ana" onPick={noop} />);
    expect(html).not.toContain("choice__row");
    expect(html).not.toMatch(/<button[^>]*audio-btn[^>]*disabled/);
  });

  it("ohne Stimme erklärt ein Hinweis, wie man sie lädt, und die App läuft ohne Ton weiter", () => {
    const html = renderToStaticMarkup(<VoiceTest voices={[]} voiceURI={null} name="Ana" onPick={noop} />);
    expect(html).toContain("Bedienungshilfen, Gesprochene Inhalte, Stimmen, Spanisch");
    expect(html).toContain("läuft die App ohne Ton");
    expect(html).toMatch(/<button[^>]*audio-btn[^>]*disabled/);
  });
});

describe("Einstellungen bleiben dauerhaft", () => {
  it("Name, Stimme und Tempo überstehen ein Neuladen", () => {
    const clock = newClock();
    const data = new Map<string, string>();
    const storage: StorageLike = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
    const store = createProgressStore({ storage, now: clock.now });
    expect(store.createProfile("Ana")).toBe(true);
    store.update((p) => updateProfile(p, { name: "Anna" }));
    store.update((p) => updateProfile(p, { voiceURI: "b" }));
    store.update((p) => updateProfile(p, { rate: "slow" }));
    const state = createProgressStore({ storage, now: clock.now }).getSnapshot();
    expect(state.status).toBe("ready");
    if (state.status === "ready") expect(state.progress.profile).toMatchObject({ name: "Anna", voiceURI: "b", rate: "slow" });
  });

  it("ein ungültiger Name ändert nichts", () => {
    const p = newProgress(newClock(), "Ana");
    expect(updateProfile(p, { name: "   " }).profile.name).toBe("Ana");
    expect(updateProfile(p, { name: "x".repeat(31) }).profile.name).toBe("Ana");
  });
});
