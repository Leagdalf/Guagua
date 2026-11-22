import { useId, type ReactNode } from "react";
import { CheckIcon, Label } from "../../ui";
import "./choice.css";

export interface ChoiceOption {
  id: string;
  label: ReactNode;
  /** Nebentext in ceniza hinter dem Namen. */
  detail?: string;
}

export interface ChoiceGroupProps {
  /** Beschriftung über der Gruppe. */
  label: string;
  options: readonly ChoiceOption[];
  /** id der gewählten Option oder `null`. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** Ein zweites Tippen auf die gewählte Option nimmt die Wahl zurück (für freiwillige Fragen). */
  allowClear?: boolean;
  className?: string;
}

/**
 * Auswahl aus wenigen Zeilen: gestapelt mit Haarlinien, links ein Auswahlkreis, gewählt mit Haken in atlántico
 * und Schnitt 600. Zustand über `aria-pressed`, nicht nur über Farbe. Eigener Baustein, weil `AnswerRow` richtig und falsch zeigt.
 */
export function ChoiceGroup({ label, options, value, onChange, allowClear, className }: ChoiceGroupProps) {
  const labelId = useId();
  return (
    <div className={className} role="group" aria-labelledby={labelId}>
      <Label id={labelId}>{label}</Label>
      <div className="choice">
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              className="choice__row"
              aria-pressed={selected}
              onClick={() => onChange(selected && allowClear ? null : option.id)}
            >
              <span className="choice__mark" aria-hidden="true">
                {selected && <CheckIcon />}
              </span>
              <span className="choice__text">
                {option.label}
                {option.detail && <span className="choice__detail"> · {option.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
