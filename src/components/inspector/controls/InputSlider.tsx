import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

import { inspectorColors, inspectorLayout } from "../layout";
import { tokens } from "../../../ui/tokens";

const {
  labelWidth,
  controlHeight,
  numberWidth,
  gap,
  paddingX,
  paddingY,
  radius,
  borderWidth,
  mobileBreakpoint,
} = inspectorLayout;
const SLIDER_ACTIVE_COLOR = `var(--slider-active, ${tokens.colors.accent})`;
const SLIDER_TRACK_COLOR = `var(--slider-track, ${tokens.colors.neutral[200]})`;
const SLIDER_THUMB_COLOR = `var(--slider-thumb, ${tokens.colors.accent})`;
const SLIDER_THUMB_ACTIVE_COLOR = `var(--slider-thumb-active, ${tokens.colors.accentStrong})`;
const SLIDER_THUMB_SHADOW = `var(--slider-thumb-shadow, ${tokens.colors.borderStrong})`;
const SLIDER_FOCUS_RING = `var(--slider-focus-ring, ${tokens.colors.focusRing})`;
const SLIDER_HOVER_BORDER = `var(--slider-hover-border, ${tokens.colors.neutral[400]})`;
const NUMBER_FOCUS_RING = `var(--number-focus-ring, ${tokens.colors.focusRing})`;
const SLIDER_TRACK_HEIGHT = tokens.spacing.xs;

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const formatDisplay = (
  value: number | undefined,
  fallbackValue: number,
  formatter?: (value: number | undefined, fallbackValue: number) => string,
): string => {
  if (formatter) {
    return formatter(value, fallbackValue);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
  }
  return `${fallbackValue}`;
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
  formatValue?: (value: number | undefined, fallbackValue: number) => string;
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

  const fallback = useMemo(() => {
    if (typeof fallbackValue === "number" && Number.isFinite(fallbackValue)) {
      return clamp(fallbackValue, safeMin, safeMax);
    }
    return safeMin;
  }, [fallbackValue, safeMax, safeMin]);

  const effectiveValue = useMemo(() => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return clamp(value, safeMin, safeMax);
    }
    return fallback;
  }, [fallback, safeMax, safeMin, value]);

  const formatValueForDisplay = useCallback(
    (nextValue: number | undefined) =>
      formatDisplay(nextValue, fallbackValue ?? fallback, formatValue),
    [fallback, fallbackValue, formatValue],
  );

  const [rangeValue, setRangeValue] = useState<number>(effectiveValue);
  const [numberValue, setNumberValue] = useState<string>(() => formatValueForDisplay(value));

  useEffect(() => {
    setRangeValue(effectiveValue);
    setNumberValue(formatValueForDisplay(value));
  }, [effectiveValue, formatValueForDisplay, value]);

  const sliderFillPercent = useMemo(() => {
    if (safeMax === safeMin) {
      return 0;
    }
    const ratio = (rangeValue - safeMin) / (safeMax - safeMin);
    return Math.min(100, Math.max(0, ratio * 100));
  }, [rangeValue, safeMax, safeMin]);

  const sliderBackground = useMemo(
    () =>
      `linear-gradient(to right, ${SLIDER_ACTIVE_COLOR} 0%, ${SLIDER_ACTIVE_COLOR} ${sliderFillPercent}%, ${SLIDER_TRACK_COLOR} ${sliderFillPercent}%, ${SLIDER_TRACK_COLOR} 100%)`,
    [sliderFillPercent],
  );

  const handleRangeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = clamp(Number(event.target.value), safeMin, safeMax);
    setRangeValue(nextValue);
    setNumberValue(formatValueForDisplay(nextValue));
    onChange(nextValue);
  };

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setNumberValue(raw);
    if (raw.trim().length === 0) {
      setRangeValue(fallback);
      onChange(undefined);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = clamp(parsed, safeMin, safeMax);
    setRangeValue(clamped);
    onChange(clamped);
    if (clamped !== parsed) {
      setNumberValue(formatValueForDisplay(clamped));
    }
  };

  return (
    <div className={`inspector-row${showNumberInput ? " has-number" : ""}`}>
      <label className="inspector-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="inspector-slider-cell">
        <input
          id={inputId}
          type="range"
          min={safeMin}
          max={safeMax}
          step={step}
          value={rangeValue}
          disabled={disabled}
          onChange={handleRangeChange}
          className="inspector-slider"
          style={{ background: sliderBackground }}
        />
      </div>
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

        .inspector-row.has-number {
          grid-template-columns: ${labelWidth}px 1fr ${numberWidth}px;
        }

        .inspector-slider-cell {
          display: flex;
          align-items: center;
        }

        .inspector-slider {
          width: 100%;
          height: ${controlHeight}px;
          border-radius: ${radius}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          appearance: none;
          background: ${sliderBackground};
          padding: 0;
          cursor: pointer;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .inspector-slider:hover:not(:disabled) {
          border-color: ${SLIDER_HOVER_BORDER};
        }

        .inspector-slider:focus-visible {
          outline: ${tokens.border.thick}px solid ${SLIDER_FOCUS_RING};
          outline-offset: 2px;
          border-color: ${SLIDER_FOCUS_RING};
        }

        .inspector-slider::-webkit-slider-thumb {
          appearance: none;
          width: ${tokens.spacing.md}px;
          height: ${tokens.spacing.md}px;
          border-radius: 50%;
          background: ${SLIDER_THUMB_COLOR};
          cursor: pointer;
          border: 0;
          box-shadow: 0 0 0 1px ${SLIDER_THUMB_SHADOW};
          margin-top: calc((${SLIDER_TRACK_HEIGHT}px - ${tokens.spacing.md}px) / 2);
          transition: background-color 0.15s ease, box-shadow 0.15s ease;
        }

        .inspector-slider::-moz-range-thumb {
          width: ${tokens.spacing.md}px;
          height: ${tokens.spacing.md}px;
          border-radius: 50%;
          background: ${SLIDER_THUMB_COLOR};
          cursor: pointer;
          border: 0;
          box-shadow: 0 0 0 1px ${SLIDER_THUMB_SHADOW};
          margin-top: calc((${SLIDER_TRACK_HEIGHT}px - ${tokens.spacing.md}px) / 2);
          transition: background-color 0.15s ease, box-shadow 0.15s ease;
        }

        .inspector-slider::-webkit-slider-thumb:hover,
        .inspector-slider::-moz-range-thumb:hover {
          background: ${SLIDER_THUMB_ACTIVE_COLOR};
        }

        .inspector-slider::-webkit-slider-thumb:active,
        .inspector-slider::-moz-range-thumb:active {
          background: ${SLIDER_THUMB_ACTIVE_COLOR};
          box-shadow: 0 0 0 1px ${SLIDER_THUMB_SHADOW}, 0 0 0 6px ${tokens.colors.surfaceActive};
        }

        .inspector-slider::-webkit-slider-runnable-track {
          height: ${SLIDER_TRACK_HEIGHT}px;
          border-radius: ${radius}px;
          background: transparent;
        }

        .inspector-slider::-moz-range-track {
          height: ${SLIDER_TRACK_HEIGHT}px;
          border-radius: ${radius}px;
          background: transparent;
        }

        .inspector-slider::-moz-range-progress {
          height: ${SLIDER_TRACK_HEIGHT}px;
          border-radius: ${radius}px;
          background: ${SLIDER_ACTIVE_COLOR};
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
          text-align: right;
          font-feature-settings: "tnum" 1;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .inspector-number:hover:not(:disabled) {
          border-color: ${SLIDER_HOVER_BORDER};
        }

        .inspector-number:focus-visible {
          outline: ${tokens.border.thick}px solid ${NUMBER_FOCUS_RING};
          outline-offset: 2px;
          border-color: ${NUMBER_FOCUS_RING};
        }

        .inspector-number:disabled,
        .inspector-slider:disabled {
          opacity: ${tokens.opacity[50]};
          cursor: not-allowed;
        }

        .inspector-number::-webkit-outer-spin-button,
        .inspector-number::-webkit-inner-spin-button {
          margin: 0;
          -webkit-appearance: none;
        }

        .inspector-number {
          appearance: textfield;
        }

        @media (max-width: ${mobileBreakpoint}px) {
          .inspector-row {
            grid-template-columns: 1fr;
            align-items: stretch;
          }

          .inspector-label {
            min-height: auto;
          }

          .inspector-row.has-number {
            grid-template-columns: 1fr;
          }

          .inspector-slider {
            height: ${controlHeight}px;
          }

          .inspector-number {
            justify-self: end;
            width: ${numberWidth}px;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}

export default InputSlider;
