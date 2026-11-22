import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { allItems, allPhrases, phrasebook } from "../../core/content";
import { PhrasebookResults } from "./PhrasebookResults";
import { PhrasebookView } from "./PhrasebookView";
import { FAVORITES_TITLE } from "./favorites";
import { COURSE_SECTION_TITLE, itemRow } from "./rows";

function decode(html: string): string {
  return html
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;
const rows = (html: string) => count(html, /<li class="pb-row"/g);

describe("PhrasebookView (Server-Render, ohne DOM)", () => {
  const html = decode(renderToStaticMarkup(<PhrasebookView />));

  it("zeigt alle Sätze des Sprachführers mit Spanisch (lang=es) und Deutsch", () => {
    expect(rows(html)).toBe(allPhrases.length);
    for (const phrase of allPhrases) {
      expect(html).toContain(`lang="es" class="es">${phrase.es}</p>`);
      expect(html).toContain(phrase.de);
    }
  });

  it("spanischer Text steht nie ohne lang=es, auch nicht in einem aria-label", () => {
    for (const label of html.matchAll(/aria-label="([^"]*)"/g)) {
      for (const phrase of allPhrases) expect(label[1]).not.toContain(phrase.es);
    }
    // Ton- und Zeigen-Knöpfe verweisen mit aria-describedby auf den Satz
    for (const phrase of allPhrases) {
      const all = html.split(phrase.es).length - 1;
      const inEs = html.split(`lang="es" class="es">${phrase.es}</p>`).length - 1;
      expect(all, phrase.es).toBe(inEs);
    }
    const ids = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]!);
    expect(ids).toHaveLength(allPhrases.length * 2); // je Satz Anhören und Zeigen
    for (const id of ids) expect(html, id).toContain(`id="${id}" lang="es"`);
  });

  it("passt in AppShell: kein eigenes main, ein h1, die Kategorien als h2", () => {
    expect(html).not.toContain("<main");
    expect(count(html, /<h1[ >]/g)).toBe(1);
    expect(count(html, /<h2[ >]/g)).toBe(phrasebook.categories.length);
    expect(html).not.toContain("<h3");
  });

  it("zeigt alle Kategorien als Überschrift", () => {
    for (const category of phrasebook.categories) expect(html).toContain(`>${category.title_de}</h2>`);
  });

  it("der Hinweis zur Notrufnummer steht über den Sätzen der Kategorie „Notfall und Gesundheit“", () => {
    const index = phrasebook.categories.findIndex((c) => c.title_de === "Notfall und Gesundheit");
    expect(index).toBeGreaterThanOrEqual(0);
    const category = phrasebook.categories[index]!;
    expect(category.note_de).toContain("112");
    const heading = html.indexOf(`>${category.title_de}</h2>`);
    const note = html.indexOf(category.note_de!, heading);
    const firstPhrase = html.indexOf(`lang="es" class="es">${category.phrases[0]!.es}</p>`, heading);
    expect(heading).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(heading);
    expect(firstPhrase).toBeGreaterThan(note);
    const next = phrasebook.categories[index + 1];
    if (next) expect(note).toBeLessThan(html.indexOf(`>${next.title_de}</h2>`));
  });

  it("Tonknöpfe sind sichtbar und ohne Stimme deaktiviert; der Hinweis erscheint nicht zweimal", () => {
    expect(count(html, /<button[^>]*audio-btn[^>]*disabled/g)).toBe(allPhrases.length);
    expect(html.match(/class="notice"/g)).toBeNull(); // Server-Render: Hinweis erst im Browser
  });

  it("hat ein Suchfeld", () => {
    expect(html).toContain('type="search"');
  });
});

describe("Sprungliste", () => {
  const html = decode(renderToStaticMarkup(<PhrasebookView />));
  const targets = [...html.matchAll(/<button[^>]*class="text-btn pb-jump__btn"[^>]*data-target="([^"]+)"/g)].map((m) => m[1]!);

  it("hat so viele Einträge wie die Inhalte Kategorien haben, in deren Reihenfolge", () => {
    expect(targets).toHaveLength(phrasebook.categories.length);
    expect(targets).toEqual(phrasebook.categories.map((c) => `pb-cat-${c.id}`));
    for (const category of phrasebook.categories) expect(html).toContain(`pb-jump__btn" data-target="pb-cat-${category.id}">${category.title_de}</button>`);
  });

  it("jeder Eintrag verweist auf eine vorhandene Überschrift", () => {
    for (const target of targets) expect(html, target).toMatch(new RegExp(`<h2[^>]* id="${target}"`));
  });

  it("steht unter dem Suchfeld und vor den Kategorien, mit Namen für Screenreader", () => {
    expect(html.indexOf('type="search"')).toBeLessThan(html.indexOf('class="pb-jump"'));
    expect(html.indexOf('class="pb-jump"')).toBeLessThan(html.indexOf("<section"));
    expect(html).toContain('aria-label="Kategorien"');
  });

  it("ist während einer Suche ausgeblendet", () => {
    const searching = decode(renderToStaticMarkup(<PhrasebookView initialQuery="agua" />));
    expect(searching).not.toContain("pb-jump");
    expect(decode(renderToStaticMarkup(<PhrasebookView initialQuery="   " />))).toContain("pb-jump");
  });
});

