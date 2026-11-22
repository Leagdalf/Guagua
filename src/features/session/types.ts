// Vertrag zwischen der App (AP5) und der Lerneinheit (AP4). Von der Hauptsitzung festgelegt, nicht ändern.

/**
 * Was die Lerneinheit tun soll:
 * - "day": die Tageseinheit. Erst die Wiederholrunde, falls sie aussteht, dann die Haltestelle `unitId` ab ihrem
 *   gespeicherten Schritt. Mit `unitId: null` gibt es nur die Wiederholrunde.
 * - "extra": die freie Runde „10 Karten extra“, reine Übung.
 */
export type SessionRequest = { kind: "day"; unitId: string | null } | { kind: "extra" };

export interface SessionViewProps {
  request: SessionRequest;
  /** Zurück zur Linie: nach der Zusammenfassung oder über „Schließen“. Der Stand ist dann schon gespeichert. */
  onExit: () => void;
}
