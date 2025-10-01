import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { inspectorColors, inspectorLayout } from "../layout";
import { tokens } from "../../../ui/tokens";

const { labelWidth, controlHeight, numberWidth, gap, paddingX, paddingY, radius, borderWidth } =
  inspectorLayout;

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const formatDisplay = (
  value: number | undefined,
  fallbackValue: number | undefined,
  resolveFallback: () => number,
  formatValue?: (value: number | undefined, fallbackValue?: number) => string,
): string => {
  if (formatValue) {
    return formatValue(value, fallbackValue);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
  }
  if (typeof fallbackValue === "number" && Number.isFinite(fallbackValue)) {
    return `${fallbackValue}`;
  }
  return `${resolveFallback()}`;
};

export interface InputSliderProps {
  id?: string;
  label: string;
  value?: number;
  fallbackValue?: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
  formatValue?: (value: number | undefined, fallbackValue?: number) => string;
  showNumberInput?: boolean;
}

export function InputSlider({
  id,
  label,
  value,
  fallbackValue,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
  formatValue,
  showNumberInput = true,
}: InputSliderProps) {
  const inputId = id ?? `slider-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) ? max : safeMin + 100;

  const resolveFallback = useMemo(() => {
    return () => {
      if (typeof fallbackValue === "number" && Number.isFinite(fallbackValue)) {
        return clamp(fallbackValue, safeMin, safeMax);
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return clamp(value, safeMin, safeMax);
      }
      return safeMin;
    };
  }, [fallbackValue, safeMax, safeMin, value]);

  const sliderValue = useMemo(() => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return clamp(value, safeMin, safeMax);
    }
    return resolveFallback();
  }, [resolveFallback, safeMax, safeMin, value]);

  const [numberValue, setNumberValue] = useState<string>(() =>
    formatDisplay(value, fallbackValue, resolveFallback, formatValue),
  );

  useEffect(() => {
    setNumberValue(formatDisplay(value, fallbackValue, resolveFallback, formatValue));
  }, [fallbackValue, formatValue, resolveFallback, value]);

  const sliderFillPercent = useMemo(() => {
    if (safeMax === safeMin) {
      return 0;
    }
    const ratio = (sliderValue - safeMin) / (safeMax - safeMin);
    return Math.min(100, Math.max(0, ratio * 100));
  }, [safeMax, safeMin, sliderValue]);

  const sliderBackground = useMemo(
    () =>
      `linear-gradient(to right, var(--slider-active, #10b981) 0%, var(--slider-active, #10b981) ${sliderFillPercent}%, var(--slider-track, #e2e8f0) ${sliderFillPercent}%, var(--slider-track, #e2e8f0) 100%)`,
    [sliderFillPercent],
  );

  const handleRangeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = clamp(Number(event.target.value), safeMin, safeMax);
    setNumberValue(formatDisplay(nextValue, fallbackValue, resolveFallback, formatValue));
    onChange(nextValue);
  };

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setNumberValue(raw);
    if (raw.trim().length === 0) {
      onChange(undefined);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = clamp(parsed, safeMin, safeMax);
    onChange(clamped);
    if (clamped !== parsed) {
      setNumberValue(formatDisplay(clamped, fallbackValue, resolveFallback, formatValue));
    }
  };

  return (
    <div className="inspector-row">
      <label className="inspector-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="inspector-slider-wrapper">
        <input
          id={inputId}
          type="range"
          min={safeMin}
          max={safeMax}
          step={step}
          value={sliderValue}
          disabled={disabled}
          onChange={handleRangeChange}
          className="inspector-slider"
          style={{ background: sliderBackground }}
        />
        {showNumberInput ? (
          <input
            aria-label={`${label} value`}
            type="number"
            min={safeMin}
            max={safeMax}
            step={step}
            value={numberValue}
            disabled={disabled}
            onChange={handleNumberChange}
            className="inspector-number"
          />
        ) : null}
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
        }

        .inspector-slider-wrapper {
          display: grid;
          grid-template-columns: 1fr ${showNumberInput ? `${numberWidth}px` : "auto"};
          align-items: center;
          gap: ${gap}px;
        }

        .inspector-slider {
          width: 100%;
          height: ${controlHeight}px;
          border-radius: ${radius}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          appearance: none;
          background: ${sliderBackground};
          padding: 0 ${tokens.spacing.xs}px;
        }

        .inspector-slider:focus-visible {
          outline: 2px solid #10b981;
          outline-offset: 2px;
        }

        .inspector-slider::-webkit-slider-thumb {
          appearance: none;
          width: ${tokens.spacing.sm}px;
          height: ${tokens.spacing.sm}px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          border: 0;
          box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12);
        }

        .inspector-slider::-moz-range-thumb {
          width: ${tokens.spacing.sm}px;
          height: ${tokens.spacing.sm}px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          border: 0;
          box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12);
        }

        .inspector-number {
          width: 100%;
          max-width: ${numberWidth}px;
          height: ${controlHeight}px;
          border-radius: ${radius}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          padding: 0 ${tokens.spacing.sm}px;
          font-size: 0.875rem;
          color: ${inspectorColors.text};
          background-color: ${inspectorColors.background};
        }

        .inspector-number:disabled,
        .inspector-slider:disabled {
          opacity: ${tokens.opacity[50]};
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .inspector-row {
            grid-template-columns: 1fr;
          }

          .inspector-slider-wrapper {
            grid-template-columns: 1fr ${showNumberInput ? `${numberWidth}px` : "auto"};
          }
        }
      `}</style>
    </div>
  );
}

export default InputSlider;
