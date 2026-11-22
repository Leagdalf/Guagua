// Block „Heute“ aus dem Plan des Tages: Beschriftung, große Zeile, Erklärzeile und Hauptknopf.
// Texte nach docs/04-design.md, Abschnitt „Texte“ (beide Tabellen zum Block „Heute“). Reine Funktion, kein React.

import { getUnit } from "../../core/content";
import type { TodayPlan } from "../../core/units";
import type { Step } from "../../core/types";
import type { SessionRequest } from "../session/types";

/** Ein Stück der Erklärzeile: Deutsch oder ein spanisches Wort (wird kursiv gesetzt und trägt `lang="es"`). */
export type TextPart = string | { es: string };

export type BlockAction =
  /** Hauptknopf startet die Lerneinheit. */
  | { type: "session"; request: SessionRequest }
  /** Hauptknopf führt zu den Missionen. */
  | { type: "missions" }
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

/**
 * `hasExtraCards`: Es gibt Karten aus abgeschlossenen Haltestellen. Nur dann bietet der Fall „Alles erledigt“
 * „10 Karten extra“ an, sonst bleibt der Block ohne Hauptknopf.
 */
export function todayBlock(plan: TodayPlan, hasExtraCards = true): TodayBlock {
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
      };
    }
    // Keine Haltestelle im Angebot: nur Wiederholen.
    const due = plan.dueCount === 1 ? "1 Karte ist fällig." : `${plan.dueCount} Karten sind fällig.`;
    const cap = plan.dueCount > plan.reviewCount && plan.reviewCount > 0 ? ` Heute kommen ${plan.reviewCount} dran.` : "";
    return {
      label: "Heute",
      title: "Wiederholen",
      titleLang: "de",
      text: [due + cap],
      button: "Mit Wiederholen beginnen",
      action: { type: "session", request: { kind: "day", unitId: null } },
    };
  }

  if (plan.kind === "missionOnly") {
    // Die Mission steht auf der Startseite nur in der angehefteten Zeile, nicht noch einmal hier.
    const next = plan.nextUnitId ? getUnit(plan.nextUnitId) : undefined;
    const text: TextPart[] = next
      ? [`Morgen geht es weiter mit Haltestelle ${next.stop}, `, { es: next.title_es }, ". Draußen wartet deine Mission."]
      : ["Draußen wartet deine Mission."];
    return {
      label: "Heute",
      title: "Für heute fertig",
      titleLang: "de",
      text,
      button: "Mission ansehen",
      action: { type: "missions" },
    };
  }

  const next = plan.nextUnitId ? getUnit(plan.nextUnitId) : undefined;
  const text: TextPart[] = next
    ? [`Morgen: Haltestelle ${next.stop}, `, { es: next.title_es }]
    : [plan.finalStationOpen ? "Alle zehn Haltestellen sind geschafft. Die Endstation folgt." : "Alle zehn Haltestellen sind geschafft."];
  return {
    label: "Heute",
    title: "Für heute fertig",
    titleLang: "de",
    text,
    button: hasExtraCards ? "10 Karten extra" : null,
    action: hasExtraCards ? { type: "extra" } : null,
  };
}
