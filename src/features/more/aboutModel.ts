// Angaben für „Über die App“. Reine Daten und Funktionen, kein React.

import pkg from "../../../package.json";

/** Version aus package.json. */
export const APP_VERSION: string = pkg.version;

/** Stand der Lerninhalte (CLAUDE.md, Abschnitt Stand). */
export const CONTENT_DATE = "22.11.2026";

/** Satz aus docs/02-spezifikation.md, 2.7, wörtlich. */
export const AI_NOTE = "Code und Lerninhalte sind mit KI-Unterstützung entstanden. Fehler gefunden? Bitte melden, dann wird die Karte korrigiert.";

export const FONT_LICENSES: ReadonlyArray<{ name: string; license: string }> = [
  { name: "Newsreader", license: "SIL Open Font License 1.1" },
  { name: "Figtree", license: "SIL Open Font License 1.1" },
];
