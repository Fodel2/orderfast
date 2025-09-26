import React, { useCallback, useEffect, useMemo, useState } from "react";
import { InputNumber } from "./InputNumber";
import { INPUT_BASE_CLASS, mergeClassNames, wrapWithLabel } from "./inputShared";

export interface InputSliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> {
  label?: React.ReactNode;
  labelClassName?: string;
  containerClassName?: string;
  sliderClassName?: string;
  numberInputClassName?: string;
  /**
   * The value to display in both the slider and number input. When undefined,
   * the slider falls back to `fallbackValue` (or the provided `min`/`0`).
   */
  value?: number;
  /**
   * Fallback value to use when `value` is undefined.
   */
  fallbackValue?: number;
  /**
   * Optional formatter for the number input display value.
   */
  formatValue?: (
    value: number | undefined,
    fallbackValue?: number,
  ) => string;
  /**
   * Invoked whenever the slider or number input produce a new value.
   */
  onValueChange?: (value: number | undefined) => void;
  /**
   * Additional props for the number input element.
   */
  numberInputProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange">;
}

const SLIDER_BASE_CLASS =
  "relative h-6 min-h-[24px] w-full min-w-[120px] flex-1 cursor-pointer appearance-none rounded-full bg-transparent accent-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-slider-runnable-track]:h-[6px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:border-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-[14px] [&::-webkit-slider-thumb]:w-[14px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[color:var(--slider-active,_#10b981)] [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:mt-[-4px] [&::-moz-range-track]:h-[6px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-[14px] [&::-moz-range-thumb]:w-[14px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[color:var(--slider-active,_#10b981)] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow [&::-moz-range-progress]:bg-[color:var(--slider-active,_#10b981)] [&::-moz-range-progress]:h-[6px] [&::-moz-range-progress]:rounded-full";

const NUMBER_BASE_CLASS = mergeClassNames(
  INPUT_BASE_CLASS,
  "w-[60px] max-w-[60px] shrink-0 text-right",
);

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

export const InputSlider = React.forwardRef<HTMLInputElement, InputSliderProps>(
  (
    {
      label,
      labelClassName,
      containerClassName,
      sliderClassName,
      numberInputClassName,
      value,
      fallbackValue,
      formatValue,
      onValueChange,
      numberInputProps,
      min: rawMin = 0,
      max: rawMax = 100,
      step = 1,
      disabled = false,
      className,
      style: sliderInlineStyle,
      ...sliderProps
    },
    ref,
  ) => {
    const min = Number.isFinite(rawMin) ? Number(rawMin) : 0;
    const max = Number.isFinite(rawMax) ? Number(rawMax) : min + 100;

    const resolveFallback = useCallback((): number => {
      if (typeof fallbackValue === "number" && Number.isFinite(fallbackValue)) {
        return clamp(fallbackValue, min, max);
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return clamp(value, min, max);
      }
      if (Number.isFinite(min)) return min;
      return 0;
    }, [fallbackValue, max, min, value]);

    const formatDisplay = useCallback(
      (current: number | undefined): string => {
        if (formatValue) {
          return formatValue(current, fallbackValue);
        }
        const base =
          typeof current === "number" && Number.isFinite(current)
            ? current
            : typeof fallbackValue === "number" && Number.isFinite(fallbackValue)
              ? fallbackValue
              : resolveFallback();
        return `${base}`;
      },
      [fallbackValue, formatValue, resolveFallback],
    );

    const sliderValue = useMemo(() => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return clamp(value, min, max);
      }
      return resolveFallback();
    }, [max, min, resolveFallback, value]);

    const [inputValue, setInputValue] = useState<string>(() => formatDisplay(value));

    const sliderFillPercent = useMemo(() => {
      if (max === min) {
        return 0;
      }
      const ratio = (sliderValue - min) / (max - min);
      return Math.min(100, Math.max(0, ratio * 100));
    }, [max, min, sliderValue]);

    const sliderStyle = useMemo<React.CSSProperties>(
      () => ({
        "--slider-active": "#10b981",
        "--slider-track": "#e5e7eb",
        background: `linear-gradient(to right, var(--slider-active) 0%, var(--slider-active) ${sliderFillPercent}%, var(--slider-track) ${sliderFillPercent}%, var(--slider-track) 100%)`,
      }),
      [sliderFillPercent],
    );

    useEffect(() => {
      setInputValue(formatDisplay(value));
    }, [formatDisplay, value]);

    const handleSliderChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const numericValue = Number(event.target.value);
        const clamped = clamp(numericValue, min, max);
        setInputValue(formatDisplay(clamped));
        onValueChange?.(clamped);
      },
      [formatDisplay, max, min, onValueChange],
    );

    const handleNumberChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value;
        setInputValue(raw);
        if (raw.trim().length === 0) {
          onValueChange?.(undefined);
          return;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
          return;
        }
        const clamped = clamp(parsed, min, max);
        onValueChange?.(clamped);
        if (clamped !== parsed) {
          setInputValue(formatDisplay(clamped));
        }
      },
      [formatDisplay, max, min, onValueChange],
    );

    const input = (
      <div className={mergeClassNames("flex items-center gap-2", containerClassName)}>
        <input
          {...sliderProps}
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={sliderValue}
          onChange={handleSliderChange}
          disabled={disabled}
          className={mergeClassNames(SLIDER_BASE_CLASS, className, sliderClassName)}
          style={{ ...sliderInlineStyle, ...sliderStyle }}
        />
        <InputNumber
          {...numberInputProps}
          min={min}
          max={max}
          step={step}
          value={inputValue}
          onChange={handleNumberChange}
          disabled={disabled}
          className={mergeClassNames(NUMBER_BASE_CLASS, numberInputClassName)}
        />
      </div>
    );

    return wrapWithLabel(label, input, labelClassName);
  },
);

InputSlider.displayName = "InputSlider";
