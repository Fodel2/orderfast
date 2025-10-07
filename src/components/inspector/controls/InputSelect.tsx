import { ChangeEvent } from "react";

import { inspectorColors, inspectorLayout } from "../layout";
import { tokens } from "../../../ui/tokens";

const SELECT_ICON_SIZE = tokens.spacing.sm * 1.5;
const SELECT_PADDING_RIGHT = tokens.spacing.sm + SELECT_ICON_SIZE;
const ACCENT_COLOR = `var(--inspector-accent, ${tokens.colors.accent})`;
const FOCUS_RING_COLOR = `var(--inspector-focus-ring, ${tokens.colors.focusRing})`;
const HOVER_BORDER_COLOR = `var(--inspector-border-hover, ${tokens.colors.neutral[400]})`;
const ICON_COLOR = `var(--inspector-select-icon, ${tokens.colors.neutral[500]})`;
const ICON_DISABLED_COLOR = `var(--inspector-select-icon-disabled, ${tokens.colors.neutral[400]})`;

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
      <div className="inspector-select-wrapper">
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
        <span className="inspector-select-icon" aria-hidden="true">
          <svg width={SELECT_ICON_SIZE} height={SELECT_ICON_SIZE} viewBox="0 0 12 12" fill="none">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

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

        .inspector-select-wrapper {
          position: relative;
          width: 100%;
        }

        .inspector-select {
          width: 100%;
          height: ${controlHeight}px;
          border-radius: ${radius}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          padding: 0 ${SELECT_PADDING_RIGHT}px 0 ${tokens.spacing.sm}px;
          background-color: ${inspectorColors.background};
          font-size: 0.875rem;
          color: ${inspectorColors.text};
          appearance: none;
          -webkit-appearance: none;
          line-height: 1.2;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .inspector-select:hover:not(:disabled) {
          border-color: ${HOVER_BORDER_COLOR};
        }

        .inspector-select:focus-visible {
          outline: ${tokens.border.thick}px solid ${FOCUS_RING_COLOR};
          outline-offset: 2px;
          border-color: ${ACCENT_COLOR};
        }

        .inspector-select-icon {
          position: absolute;
          top: 50%;
          right: ${tokens.spacing.sm}px;
          transform: translateY(-50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: ${SELECT_ICON_SIZE}px;
          height: ${SELECT_ICON_SIZE}px;
          color: ${ICON_COLOR};
          pointer-events: none;
          transition: color 0.15s ease;
        }

        .inspector-select:hover:not(:disabled) ~ .inspector-select-icon,
        .inspector-select:focus-visible ~ .inspector-select-icon {
          color: ${ACCENT_COLOR};
        }

        .inspector-select:disabled ~ .inspector-select-icon {
          color: ${ICON_DISABLED_COLOR};
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
