import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ActionBar,
  AnswerList,
  AnswerRow,
  AudioButton,
  Es,
  HomeHeader,
  HomePage,
  Line,
  LessonPage,
  Marker,
  MissionRow,
  Mountain,
  MOUNTAIN_POINTS,
  Notice,
  PrimaryButton,
  SimplePage,
  StopDot,
  TabBar,
  TextButton,
  Today,
  UnitHeader,
  UnitProgress,
  type LineStop,
  type StopState,
} from "./index";

const html = renderToStaticMarkup;

describe("Spanischer Text", () => {
  it("Es setzt lang=es und die Klasse es", () => {
    const out = html(<Es>Buenos días</Es>);
    expect(out).toContain('lang="es"');
    expect(out).toContain('class="es"');
  });

  it("Es trägt lang=es auch in jeder Größe und jedem Element", () => {
    for (const size of ["text", "card", "today", "stop", "inherit"] as const) {
      expect(html(<Es size={size}>hola</Es>)).toContain('lang="es"');
    }
    expect(html(<Es as="h1">hola</Es>)).toMatch(/^<h1 lang="es"/);
  });

  it("Marker setzt die Marker-Klasse", () => {
    expect(html(<Marker>x</Marker>)).toContain('class="marker"');
  });

  it("Spanische Namen in der Linie, in der Mission und im Block Heute tragen lang=es", () => {
    const stops: LineStop[] = [{ id: "a", name: "¡Hola!", topic: "Begrüßen", state: "done" }];
    expect(html(<Line stops={stops} />)).toContain('lang="es"');
    expect(html(<MissionRow title="t" phrases={["Buenos días."]} />)).toContain('lang="es"');
    expect(html(<Today label="Heute" title="En el café" text="x" />)).toContain('lang="es"');
    expect(html(<Today label="Heute" title="Für heute fertig" titleLang="de" text="x" />)).not.toContain('lang="es"');
  });
});

describe("Antwortzeile", () => {
  const states = ["selectable", "correct", "wrong", "locked"] as const;

  it("jeder Zustand hat ein Symbol (Kreis oder SVG) und die richtige Klasse", () => {
    for (const state of states) {
      const out = html(<AnswerRow state={state}>Antwort</AnswerRow>);
      expect(out).toContain(`answer--${state}`);
      expect(out).toMatch(/answer__circle|<svg/);
    }
  });

  it("richtig zeigt Haken und den Text richtig", () => {
    const out = html(<AnswerRow state="correct">Antwort</AnswerRow>);
    expect(out).toContain("<svg");
    expect(out).toContain("M4 12.5l5 5L20 6.5");
    expect(out).toContain(">richtig<");
  });

  it("falsch gewählt zeigt Kreuz und den Text deine Antwort", () => {
    const out = html(<AnswerRow state="wrong">Antwort</AnswerRow>);
    expect(out).toContain("M6 6l12 12M18 6L6 18");
    expect(out).toContain(">deine Antwort<");
    expect(out).not.toContain(">richtig<");
  });

  it("wählbar ist bedienbar, die übrigen sind gesperrt", () => {
    expect(html(<AnswerRow state="selectable">a</AnswerRow>)).not.toContain("disabled");
    for (const state of ["correct", "wrong", "locked"] as const) {
      expect(html(<AnswerRow state={state}>a</AnswerRow>)).toContain("disabled");
    }
  });

  it("AnswerList ist eine Gruppe", () => {
    expect(html(<AnswerList label="Antworten">x</AnswerList>)).toContain('role="group"');
  });
});

describe("Knöpfe", () => {
  it("Hauptknopf ist ein button, mit href ein Link", () => {
    expect(html(<PrimaryButton>Weiter</PrimaryButton>)).toMatch(/^<button type="button" class="btn"/);
    expect(html(<PrimaryButton href="#x">Weiter</PrimaryButton>)).toMatch(/^<a class="btn" href="#x"/);
  });

  it("Tonknopf: normal, langsam, deaktiviert", () => {
    expect(html(<AudioButton />)).toContain("Anhören");
    expect(html(<AudioButton variant="slow" />)).toContain("Langsam");
    expect(html(<AudioButton />)).not.toContain("disabled");
    expect(html(<AudioButton disabled />)).toContain("disabled");
  });

  it("Textknopf ist ein button", () => {
    expect(html(<TextButton>Abhaken</TextButton>)).toContain("text-btn");
  });

  it("ActionBar kennt die Variante über der unteren Leiste", () => {
    expect(html(<ActionBar aboveTabs>x</ActionBar>)).toContain("action-bar--above-tabs");
  });
});

