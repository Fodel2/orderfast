import { ChangeEvent } from "react";

import { tokens } from "../../../ui/tokens";

const CONTROL_HEIGHT = tokens.spacing.xl;
const LABEL_WIDTH = tokens.spacing.xl * 4;
const GAP = tokens.spacing.sm;
const PADDING_Y = tokens.spacing.xs;
const PADDING_X = tokens.spacing.sm;
const RADIUS = tokens.radius.sm;
const BORDER_WIDTH = tokens.border.thin;
const COLOR_SWATCH_WIDTH = tokens.spacing.xl;

export interface InputColorProps {
  id?: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  showTextInput?: boolean;
}

export function InputColor({
  id,
  label,
  value,
  disabled = false,
  onChange,
  showTextInput = true,
}: InputColorProps) {
  const inputId = id ?? `color-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="inspector-row">
      <label className="inspector-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="inspector-color-control">
        <input
          id={inputId}
          className="color-input"
          type="color"
          value={value}
          disabled={disabled}
          onChange={handleChange}
        />
        {showTextInput ? (
          <input
            aria-label={`${label} hex value`}
            className="color-text-input"
            type="text"
            value={value}
            disabled={disabled}
            onChange={handleChange}
          />
        ) : null}
      </div>

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

        .inspector-color-control {
          display: grid;
          grid-template-columns: ${COLOR_SWATCH_WIDTH}px 1fr;
          gap: ${tokens.spacing.xs}px;
          align-items: center;
        }

        .color-input {
          width: ${COLOR_SWATCH_WIDTH}px;
          height: ${CONTROL_HEIGHT}px;
          padding: 0;
          border-radius: ${RADIUS}px;
          border: ${BORDER_WIDTH}px solid rgba(15, 23, 42, 0.12);
          background: none;
        }

        .color-text-input {
          height: ${CONTROL_HEIGHT}px;
          border-radius: ${RADIUS}px;
          border: ${BORDER_WIDTH}px solid rgba(15, 23, 42, 0.12);
          padding: 0 ${tokens.spacing.sm}px;
          font-size: 0.875rem;
          color: #0f172a;
        }

        .color-input:disabled,
        .color-text-input:disabled {
          opacity: ${tokens.opacity[50]};
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .inspector-row {
            grid-template-columns: 1fr;
          }

          .inspector-color-control {
            grid-template-columns: ${COLOR_SWATCH_WIDTH}px 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default InputColor;
