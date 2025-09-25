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

function normalizeColorValue(value: string): string {
  if (typeof value !== "string") {
    return "#000000";
  }

  if (value.startsWith("#") && (value.length === 7 || value.length === 4)) {
    return value;
  }

  const hexMatch = value.match(/[0-9a-fA-F]{6}/);
  if (hexMatch) {
    return `#${hexMatch[0].slice(0, 6)}`;
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
    const normalizedHex = useMemo(() => normalizeColorValue(value), [value]);
    const displayPreview = previewValue ?? value ?? normalizedHex;

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
          value={value}
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