describe("Haltepunkt, Linie, Fortschritt", () => {
  const states: StopState[] = ["locked", "open", "running", "done"];

  it("StopDot hat je Zustand eine Klasse, nur abgeschlossen einen Haken, Endstation ist ein Quadrat", () => {
    for (const s of states) {
      const out = html(<StopDot state={s} />);
      expect(out).toContain(`stop-dot--${s}`);
      expect(out.includes("<svg")).toBe(s === "done");
    }
    expect(html(<StopDot state="locked" terminus />)).toContain("stop-dot--terminus");
  });

  it("Line zeigt Name, Thema und Zustandstext, als geordnete Liste", () => {
    const stops: LineStop[] = states.map((state, i) => ({ id: `s${i}`, name: `N${i}`, topic: `T${i}`, state }));
    const out = html(<Line stops={stops} title="Deine Linie" summary="1 von 10 abgeschlossen" />);
    expect(out).toContain("<ol");
    for (let i = 0; i < 4; i++) expect(out).toContain(`T${i}`);
    expect(out).toContain(">heute<");
    expect(out).toContain(">läuft<");
    expect(out).toContain(">abgeschlossen<");
    expect(out).toContain("Deine Linie");
    // Marker nur bei offen und läuft
    expect(out.match(/class="marker"/g)?.length).toBe(2);
  });

  it("Line macht nur auswählbare Haltestellen zum Knopf", () => {
    const stops: LineStop[] = [
      { id: "a", name: "A", topic: "t", state: "done", selectable: true },
      { id: "b", name: "B", topic: "t", state: "locked" },
    ];
    expect(html(<Line stops={stops} onSelect={() => undefined} />).match(/<button/g)?.length).toBe(1);
  });

  it("UnitProgress zeigt sechs Punkte: erledigt, aktuell, offen", () => {
    const out = html(<UnitProgress current={3} />);
    expect(out.match(/stop-dot--done/g)?.length).toBe(2);
    expect(out.match(/stop-dot--open/g)?.length).toBe(1);
    expect(out.match(/stop-dot--locked/g)?.length).toBe(3);
    expect(out).toContain("Schritt 3 von 6");
  });

  it("UnitHeader: Schließen-Knopf hat aria-label, Zähler steht als Text", () => {
    const out = html(<UnitHeader current={5} counter="5 von 18" />);
    expect(out).toContain('aria-label="Lerneinheit schließen"');
    expect(out).toContain("5 von 18");
  });
});

describe("Berg", () => {
  it("hat zehn Haltepunkte an den Stellen aus dem Design-Dokument", () => {
    expect(MOUNTAIN_POINTS).toEqual([
      [6.5, 108.2],
      [13, 100.4],
      [19.4, 92.6],
      [25.9, 84.8],
      [32.3, 77],
      [38.8, 69.3],
      [45.3, 61.5],
      [51.7, 53.7],
      [58.2, 45.9],
      [64.6, 38.1],
    ]);
    const out = html(<Mountain stops={[]} />);
    expect(out.match(/<circle/g)?.length).toBe(10);
    expect(out).toContain('viewBox="0 0 180 119"');
    expect(out).toContain('aria-hidden="true"');
  });

  it("Zustände bestimmen Radius und Klasse", () => {
    const out = html(<Mountain stops={["done", "open", "running"]} />);
    expect(out).toContain('mountain__stop--done" cx="6.5" cy="108.2" r="4"');
    expect(out).toContain('mountain__stop--open" cx="13" cy="100.4" r="5.5"');
    expect(out).toContain('mountain__stop--running" cx="19.4" cy="92.6" r="5.5"');
    expect(out).toContain('mountain__stop--locked" cx="25.9" cy="84.8" r="3.2"');
  });

  it("Pfade stimmen mit dem Design-Dokument", () => {
    const out = html(<Mountain stops={[]} />);
    expect(out).toContain('d="M10 118L78 36Q90 20 102 36L170 118Z"');
    expect(out).toContain('d="M65.6 51L78 36Q90 20 102 36L114.4 51L102 44L90 54L78 44Z"');
    expect(out).toContain('d="M90 28V9"');
    expect(out).toContain('d="M90 10h13l-3.5 4 3.5 4H90z"');
    expect(out).toContain('d="M6.5 108.2L64.6 38.1"');
  });
});

describe("Leiste, Hinweis, Raster", () => {
  it("TabBar hat vier Reiter aus Text und markiert den aktiven", () => {
    const out = html(<TabBar active="missions" />);
    expect(out).toContain('<nav aria-label="Bereiche"');
    for (const t of ["Linie", "Missionen", "Sprachführer", "Mehr"]) expect(out).toContain(`>${t}<`);
    expect(out.match(/aria-current="page"/g)?.length).toBe(1);
    expect(out).not.toContain("<svg");
  });

  it("Notice mit und ohne Knopf", () => {
    const withBtn = html(<Notice text="Neue Version bereit." actionLabel="Neu laden" />);
    expect(withBtn).toContain('role="status"');
    expect(withBtn).toContain("Neu laden");
    expect(html(<Notice text="Hinweis" />)).not.toContain("<button");
  });

  it("Raster-Bausteine rendern ihre Bereiche", () => {
    const home = html(
      <HomePage
        header={<HomeHeader date="Dienstag, 24. November" progress="Tag 2 von 10" stops={["done", "open"]} />}
        today={<Today label="Heute" title="En el café" text="x" />}
        action={<ActionBar>a</ActionBar>}
        line={<p>l</p>}
      />,
    );
    expect(home).toContain('class="home"');
    expect(home).toContain("Tag 2 von 10");
    expect(html(<LessonPage footer={<p>f</p>}>x</LessonPage>)).toContain('class="lesson"');
    expect(html(<SimplePage>x</SimplePage>)).toContain('class="simple"');
  });
});
