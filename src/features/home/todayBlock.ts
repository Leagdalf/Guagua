// Block „Heute“ aus dem Plan des Tages: Beschriftung, große Zeile, Erklärzeile und Hauptknopf.
// Texte nach docs/04-design.md, Abschnitt „Texte“ (beide Tabellen zum Block „Heute“) und Spezifikation 2.9.
// Reine Funktion, kein React.

import { EXTRA_ROUND_CARDS, FINAL_REVIEW } from "../../core/config";
import { getUnit } from "../../core/content";
import type { TodayPlan } from "../../core/units";
import type { Day, Step } from "../../core/types";
import type { SessionRequest } from "../session/types";
import { nextReviewSentence, waitingSentence } from "./homeFacts";
import type { NextReview } from "./homeFacts";

/** Ein Stück der Erklärzeile: Deutsch oder ein spanisches Wort (wird kursiv gesetzt und trägt `lang="es"`). */
export type TextPart = string | { es: string };

export type BlockAction =
  /** Hauptknopf startet die Lerneinheit. */
  | { type: "session"; request: SessionRequest }
  /** Hauptknopf führt zu den Missionen. */
  | { type: "missions" }
  /** Hauptknopf öffnet „Deine Linie“ (Endstation geschafft). */
  | { type: "final-line" }
  /** Hauptknopf startet „10 Karten extra“. */
  | { type: "extra" };

export interface TodayBlock {
  label: string;
  title: string;
  /** `es`: Spanisch mit Marker. `de`: Deutsch in Figtree 600. */
  titleLang: "es" | "de";
  text: TextPart[];
  /** `null`: kein Hauptknopf (nur im Fall „Alles erledigt“, wenn es keine Karten zum Üben gibt). */
  button: string | null;
  action: BlockAction | null;
  /** Textknopf unter dem Hauptknopf („Noch eine Haltestelle“, Abgleich mit dem Plan). */
  secondary: { label: string; action: BlockAction } | null;
}

/** Angaben, die der Lernstand allein nicht hergibt. Alles ist freiwillig; ohne Angabe gilt der Fall ohne Zusatz. */
export interface TodayExtras {
  /** Die offene Mission ist auf der Startseite angeheftet (`pinnedMissionId`). Ohne Angabe gilt sie als angeheftet. */
  missionPinned?: boolean;
  /** Satz zum Abgleich mit dem Plan (`planSentence`), nur im Zustand „Für heute fertig“. */
  planSentence?: string | null;
  /** Heutiger Tag, für den Wochentag der nächsten Wiederholung. */
  day?: Day;
  /** Nächste Fälligkeit (`nextReview`), nach der Endstation. */
  nextReview?: NextReview | null;
  /** Die Endstation wurde heute geschafft (`finalDoneToday`). Ohne Angabe gilt das als wahr. */
  finalDoneToday?: boolean;
}

export const STEP_NAMES: Record<Step, string> = {
  1: "Wiederholen",
  2: "Neue Karten",
  3: "Grammatik",
  4: "Dialog",
  5: "Abschlussrunde",
  6: "Mission",
};

/** Text ohne Auszeichnung, für Tests und Screenreader-Texte. */
export function plainText(parts: readonly TextPart[]): string {
  return parts.map((part) => (typeof part === "string" ? part : part.es)).join("");
}

function cards(n: number): string {
  return n === 1 ? "1 Karte" : `${n} Karten`;
}

/** Punkt nach einem Haltestellennamen, außer er endet schon auf „?“ oder „!“ („¿Dónde está?“). */
export function dotAfterName(name: string): string {
  return /[?!]$/.test(name) ? "" : ".";
}

/** Knopf „10 Karten extra“. Die Zahl steht in `config.ts`. */
export const EXTRA_BUTTON_TEXT = `${EXTRA_ROUND_CARDS} Karten extra`;

/**
 * `hasExtraCards`: Es gibt Karten aus abgeschlossenen Haltestellen. Nur dann bietet der Fall „Alles erledigt“
 * „10 Karten extra“ an, sonst bleibt der Block ohne Hauptknopf.
 */
