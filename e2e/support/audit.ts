// Prüfungen, die an jeder Ansicht laufen: Breiten (kein waagerechtes Scrollen, Knöpfe mindestens 44 px hoch)
// und Barrierefreiheit im Groben (ein main, Knöpfe mit Namen, spanischer Text mit lang="es").

import type { Page } from "@playwright/test";
import { units } from "./content";

export const WIDTHS = [390, 820, 1180] as const;

export interface Finding {
  where: string;
  problem: string;
}

/** Stellt die Breite ein und wartet, bis die Seite umgebrochen hat. */
export async function resize(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: width < 700 ? 844 : 1180 });
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}

interface LayoutReport {
  scrollWidth: number;
  clientWidth: number;
  wide: string[];
  small: string[];
}

/** Misst die Seite: waagerechter Überstand, Elemente rechts außerhalb, Knöpfe unter 44 px Höhe. */
async function measure(page: Page): Promise<LayoutReport> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const describe = (el: Element): string => {
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      const label = el.getAttribute("aria-label");
      return `<${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(" ")[0]}` : ""}> „${label ?? text}“`;
    };
    const visible = (el: Element): boolean => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return false;
      // Nur für Screenreader: `.vh` (1 px, abgeschnitten) zählt nicht.
      if (el.closest(".vh")) return false;
      if (rect.width <= 1 && rect.height <= 1) return false;
      // Verdeckt durch inert/aria-hidden-Wurzel zählt trotzdem nicht als sichtbar für die Hand: hier egal.
      return true;
    };
    const wide: string[] = [];
    const small: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (!visible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right > doc.clientWidth + 1 || rect.left < -1) wide.push(`${describe(el)} rechts=${Math.round(rect.right)} links=${Math.round(rect.left)}`);
      const isButton =
        el.tagName === "BUTTON" || (el.tagName === "A" && el.hasAttribute("href")) || el.getAttribute("role") === "button" || (el.tagName === "INPUT" && ["button", "submit"].includes((el as HTMLInputElement).type));
      if (isButton && rect.height < 43.5) small.push(`${describe(el)} Höhe=${Math.round(rect.height * 10) / 10}`);
    }
    return { scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth), clientWidth: doc.clientWidth, wide, small };
  });
}

/** Prüft die aktuelle Ansicht bei allen genannten Breiten. Gibt Befunde zurück, wirft nichts. */
export async function layoutFindings(page: Page, where: string, widths: readonly number[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const width of widths) {
    await resize(page, width);
    const report = await measure(page);
    const label = `${where} @${width}`;
    if (report.scrollWidth > report.clientWidth) {
      findings.push({ where: label, problem: `waagerecht scrollbar: Inhalt ${report.scrollWidth} px bei ${report.clientWidth} px Breite` });
    }
    for (const entry of report.wide.slice(0, 4)) findings.push({ where: label, problem: `ragt seitlich aus dem Fenster: ${entry}` });
    for (const entry of report.small) findings.push({ where: label, problem: `Knopf niedriger als 44 px: ${entry}` });
  }
  return findings;
}

// ---------- Barrierefreiheit ----------

const spanishTexts = new Set<string>();
for (const unit of units) {
  spanishTexts.add(unit.title_es);
  for (const item of unit.items) {
    if (item.es.length >= 4) spanishTexts.add(item.es);
    if (item.example) spanishTexts.add(item.example.es);
  }
  for (const line of unit.dialogue.lines) spanishTexts.add(line.es.replaceAll("{name}", "Lena"));
  for (const cloze of unit.cloze) spanishTexts.add(cloze.es);
  for (const build of unit.build) spanishTexts.add(build.tokens.join(" "));
  for (const phrase of unit.mission.say) spanishTexts.add(phrase);
}

export async function a11yFindings(page: Page, where: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const mains = await page.locator("main").count();
  if (mains !== 1) findings.push({ where, problem: `${mains} main-Bereiche statt genau einem` });

  // Der Zugänglichkeitsbaum nennt jeden Knopf mit Namen: `- button "Name"`. Ohne Namen steht nur `- button`.
  const tree = await page.locator("body").ariaSnapshot();
  for (const line of tree.split("\n")) {
    if (/^\s*- (button|link|searchbox|textbox)(\s*\[[^\]]*\])*:?\s*$/.test(line)) findings.push({ where, problem: `Element ohne Namen: ${line.trim()}` });
  }

  // Spanischer Text trägt lang="es": Blätter, deren Text genau ein spanischer Text der Inhalte ist.
  const offenders = await page.evaluate((texts: string[]) => {
    const set = new Set(texts.map((text) => text.toLowerCase()));
    const bad: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (el.children.length > 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").toLowerCase();
      if (!text || !set.has(text)) continue;
      const lang = el.closest("[lang]")?.getAttribute("lang") ?? "";
      if (!/^es(-|$)/i.test(lang)) bad.push(`<${el.tagName.toLowerCase()}> „${text}“ hat lang="${lang}"`);
    }
    // Auch jedes Element der Klasse `es` trägt lang="es" (Newsreader kursiv bedeutet Spanisch).
    for (const el of Array.from(document.body.querySelectorAll(".es"))) {
      const lang = el.closest("[lang]")?.getAttribute("lang") ?? "";
      if (!/^es(-|$)/i.test(lang)) bad.push(`.es „${(el.textContent ?? "").trim().slice(0, 30)}“ hat lang="${lang}"`);
    }
    return bad;
  }, [...spanishTexts]);
  for (const entry of offenders) findings.push({ where, problem: entry });
  return findings;
}

// ---------- Gestaltung (docs/04-design.md, „Was nicht vorkommt“ und Schrift) ----------

export async function designFindings(page: Page, where: string): Promise<Finding[]> {
  const found = await page.evaluate(() => {
    const bad: string[] = [];
    const describe = (el: Element): string => `<${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(" ")[0]}` : ""}> „${(el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30)}“`;
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || el.closest(".vh")) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      // Schatten: nur der Marker darf einen haben.
      if (style.boxShadow !== "none" && !el.classList.contains("marker")) bad.push(`Schatten an ${describe(el)}: ${style.boxShadow}`);
      if (style.textShadow !== "none") bad.push(`Textschatten an ${describe(el)}`);
      if (style.backgroundImage.includes("gradient")) bad.push(`Verlauf an ${describe(el)}`);
      const hasOwnText = Array.from(el.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "");
      if (hasOwnText) {
        if (parseFloat(style.fontSize) < 13) bad.push(`Schrift unter 13 px (${style.fontSize}) an ${describe(el)}`);
        if (/\p{Extended_Pictographic}/u.test(el.textContent ?? "")) bad.push(`Emoji in ${describe(el)}`);
      }
      if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && parseFloat(style.fontSize) < 16) bad.push(`Eingabefeld unter 16 px (${style.fontSize}): ${describe(el)}`);
      if (el.classList.contains("es")) {
        if (style.fontStyle !== "italic") bad.push(`Spanisch nicht kursiv: ${describe(el)}`);
        if (!/Newsreader/i.test(style.fontFamily)) bad.push(`Spanisch nicht in Newsreader (${style.fontFamily}): ${describe(el)}`);
      }
      if (el.tagName === "BUTTON" && style.touchAction !== "manipulation") bad.push(`touch-action ${style.touchAction} an Knopf ${describe(el)}`);
      if (hasOwnText && !el.closest(".es") && !el.closest('[lang="es"]') && /Newsreader/i.test(style.fontFamily) && el.tagName !== "H1" && !el.closest("h1, h2")) {
        bad.push(`Newsreader ohne Spanisch: ${describe(el)}`);
      }
    }
    return bad;
  });
  return found.map((problem) => ({ where, problem }));
}