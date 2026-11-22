// Vertrag zwischen der App (AP5) und der Lerneinheit (AP4). Von der Hauptsitzung festgelegt; `final` kam mit der Endstation dazu.

/**
 * Was die Lerneinheit tun soll:
 * - "day": die Tageseinheit. Erst die Wiederholrunde, falls sie aussteht, dann die Haltestelle `unitId` ab ihrem
 *   gespeicherten Schritt. Mit `unitId: null` gibt es nur die Wiederholrunde.
 * - "extra": die freie Runde „10 Karten extra“, reine Übung.
 * - "final": die Endstation (Spezifikation 2.8): erst die Wiederholrunde, falls sie aussteht, dann 30 Aufgaben über alle Karten,
 *   danach die Ansicht „Deine Linie“. Ist die Endstation nicht offen, wird daraus eine Sitzung nur zum Wiederholen.
 * - "dialogue": Dialog einer abgeschlossenen Haltestelle noch einmal spielen (Spezifikation 2.9, Punkt 10): Fahrplan mit einer Zeile,
 *   Anhören, Rollenspiel. Ohne Punkte und ohne jede Änderung am Lernstand außer der Lernzeit. Ist die Haltestelle nicht
 *   abgeschlossen, endet die Sitzung sofort mit einem sachlichen Satz.
 */
export type SessionRequest =
  | { kind: "day"; unitId: string | null }
  | { kind: "extra" }
  | { kind: "final" }
  | { kind: "dialogue"; unitId: string };

export interface SessionViewProps {
  request: SessionRequest;
  /** Zurück zur Linie: nach der Zusammenfassung oder über „Schließen“. Der Stand ist dann schon gespeichert. */
  onExit: () => void;
}
