import { ChangeEvent } from "react";

import { inspectorColors, inspectorLayout } from "../layout";
import { tokens } from "../../../ui/tokens";

const { labelWidth, controlHeight, gap, paddingX, paddingY, radius, borderWidth, mobileBreakpoint } =
  inspectorLayout;

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
          grid-template-columns: ${labelWidth}px 1fr;
          align-items: center;
          gap: ${gap}px;
          padding: ${paddingY}px ${paddingX}px;
        }

        .inspector-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: ${inspectorColors.label};
          line-height: 1.2;
          display: flex;
          align-items: center;
          min-height: ${controlHeight}px;
        }

        .inspector-select {
          width: 100%;
          height: ${controlHeight}px;
          border-radius: ${radius}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          padding: 0 ${tokens.spacing.sm}px;
          background-color: ${inspectorColors.background};
          font-size: 0.875rem;
          color: ${inspectorColors.text};
        }

        .inspector-select:disabled {
          opacity: ${tokens.opacity[50]};
          cursor: not-allowed;
        }

        @media (max-width: ${mobileBreakpoint}px) {
          .inspector-row {
            grid-template-columns: 1fr;
            align-items: stretch;
            row-gap: ${gap}px;
          }

          .inspector-label {
            min-height: auto;
          }
        }
      `}</style>
    </div>
  );
}

export default InputSelect;
