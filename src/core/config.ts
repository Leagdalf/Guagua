// Alle Stellgrößen der Lernlogik an einer Stelle.
// Quelle: docs/02-spezifikation.md, Abschnitt 5, dazu 2.2 bis 2.4 und 3.
// Diese Datei gehört zu AP0. Änderungswünsche an die Hauptsitzung melden.

import type { Box, TaskType } from "./types";

/** Schlüssel des Fortschritts in localStorage und dessen Schemaversion (4.2). */
export const STORAGE_KEY = "guagua:v1";
export const SCHEMA_VERSION = 1;

/** Abstand in Tagen bis zur nächsten Wiederholung, je Fach (5.1). */
export const BOX_INTERVAL_DAYS: Record<Box, number> = { 1: 0, 2: 1, 3: 3, 4: 6, 5: 12 };
export const MAX_BOX: Box = 5;

/** Falsche Antwort: zurück in Fach 1, fällig morgen. In derselben Runde frühestens nach drei anderen Karten, höchstens zweimal (5.1). */
export const WRONG_ANSWER = {
  box: 1 as Box,
  dueInDays: 1,
  repeatAfterOtherCards: 3,
  maxRepeatsPerRound: 2,
} as const;

/** Wiederholrunde endet nach 40 Karten oder 6 Minuten (5.2). */
export const REVIEW_ROUND = { maxCards: 40, maxMinutes: 6 } as const;

/** Freie Runde über den Knopf „10 Karten extra“ (2.2). */
export const EXTRA_ROUND_CARDS = 10;

/** Neue Karten kommen in Blöcken zu vier (2.3). */
export const NEW_CARDS_BLOCK_SIZE = 4;

/** Auswahlaufgaben haben vier Antworten (2.4). */
export const CHOICE_OPTION_COUNT = 4;

/** Aufgabentyp beim Wiederholen je Fach (2.4). Satzmuster bekommen statt „write“ immer „recall“. */
export const REVIEW_TASK_BY_BOX: Record<Box, TaskType> = {
  1: "recognize",
  2: "listen",
  3: "write",
  4: "write",
  5: "write",
};

/** „Schreiben“ ist gebaut: Wörter und Wendungen ab Fach 3 kommen als Schreibaufgabe, Satzmuster bleiben bei „Erinnern“. */
export const WRITE_TASK_ENABLED = true;

/**
 * Karten, deren deutsche Vorgabe mehrere gleich richtige Übersetzungen zulässt (2.4, faire Schreibaufgaben).
 * Sie kommen nie als „Schreiben“ und nie als „Sag es laut“, sondern als „Erinnern“.
 */
export const WRITE_EXCLUDED_ITEM_IDS: readonly string[] = [
  "u01-i10", "u01-i16",
  "u02-i01", "u02-i02", "u02-i14",
  "u04-i09", "u04-i16",
  "u05-i03", "u05-i07", "u05-i08", "u05-i09", "u05-i13",
  "u06-i15",
  "u07-i03", "u07-i07", "u07-i10",
  "u08-i05", "u08-i15", "u08-i16",
  "u09-i04",
  "u10-i01", "u10-i02", "u10-i03", "u10-i11",
];

/** Höchstens so viele Schreibaufgaben je Wiederholrunde und je Endstation (2.4). Weitere Karten ab Fach 3 kommen als „Sag es laut“. */
export const MAX_WRITE_TASKS_PER_ROUND = 6;

/** „Sag es laut“ (2.9, Punkt 5). Ist es falsch, kommen die Karten über der Grenze als „Erinnern“. */
export const SAY_TASK_ENABLED = true;

/** Nach der Endstation hat die Wiederholrunde höchstens so viele Karten (2.9, Punkt 8). */
export const REVIEW_ROUND_AFTER_FINAL = 20;

/** „Oft falsch“ im Spickzettel: höchstens so viele Karten, die mindestens so oft falsch waren (2.9, Punkt 6). */
export const OFTEN_WRONG = { maxCards: 10, minWrong: 2 } as const;

/** Punkte je Ereignis, ohne Abzug (5.3). */
export const POINTS = { correctAnswer: 10, dialogueDone: 20, missionDone: 50, unitDone: 100 } as const;

/** Ein Tag zählt für die Serie mit abgeschlossener Haltestelle oder mindestens so vielen wiederholten Karten (5.3). */
export const STREAK_MIN_REVIEWED_CARDS = 10;

/** Die Uhr der Lernzeit pausiert nach so vielen Sekunden ohne Eingabe (5.4). */
export const ACTIVE_TIME_IDLE_PAUSE_SECONDS = 60;

/** Annahme für Richtzeiten: Sekunden je Aufgabe (2.3). */
export const SECONDS_PER_TASK_ESTIMATE = 8;

/** Endstation: 30 Aufgaben, zuerst Karten in Fach 1 bis 3 (2.8). */
export const FINAL_REVIEW = { taskCount: 30, firstUpToBox: 3 as Box } as const;

/** Sprechtempo und Reihenfolge der Stimmenwahl (3). */
export const SPEECH = {
  rateNormal: 0.9,
  rateSlow: 0.6,
  languageOrder: ["es-ES", "es-MX", "es-US"],
} as const;

/** Name im Profil: Pflichtfeld, höchstens so viele Zeichen (2.1). */
export const NAME_MAX_LENGTH = 30;
