import { ChangeEvent } from "react";

import { tokens } from "../../../ui/tokens";

const CONTROL_HEIGHT = tokens.spacing.xl;
const LABEL_WIDTH = tokens.spacing.xl * 4;
const GAP = tokens.spacing.sm;
const PADDING_Y = tokens.spacing.xs;
const PADDING_X = tokens.spacing.sm;
const RADIUS = tokens.radius.sm;
const BORDER_WIDTH = tokens.border.thin;

export interface InputSelectOption {
  label: string;
  value: string;
}

export interface InputSelectProps {
  id?: string;
  label: string;
  value: string;
  options: InputSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function InputSelect({
  id,
  label,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: InputSelectProps) {
  const inputId = id ?? `select-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="inspector-row">
      <label className="inspector-label" htmlFor={inputId}>
        {label}
      </label>
      <select
        id={inputId}
        className="inspector-select"
        value={value}
        disabled={disabled}
        onChange={handleChange}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <style jsx>{`
        .inspector-row {
          display: grid;
          grid-template-columns: ${LABEL_WIDTH}px 1fr;
          align-items: center;
          gap: ${GAP}px;
          padding: ${PADDING_Y}px ${PADDING_X}px;
        }

        .inspector-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: #475569;
          line-height: 1.2;
        }

        .inspector-select {
          width: 100%;
          height: ${CONTROL_HEIGHT}px;
          border-radius: ${RADIUS}px;
          border: ${BORDER_WIDTH}px solid rgba(15, 23, 42, 0.12);
          padding: 0 ${tokens.spacing.sm}px;
          background-color: #ffffff;
          font-size: 0.875rem;
          color: #0f172a;
        }

        .inspector-select:disabled {
          opacity: ${tokens.opacity[50]};
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .inspector-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default InputSelect;
