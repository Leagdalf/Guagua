import { cx } from "./cx";
import { TextButton } from "./buttons";

export interface NoticeProps {
  text: string;
  /** Beschriftung des Knopfes, zum Beispiel „Neu laden“. Ohne Angabe gibt es keinen Knopf. */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** Hinweisleiste in plátano mit Text in tinta und optionalem Knopf, zum Beispiel „Neue Version bereit“. */
export function Notice({ text, actionLabel, onAction, className }: NoticeProps) {
  return (
    <div role="status" className={cx("notice", className)}>
      <p>{text}</p>
      {actionLabel && <TextButton onClick={onAction}>{actionLabel}</TextButton>}
    </div>
  );
}
