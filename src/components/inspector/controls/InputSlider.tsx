import { ChangeEvent } from "react";

import { tokens } from "../../../ui/tokens";

const CONTROL_HEIGHT = tokens.spacing.xl;
const LABEL_WIDTH = tokens.spacing.xl * 4;
const NUMBER_WIDTH = tokens.spacing.xl * 2;
const GAP = tokens.spacing.sm;
const PADDING_Y = tokens.spacing.xs;
const PADDING_X = tokens.spacing.sm;
const RADIUS = tokens.radius.sm;
const BORDER_WIDTH = tokens.border.thin;

export interface InputSliderProps {
  id?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  showNumberInput?: boolean;
}

export function InputSlider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
  showNumberInput = true,
}: InputSliderProps) {
  const inputId = id ?? `slider-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const gridTemplateColumns = showNumberInput
    ? `${LABEL_WIDTH}px 1fr ${NUMBER_WIDTH}px`
    : `${LABEL_WIDTH}px 1fr`;

  const handleRangeChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };

  return (
    <div className="inspector-row">
      <label className="inspector-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="inspector-control"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={handleRangeChange}
      />
      {showNumberInput ? (
        <input
          aria-label={`${label} value`}
          className="inspector-number"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleNumberChange}
        />
      ) : null}

      <style jsx>{`
        .inspector-row {
          display: grid;
          grid-template-columns: ${gridTemplateColumns};
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

        .inspector-control {
          width: 100%;
          height: ${CONTROL_HEIGHT}px;
          border-radius: ${RADIUS}px;
          border: ${BORDER_WIDTH}px solid rgba(15, 23, 42, 0.12);
          padding: 0 ${tokens.spacing.sm}px;
          background-color: transparent;
        }

        .inspector-number {
          width: 100%;
          max-width: ${NUMBER_WIDTH}px;
          height: ${CONTROL_HEIGHT}px;
          border-radius: ${RADIUS}px;
          border: ${BORDER_WIDTH}px solid rgba(15, 23, 42, 0.12);
          padding: 0 ${tokens.spacing.sm}px;
          font-size: 0.875rem;
          color: #0f172a;
        }

        .inspector-number:disabled,
        .inspector-control:disabled {
          opacity: ${tokens.opacity[50]};
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .inspector-row {
            grid-template-columns: 1fr;
          }

          .inspector-label {
            width: 100%;
          }

          .inspector-number {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default InputSlider;