describe("PhrasebookResults", () => {
  const render = (props: Parameters<typeof PhrasebookResults>[0]) => decode(renderToStaticMarkup(<PhrasebookResults {...props} />));
  const noop = () => {};

  it("„WASSER“ zeigt unter den Sätzen des Sprachführers genau zwei Sätze, Treffer aus dem Kurs kommen getrennt danach", () => {
    const html = render({ query: "WASSER", hasVoice: true });
    const split = html.indexOf(`>${COURSE_SECTION_TITLE}</h2>`);
    const phrases = split === -1 ? html : html.slice(0, split);
    expect(rows(phrases)).toBe(2);
    expect(phrases).toContain("Otra agua, por favor.");
    expect(phrases).toContain("No hay agua caliente.");
    expect(html).not.toContain("disabled");
  });

  it("„medico“ zeigt „Necesito un médico.“", () => {
    expect(render({ query: "medico", hasVoice: true })).toContain("Necesito un médico.");
  });

  it("„xyz“ zeigt einen leeren Zustand mit Text und keine Sätze", () => {
    const html = render({ query: "xyz", hasVoice: true });
    expect(html).not.toContain("pb-row");
    expect(html).toContain("Nichts gefunden für „xyz“");
  });

  it("„Rechnung“ zeigt die Karte „la cuenta, por favor“ unter „Aus dem Kurs“, mit Haltestelle", () => {
    const html = render({ query: "Rechnung", hasVoice: true, favorites: [], onToggleFavorite: noop, onShow: noop });
    const course = html.indexOf(`>${COURSE_SECTION_TITLE}</h2>`);
    expect(course).toBeGreaterThan(-1);
    const card = html.indexOf('lang="es" class="es">la cuenta, por favor</p>');
    expect(card).toBeGreaterThan(course);
    const rowHtml = html.slice(card, html.indexOf("</li>", card));
    expect(rowHtml).toContain("Anhören");
    expect(rowHtml).toContain("Zeigen");
    expect(rowHtml).toContain('aria-label="Merken"');
    expect(rowHtml).toMatch(/Haltestelle 2 · <span lang="es"/);
  });

  it("„farmacia“ findet die Karte aus Haltestelle 5", () => {
    const html = render({ query: "farmacia", hasVoice: true });
    const card = html.indexOf('lang="es" class="es">la farmacia</p>');
    expect(card).toBeGreaterThan(html.indexOf(`>${COURSE_SECTION_TITLE}</h2>`));
    expect(html.slice(card, html.indexOf("</li>", card))).toContain("Haltestelle 5 ·");
  });

  it("Treffer aus dem Kurs stehen nach den Sätzen des Sprachführers", () => {
    const html = render({ query: "agua", hasVoice: true });
    expect(html.indexOf("Otra agua, por favor.")).toBeLessThan(html.indexOf(`>${COURSE_SECTION_TITLE}</h2>`));
  });

  it("ohne Suchwort erscheint „Aus dem Kurs“ nicht", () => {
    expect(render({ query: "", hasVoice: true })).not.toContain(COURSE_SECTION_TITLE);
  });

  it("ein Satzmuster zeigt Muster und Beispielsatz; Ton und Vollbild nehmen den Beispielsatz", () => {
    const frame = allItems.find((item) => item.kind === "frame" && item.example)!;
    const example = frame.example!;
    const row = itemRow(frame, undefined);
    expect(row.speakText).toBe(example.es);
    expect(row.show).toEqual({ es: example.es, de: example.de });

    const html = render({ query: example.es, hasVoice: true, favorites: [], onToggleFavorite: noop, onShow: noop });
    const course = html.slice(html.indexOf(`>${COURSE_SECTION_TITLE}</h2>`));
    const exampleId = `pb-es-kurs-${frame.id}-example`;
    expect(course).toContain(`lang="es" class="es">${frame.es}</p>`);
    expect(course).toContain(`id="${exampleId}" lang="es" class="es pb-example">${example.es}</p>`);
    // Anhören, Zeigen und Stern lesen den Beispielsatz vor
    expect(count(course, new RegExp(`aria-describedby="${exampleId}"`, "g"))).toBeGreaterThanOrEqual(3);
  });

  it("ein Wort ist kein Satzmuster: gesprochen wird es selbst", () => {
    const word = allItems.find((item) => item.kind === "word")!;
    expect(itemRow(word, undefined).speakText).toBe(word.es);
    expect(itemRow(word, undefined).example).toBeUndefined();
  });
});