export function todayBlock(plan: TodayPlan, hasExtraCards = true, extras: TodayExtras = {}): TodayBlock {
  const final = FINAL_REVIEW.taskCount;
  if (plan.kind === "work") {
    const unit = plan.unitId ? getUnit(plan.unitId) : undefined;
    if (unit) {
      const label = `Heute · Haltestelle ${unit.stop}`;
      const session: BlockAction = { type: "session", request: { kind: "day", unitId: unit.id } };
      const review = `Erst ${cards(plan.reviewCount)} wiederholen`;
      if (plan.unitState === "running") {
        const step: Step = plan.unitStep ?? 2;
        const tail = `weiter bei Schritt ${step} von 6`;
        return {
          label,
          title: unit.title_es,
          titleLang: "es",
          text: [plan.reviewPending ? `${review}, dann ${tail}.` : `Weiter bei Schritt ${step} von 6: ${STEP_NAMES[step]}.`],
          button: plan.reviewPending ? "Mit Wiederholen beginnen" : "Haltestelle fortsetzen",
          action: session,
          secondary: null,
        };
      }
      const fresh = plan.newCardCount === 1 ? "1 neue Karte" : `${plan.newCardCount} neue Karten`;
      return {
        label,
        title: unit.title_es,
        titleLang: "es",
        text: [plan.reviewPending ? `${unit.title_de}. ${review}, dann ${plan.newCardCount} neue.` : `${unit.title_de}. ${fresh}.`],
        button: plan.reviewPending ? "Mit Wiederholen beginnen" : "Haltestelle beginnen",
        action: session,
        secondary: null,
      };
    }
    // Keine Haltestelle im Angebot: die Endstation, sonst nur Wiederholen.
    if (plan.finalStationOpen) {
      return {
        label: "Heute · Endstation",
        title: "Repaso final",
        titleLang: "es",
        text: [plan.reviewPending ? `Erst ${cards(plan.reviewCount)} wiederholen, dann ${final} gemischte Aufgaben.` : `${final} gemischte Aufgaben über alle Karten.`],
        button: plan.reviewPending ? "Mit Wiederholen beginnen" : "Endstation beginnen",
        action: { type: "session", request: { kind: "final" } },
        secondary: null,
      };
    }
    const due = plan.dueCount === 1 ? "1 Karte ist fällig." : `${plan.dueCount} Karten sind fällig.`;
    const cap = plan.dueCount > plan.reviewCount && plan.reviewCount > 0 ? ` Heute kommen ${plan.reviewCount} dran.` : "";
    return {
      label: "Heute",
      title: "Wiederholen",
      titleLang: "de",
      text: [due + cap],
      button: "Mit Wiederholen beginnen",
      action: { type: "session", request: { kind: "day", unitId: null } },
      secondary: null,
    };
  }

  // Endstation geschafft (Spezifikation 2.9, Punkt 8): Steht heute nichts an, nennt der Block, was als Nächstes kommt.
  // Die Mission, falls noch offen, steht in der angehefteten Zeile.
  if (plan.finalResult) {
    const result = `${plan.finalResult.right} von ${plan.finalResult.total} richtig an der Endstation.`;
    const outlook =
      plan.dueCount > 0
        ? waitingSentence(plan.dueCount)
        : extras.nextReview && extras.day
          ? nextReviewSentence(extras.nextReview, extras.day)
          : null;
    const doneToday = extras.finalDoneToday ?? true;
    return {
      label: "Heute",
      title: doneToday ? "Linie geschafft" : "Für heute fertig",
      titleLang: "de",
      text: [doneToday ? (outlook ? `${result} ${outlook}` : result) : (outlook ?? result)],
      button: "Deine Linie ansehen",
      action: { type: "final-line" },
      secondary: null,
    };
  }

  const next = plan.nextUnitId ? getUnit(plan.nextUnitId) : undefined;
  const planLine = extras.planSentence ?? null;
  const secondary =
    planLine && next ? { label: "Noch eine Haltestelle", action: { type: "session", request: { kind: "day", unitId: next.id } } as BlockAction } : null;

  if (plan.kind === "missionOnly" && extras.missionPinned !== false) {
    // Die Mission steht auf der Startseite nur in der angehefteten Zeile, nicht noch einmal hier.
    const tail = planLine ? ` Draußen wartet deine Mission. ${planLine}` : " Draußen wartet deine Mission.";
    const text: TextPart[] = next
      ? [`Morgen geht es weiter mit Haltestelle ${next.stop}, `, { es: next.title_es }, `${dotAfterName(next.title_es)}${tail}`]
      : [tail.trim()];
    return {
      label: "Heute",
      title: "Für heute fertig",
      titleLang: "de",
      text,
      button: "Mission ansehen",
      action: { type: "missions" },
      secondary,
    };
  }

  const text: TextPart[] = next
    ? [`Morgen: Haltestelle ${next.stop}, `, { es: next.title_es }, ...(planLine ? [`${dotAfterName(next.title_es)} ${planLine}`] : [])]
    : ["Alle zehn Haltestellen sind geschafft."];
  return {
    label: "Heute",
    title: "Für heute fertig",
    titleLang: "de",
    text,
    button: hasExtraCards ? EXTRA_BUTTON_TEXT : null,
    action: hasExtraCards ? { type: "extra" } : null,
    secondary,
  };
}
