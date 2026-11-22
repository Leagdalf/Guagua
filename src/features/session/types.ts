// Vertrag zwischen der App (AP5) und der Lerneinheit (AP4). Von der Hauptsitzung festgelegt; `final` kam mit der Endstation dazu.

/**
 * Was die Lerneinheit tun soll:
 * - "day": die Tageseinheit. Erst die Wiederholrunde, falls sie aussteht, dann die Haltestelle `unitId` ab ihrem
 *   gespeicherten Schritt. Mit `unitId: null` gibt es nur die Wiederholrunde.
 * - "extra": die freie Runde „10 Karten extra“, reine Übung.
 * - "final": die Endstation (Spezifikation 2.8): erst die Wiederholrunde, falls sie aussteht, dann 30 Aufgaben über alle Karten,
 *   danach die Ansicht „Deine Linie“. Ist die Endstation nicht offen, wird daraus eine Sitzung nur zum Wiederholen.
 */
export type SessionRequest = { kind: "day"; unitId: string | null } | { kind: "extra" } | { kind: "final" };

export interface SessionViewProps {
  request: SessionRequest;
  /** Zurück zur Linie: nach der Zusammenfassung oder über „Schließen“. Der Stand ist dann schon gespeichert. */
  onExit: () => void;
}
