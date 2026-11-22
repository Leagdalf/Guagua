import { compareImport, summaryRows } from "../../core/backup";
import type { ImportSummary } from "../../core/backup";
import { PrimaryButton, SummaryList, TextButton } from "../../ui";
import { SubPage } from "./SubPage";

export interface ImportConfirmProps {
  /** Der Stand, der kommen würde. */
  summary: ImportSummary;
  /** Der Stand, der ersetzt wird. `null`, wenn er nicht lesbar ist (Fehleransicht). */
  current: ImportSummary | null;
  /** `import` aus Datei oder Text, `backup` die letzte automatische Sicherung des Geräts. */
  kind?: "import" | "backup";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Rückfrage vor dem Import oder Zurückholen: stellt den aktuellen und den neuen Stand nebeneinander und warnt, wenn der neue
 * weniger Karten hat oder älter ist. Ändert nichts, bis „Jetzt …“ getippt wird.
 */
export function ImportConfirm({ summary, current, kind = "import", onConfirm, onCancel }: ImportConfirmProps) {
  const comparison = current ? compareImport(current, summary) : null;
  const backup = kind === "backup";
  return (
    <SubPage title={backup ? "Sicherung zurückholen?" : "Stand importieren?"} onBack={onCancel}>
      {comparison ? (
        <>
          <p className="page-lead">{backup ? "So unterscheiden sich dein Stand und die Sicherung:" : "So unterscheiden sich dein Stand und der Import:"}</p>
          {comparison.warnings.length > 0 && (
            <div className="more__msg more__msg--error" role="alert">
              <p>
                <strong>Achtung.</strong>
              </p>
              {comparison.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
          <table className="gtable compare">
            <caption className="vh">Dein Stand und {backup ? "die Sicherung" : "der Import"} im Vergleich</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="vh">Angabe</span>
                </th>
                <th scope="col">Dein Stand</th>
                <th scope="col">{backup ? "Sicherung" : "Import"}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.current}</td>
                  <td>{row.imported}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sec__text">
            Dein aktueller Stand von {current?.name} wird ersetzt. Vorher legt die App auf diesem Gerät eine Sicherung davon an, und du kannst
            sie auf der Seite „Fortschritt sichern“ zurückholen. Wenn die Sicherung scheitert, ändert sich nichts.
          </p>
        </>
      ) : (
        <>
          <p className="page-lead">Das würde importiert:</p>
          <SummaryList className="sec__text" items={summaryRows(summary)} />
          <p className="sec__text">
            Dein gespeicherter Stand ist nicht lesbar. Die App legt vorher eine Sicherung des unlesbaren Textes an. Wenn das scheitert,
            wird nichts importiert.
          </p>
        </>
      )}
      <div className="more__actions">
        <PrimaryButton onClick={onConfirm}>{backup ? "Jetzt zurückholen" : "Jetzt importieren"}</PrimaryButton>
        <TextButton onClick={onCancel}>Abbrechen</TextButton>
      </div>
    </SubPage>
  );
}
