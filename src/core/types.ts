// Typen für Lerninhalte (content/SCHEMA.md) und Fortschritt (docs/02-spezifikation.md, Abschnitt 4.2).
// Diese Datei gehört zu AP0. Änderungswünsche an die Hauptsitzung melden.

// ---------- Lerninhalte ----------

export type ItemKind = "word" | "phrase" | "frame";

export interface Example {
  es: string;
  de: string;
}

export interface Item {
  /** `uNN-iMM`, im ganzen Kurs eindeutig und für immer gleich. */
  id: string;
  es: string;
  de: string;
  kind: ItemKind;
  note_de?: string;
  /** Pflicht bei `frame`. Vorgelesen wird dann `example.es` statt `es`. */
  example?: Example;
}

export interface GrammarRow {
  label_de: string;
  es: string;
  de: string;
}

export interface Grammar {
  topic_de: string;
  explanation_de: string;
  table: GrammarRow[];
  examples: Example[];
}

export interface DialogueLine {
  speaker: string;
  es: string;
  de: string;
  /** Wahr genau bei der Sprecherin „Tú“. */
  learner: boolean;
}

export interface Dialogue {
  setting_de: string;
  lines: DialogueLine[];
}

export interface Cloze {
  id: string;
  /** Genau eine Lücke aus drei Unterstrichen `___`. */
  es: string;
  answer: string;
  options: string[];
  de: string;
}

export interface Build {
  id: string;
  /** Bausteine in richtiger Reihenfolge. Die Lösung ist `tokens.join(" ")`. */
  tokens: string[];
  de: string;
}

export interface Mission {
  id: string;
  title_de: string;
  task_de: string;
  say: string[];
  /** Übersetzungen der Sätze in `say`, gleich lang und in derselben Reihenfolge. */
  say_de?: string[];
}

export interface Unit {
  id: string;
  stop: number;
  title_es: string;
  title_de: string;
  can_do_de: string;
  tips_de?: string[];
  grammar: Grammar;
  items: Item[];
  dialogue: Dialogue;
  cloze: Cloze[];
  build: Build[];
  mission: Mission;
  canarias_de: string;
}

export interface Course {
  id: string;
  title_de: string;
  level: string;
  language_ui: string;
  language_target: string;
  units: string[];
  minutes_per_day: [number, number];
  plan: {
    first_stop_date: string;
    last_stop_date: string;
    final_review_date: string;
    note_de: string;
  };
}

export interface Phrase {
  id: string;
  es: string;
  de: string;
  note_de?: string;
}

export interface PhraseCategory {
  id: string;
  title_de: string;
  note_de?: string;
  phrases: Phrase[];
}

export interface Phrasebook {
  categories: PhraseCategory[];
}

export interface Reference {
  numbers: { n: number; es: string }[];
  weekdays: { es: string; de: string }[];
}

// ---------- Lernlogik ----------

/** Fach im Karteikasten. */
export type Box = 1 | 2 | 3 | 4 | 5;

/** Schritt der Lerneinheit: 1 Wiederholen, 2 Neue Karten, 3 Grammatik, 4 Dialog, 5 Abschlussrunde, 6 Mission. */
export type Step = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Aufgabentypen aus Abschnitt 2.4 der Spezifikation:
 * recognize = Erkennen, listen = Hören, write = Schreiben, recall = Erinnern,
 * pairs = Paare, cloze = Lücke, build = Satzbau, say = „Sag es laut“ (Selbsteinschätzung).
 */
export type TaskType = "recognize" | "listen" | "write" | "recall" | "pairs" | "cloze" | "build" | "say";

/** Lokaler Kalendertag im Format JJJJ-MM-TT. */
export type Day = string;

// ---------- Fortschritt ----------

export type SpeechRate = "normal" | "slow";
export type MissionFeeling = "leicht" | "mittel" | "schwer";

export interface CardProgress {
  box: Box;
  due: Day;
  right: number;
  wrong: number;
  lastSeen: Day;
}

export interface UnitProgress {
  /** Nächster offener Schritt. */
  step: Step;
  /** ISO-Zeitpunkt. */
  startedAt: string;
  completedAt?: string;
  /**
   * Ids der Aufgaben (Karten und Satzbau), die in der laufenden Abschlussrunde schon beantwortet sind.
   * Damit wertet ein Neuladen mitten in Schritt 5 nichts doppelt. Entfällt mit dem Abschluss der Haltestelle.
   */
  answered?: string[];
}

export interface MissionProgress {
  state: "done" | "skipped";
  /** ISO-Zeitpunkt. */
  at: string;
  feeling?: MissionFeeling;
  note?: string;
}

/** Ein Objekt unter dem Schlüssel `guagua:v1` in localStorage. */
export interface Progress {
  schema: 1;
  profile: {
    name: string;
    /** ISO-Zeitpunkt. */
    createdAt: string;
    voiceURI: string | null;
    rate: SpeechRate;
    /** Ruhemodus. */
    calm: boolean;
  };
  /** Schlüssel: Item-id. */
  cards: Record<string, CardProgress>;
  /** Schlüssel: Unit-id. */
  units: Record<string, UnitProgress>;
  /** Schlüssel: Mission-id. */
  missions: Record<string, MissionProgress>;
  stats: {
    points: number;
    streak: number;
    lastActiveDay: Day | null;
    /** Tag der letzten beendeten Wiederholrunde. Wiederholen steht einmal am Tag am Anfang. */
    lastReviewDay?: Day;
    activeMsByDay: Record<Day, number>;
  };
  /** Gemerktes: ids aus dem Sprachführer und ids von Lernkarten. */
  favorites: string[];
  /** Notizen der Lernenden für Florian („Hat mir gefehlt“, „Fehler gefunden“), `at` als ISO-Zeitpunkt. */
  notes?: { at: string; text: string }[];
  finalReview?: { at: string; right: number; total: number };
  /**
   * Endstation, solange sie läuft: die 30 gewählten Karten (`ids`, in der Reihenfolge der Runde), die schon beantworteten
   * (`answered`, erste Antworten) und wie viele davon richtig waren. Damit wertet ein Neuladen mitten in der Endstation
   * nichts doppelt und die Auswahl bleibt gleich, auch wenn sich Fächer ändern. Entfällt mit `finalReview`.
   */
  finalRun?: { ids: string[]; answered: string[]; right: number };
}
