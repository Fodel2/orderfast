import React, { useMemo, useRef } from "react";
import {
  INPUT_BASE_CLASS,
  mergeClassNames,
  wrapWithLabel,
} from "./inputShared";

const CHECKERBOARD_BACKGROUND =
  "linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)";

export interface InputColorProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "value"> {
  label?: React.ReactNode;
  labelClassName?: string;
  value: string;
  previewValue?: string;
  onChange: (value: string) => void;
  onColorInputChange?: (value: string) => void;
  colorInputProps?: Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "onChange" | "value"
  >;
  containerClassName?: string;
  swatchClassName?: string;
}

function formatColorOutput(value: string): string {
  const trimmed = value.trim();

  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (trimmed.startsWith("rgb") || trimmed.startsWith("hsl")) {
    return trimmed;
  }

  return trimmed.toUpperCase();
}

function extractFallbackFromVar(value: string): string {
  const match = value.match(/var\(\s*[^,]+,\s*([^)]+)\)/i);
  if (!match) return "";

  const fallback = match[1].trim();
  if (fallback.startsWith("var(")) {
    return extractFallbackFromVar(fallback);
  }

  return fallback;
}

export function getReadableColor(value?: string | null): string {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("var(")) {
    const fallback = extractFallbackFromVar(trimmed);
    if (!fallback) {
      return "";
    }
    return getReadableColor(fallback);
  }

  return formatColorOutput(trimmed);
}

function normalizeColorValue(value: string): string {
  if (typeof value !== "string") {
    return "#000000";
  }

  const formatted = formatColorOutput(value);

  if (/^#[0-9A-F]{6}$/i.test(formatted) || /^#[0-9A-F]{3}$/i.test(formatted)) {
    return formatted.toUpperCase();
  }

  const hexMatch = formatted.match(/[0-9A-F]{6}/i);
  if (hexMatch) {
    return `#${hexMatch[0].toUpperCase().slice(0, 6)}`;
  }

  return "#000000";
}

export const InputColor = React.forwardRef<HTMLInputElement, InputColorProps>(
  (
    {
      label,
      labelClassName,
      className,
      value,
      previewValue,
      onChange,
      onColorInputChange,
      disabled,
      colorInputProps,
      containerClassName,
      swatchClassName,
      placeholder = "#000000",
      ...textProps
    },
    ref,
  ) => {
    const colorInputRef = useRef<HTMLInputElement | null>(null);
    const readableColor = useMemo(() => getReadableColor(value), [value]);
    const normalizedHex = useMemo(
      () => normalizeColorValue(readableColor || value || ""),
      [readableColor, value],
    );
    const displayPreview = previewValue ?? value ?? readableColor ?? normalizedHex;
    const displayValue = readableColor || value || "";

    const input = (
      <div className={mergeClassNames("flex items-center gap-3", containerClassName)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => colorInputRef.current?.click()}
          className={mergeClassNames(
            "relative h-9 w-9 overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed",
            swatchClassName,
          )}
          aria-label="Choose color"
        >
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage: CHECKERBOARD_BACKGROUND,
              backgroundSize: "8px 8px",
              backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
            }}
          />
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: displayPreview || "transparent" }}
          />
        </button>
        <input
          {...colorInputProps}
          ref={colorInputRef}
          type="color"
          value={normalizedHex}
          onChange={(event) =>
            onColorInputChange
              ? onColorInputChange(event.target.value)
              : onChange(event.target.value)
          }
          disabled={disabled}
          className={mergeClassNames("sr-only", colorInputProps?.className)}
        />
        <input
          {...textProps}
          ref={ref}
          type="text"
          value={displayValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={mergeClassNames(
            INPUT_BASE_CLASS,
            "font-mono uppercase",
            className,
          )}
        />
      </div>
    );

    return wrapWithLabel(label, input, labelClassName);
  },
);

InputColor.displayName = "InputColor";
