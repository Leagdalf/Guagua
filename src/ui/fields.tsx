import { useId, type ReactNode } from "react";
import { cx } from "./cx";

interface FieldBase {
  /** Beschriftung über dem Feld, im Stil der Großbuchstaben-Beschriftung. */
  label: ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Es wird Spanisch getippt: Newsreader kursiv 24 px (iPad 32 px), `lang="es"`, keine Autokorrektur. */
  spanish?: boolean;
  name?: string;
  disabled?: boolean;
  /** Kurzer Hinweis unter dem Feld, in ceniza. */
  help?: ReactNode;
  className?: string;
}

export interface TextFieldProps extends FieldBase {
  type?: "text" | "search";
  autoComplete?: string;
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
}

export interface TextAreaProps extends FieldBase {
  rows?: number;
}

/** Spanisch und Suche: keine Autokorrektur, sonst verbessert iOS fremde Wörter. Nur Spanisch trägt `lang="es"`. */
function typing(spanish: boolean | undefined, search = false) {
  if (spanish) return { lang: "es", autoCapitalize: "none", autoCorrect: "off", spellCheck: false } as const;
  if (search) return { autoCapitalize: "none", autoCorrect: "off", spellCheck: false } as const;
  return {} as const;
}

function Wrap({ id, label, help, className, children }: { id: string; label: ReactNode; help?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cx("field", className)}>
      <label className="label field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="field__help">
          {help}
        </p>
      )}
    </div>
  );
}

/** Einzeiliges Eingabefeld: Beschriftung darüber, Feld ohne Kasten mit Unterstrich, im Fokus dicker und in atlántico. */
export function TextField({
  label,
  value,
  defaultValue,
  onChange,
  placeholder,
  spanish,
  name,
  disabled,
  help,
  className,
  type = "text",
  autoComplete = "off",
  enterKeyHint,
}: TextFieldProps) {
  const id = useId();
  return (
    <Wrap id={id} label={label} help={help} className={className}>
      <input
        id={id}
        type={type}
        name={name}
        className={cx("field__input", spanish && "es field__input--es")}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        enterKeyHint={enterKeyHint}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(event) => onChange?.(event.target.value)}
        {...typing(spanish, type === "search")}
      />
    </Wrap>
  );
}

/** Mehrzeiliges Eingabefeld, sonst wie `TextField`. */
export function TextArea({
  label,
  value,
  defaultValue,
  onChange,
  placeholder,
  spanish,
  name,
  disabled,
  help,
  className,
  rows = 3,
}: TextAreaProps) {
  const id = useId();
  return (
    <Wrap id={id} label={label} help={help} className={className}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        className={cx("field__input", "field__input--area", spanish && "es field__input--es")}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(event) => onChange?.(event.target.value)}
        {...typing(spanish)}
      />
    </Wrap>
  );
}
