import { ChangeEvent, useMemo, useRef } from "react";

import { inspectorColors, inspectorLayout } from "../layout";
import { tokens } from "../../../ui/tokens";

const {
  labelWidth,
  controlHeight,
  gap,
  paddingX,
  paddingY,
  radius,
  borderWidth,
  mobileBreakpoint,
} = inspectorLayout;

const CHECKERBOARD_BACKGROUND =
  "linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)";

function normalizeHex(value: string): string {
  if (typeof value !== "string") {
    return "#000000";
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 6) {
      return `#${hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex}`;
    }
    if (hex.length === 8) {
      return `#${hex.slice(0, 6)}`;
    }
  }

  const rgbaMatch = trimmed.match(/rgba?\(([^)]+)\)/i);
  if (rgbaMatch) {
    const channels = rgbaMatch[1]
      .split(",")
      .slice(0, 3)
      .map((part) => Number.parseInt(part.trim(), 10));
    if (channels.length === 3 && channels.every((channel) => Number.isFinite(channel))) {
      const toHex = (channel: number) => {
        const clamped = Math.max(0, Math.min(255, channel));
        return clamped.toString(16).padStart(2, "0");
      };
      return `#${toHex(channels[0]!)}${toHex(channels[1]!)}${toHex(channels[2]!)}`;
    }
  }

  const hexMatch = trimmed.match(/[0-9a-fA-F]{6}/);
  if (hexMatch) {
    return `#${hexMatch[0]!.slice(0, 6)}`;
  }

  return "#000000";
}

export interface InputColorProps {
  id?: string;
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function InputColor({
  id,
  label,
  value,
  disabled = false,
  placeholder = "#000000",
  onChange,
}: InputColorProps) {
  const inputId = id ?? `color-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedHex = useMemo(() => normalizeHex(value), [value]);
  const preview = value?.trim().length ? value : normalizedHex;

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="inspector-row">
      <label className="inspector-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="inspector-color-control">
        <button
          type="button"
          className="color-swatch"
          onClick={() => colorInputRef.current?.click()}
          disabled={disabled}
          aria-label={`Choose ${label}`}
        >
          <span aria-hidden className="swatch-checker" />
          <span aria-hidden className="swatch-fill" style={{ background: preview }} />
        </button>
        <input
          ref={colorInputRef}
          id={inputId}
          type="color"
          className="sr-only"
          value={normalizedHex}
          onChange={handleColorChange}
          disabled={disabled}
        />
        <input
          aria-label={`${label} value`}
          type="text"
          value={value}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder={placeholder}
          className="color-text-input"
        />
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

        .inspector-color-control {
          display: grid;
          grid-template-columns: ${controlHeight}px 1fr;
          align-items: center;
          gap: ${gap}px;
        }

        .color-swatch {
          position: relative;
          width: ${controlHeight}px;
          height: ${controlHeight}px;
          border-radius: ${radius}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          background: ${inspectorColors.background};
          overflow: hidden;
          padding: 0;
        }

        .color-swatch:disabled {
          opacity: ${tokens.opacity[50]};
          cursor: not-allowed;
        }

        .swatch-checker {
          position: absolute;
          inset: 0;
          background-image: ${CHECKERBOARD_BACKGROUND};
          background-size: 8px 8px;
          background-position: 0 0, 0 4px, 4px -4px, -4px 0;
        }

        .swatch-fill {
          position: absolute;
          inset: 0;
        }

        .color-text-input {
          width: 100%;
          height: ${controlHeight}px;
          border-radius: ${radius}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          padding: 0 ${tokens.spacing.sm}px;
          font-size: 0.875rem;
          color: ${inspectorColors.text};
          background-color: ${inspectorColors.background};
          font-family: "JetBrains Mono", "Fira Code", monospace;
          text-transform: uppercase;
        }

        .color-text-input:disabled {
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

          .inspector-color-control {
            grid-template-columns: ${controlHeight}px 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default InputColor;