describe("Sterne und Zeigen in der Liste", () => {
  const render = (props: Parameters<typeof PhrasebookResults>[0]) => decode(renderToStaticMarkup(<PhrasebookResults {...props} />));
  const second = phrasebook.categories[1]!.phrases[0]!;
  const noop = () => {};

  it("jeder Satz hat Zeigen; mit Profil auch einen Stern „Merken“", () => {
    const html = render({ query: "", hasVoice: true, favorites: [], onToggleFavorite: noop, onShow: noop });
    expect(count(html, /pb-show-btn/g)).toBe(allPhrases.length);
    expect(count(html, /aria-label="Merken"/g)).toBe(allPhrases.length);
    expect(html).not.toContain("Nicht mehr merken");
  });

  it("ohne Profil gibt es keine Sterne, der Sprachführer läuft trotzdem", () => {
    const html = render({ query: "", hasVoice: true, favorites: null, onToggleFavorite: noop, onShow: noop });
    expect(html).not.toContain("pb-star");
    expect(rows(html)).toBe(allPhrases.length);
  });

  it("ohne gemerkte Sätze fehlt die Kategorie „Gemerkt“", () => {
    const html = render({ query: "", hasVoice: true, favorites: [], onToggleFavorite: noop });
    expect(html).not.toContain(`>${FAVORITES_TITLE}<`);
    expect(count(html, /<h2[ >]/g)).toBe(phrasebook.categories.length);
  });

  it("mit gemerkten Sätzen steht „Gemerkt“ vor der ersten Kategorie und der Satz bleibt in seiner Kategorie", () => {
    const html = render({ query: "", hasVoice: true, favorites: [second.id], onToggleFavorite: noop, onShow: noop });
    const gemerkt = html.indexOf(`>${FAVORITES_TITLE}<`);
    expect(gemerkt).toBeGreaterThan(-1);
    expect(gemerkt).toBeLessThan(html.indexOf(`>${phrasebook.categories[0]!.title_de}<`));
    expect(count(html, /<h2[ >]/g)).toBe(phrasebook.categories.length + 1);
    const occurrences = allPhrases.filter((p) => p.es === second.es).length;
    expect(html.split(second.es).length - 1).toBe(occurrences + 1);
    expect(count(html, /aria-label="Nicht mehr merken"/g)).toBe(2);
    expect(rows(html)).toBe(allPhrases.length + 1);
  });

  it("Merken einer Karte zeigt sie in „Gemerkt“, nach den gemerkten Sätzen, mit gefülltem Stern", () => {
    const card = allItems.find((item) => item.kind === "word")!;
    const html = render({ query: "", hasVoice: true, favorites: [card.id, second.id], onToggleFavorite: noop, onShow: noop });
    const gemerkt = html.indexOf(`>${FAVORITES_TITLE}<`);
    const firstCategory = html.indexOf(`>${phrasebook.categories[0]!.title_de}<`);
    const inGemerkt = html.slice(gemerkt, firstCategory);
    expect(inGemerkt).toContain(`lang="es" class="es">${card.es}</p>`);
    expect(inGemerkt.indexOf(second.es)).toBeGreaterThan(-1);
    expect(inGemerkt.indexOf(card.es)).toBeGreaterThan(inGemerkt.indexOf(second.es));
    expect(count(inGemerkt, /aria-label="Nicht mehr merken"/g)).toBe(2);
    expect(rows(html)).toBe(allPhrases.length + 2);
  });

  it("nur eine gemerkte Karte reicht für die Kategorie „Gemerkt“", () => {
    const card = allItems[0]!;
    const html = render({ query: "", hasVoice: true, favorites: [card.id], onToggleFavorite: noop });
    expect(html).toContain(`>${FAVORITES_TITLE}<`);
    expect(rows(html)).toBe(allPhrases.length + 1);
  });

  it("die Suche findet gemerkte Sätze wie bisher", () => {
    const html = render({ query: "xyz", hasVoice: true, favorites: [second.id], onToggleFavorite: noop });
    expect(html).toContain("Nichts gefunden");
  });

  it("ids der Sätze bleiben eindeutig, auch wenn ein Satz oder eine Karte zweimal erscheint", () => {
    const card = allItems.find((item) => item.kind === "frame")!;
    for (const query of ["", card.es]) {
      const html = render({ query, hasVoice: true, favorites: [second.id, card.id], onToggleFavorite: noop, onShow: noop });
      const ids = [...html.matchAll(/ id="(pb-es-[^"]+)"/g)].map((m) => m[1]!);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("spanischer Text aus Karten steht nie in einem aria-label", () => {
    const html = render({ query: "por favor", hasVoice: true, favorites: [], onToggleFavorite: noop, onShow: noop });
    for (const label of html.matchAll(/aria-label="([^"]*)"/g)) {
      for (const item of allItems) expect(label[1]).not.toContain(item.es);
    }
  });
});
