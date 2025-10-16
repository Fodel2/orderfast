import {
  ChangeEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

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

const PRESET_SWATCHES = [
  "#ffffff",
  "#f8fafc",
  "#f1f5f9",
  "#e2e8f0",
  "#cbd5f5",
  "#94a3b8",
  "#0f172a",
  "#1e293b",
  "#334155",
  "#2563eb",
  "#1d4ed8",
  "#0ea5e9",
  "#22c55e",
  "#16a34a",
  "#f97316",
  "#ea580c",
  "#facc15",
  "#f59e0b",
  "#ef4444",
  "#dc2626",
];

const POPOVER_WIDTH = 264;
const POPOVER_ESTIMATED_HEIGHT = 320;
const POPOVER_MARGIN = 12;
const POPOVER_MAX_HEIGHT_RATIO = 0.7;

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
  onColorInputChange?: (value: string) => void;
}

export function InputColor({
  id,
  label,
  value,
  disabled = false,
  placeholder = "#000000",
  onChange,
  onColorInputChange,
}: InputColorProps) {
  const inputId = id ?? `color-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const swatchRef = useRef<HTMLButtonElement | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);

  const normalizedHex = useMemo(() => normalizeHex(draftValue), [draftValue]);
  const preview = draftValue?.trim().length ? draftValue : normalizedHex;

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setDraftValue(next);
    onChange(next);
  };

  const handleSelect = useCallback(
    (next: string) => {
      setDraftValue(next);
      if (onColorInputChange) {
        onColorInputChange(next);
      } else {
        onChange(next);
      }
    },
    [onChange, onColorInputChange],
  );

  const togglePopover = useCallback(() => {
    if (disabled) return;
    setIsPopoverOpen((current) => !current);
  }, [disabled]);

  const closePopover = useCallback(() => {
    setIsPopoverOpen(false);
  }, []);

  return (
    <div className="inspector-row">
      <label className="inspector-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="inspector-color-control">
        <button
          type="button"
          className="color-swatch"
          ref={swatchRef}
          onClick={togglePopover}
          disabled={disabled}
          aria-label={`Choose ${label}`}
        >
          <span aria-hidden className="swatch-checker" />
          <span aria-hidden className="swatch-fill" style={{ background: preview }} />
        </button>
        <input
          id={inputId}
          aria-label={`${label} value`}
          type="text"
          value={draftValue}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder={placeholder}
          className="color-text-input"
        />
      </div>

      <ColorPickerPopover
        anchorRef={swatchRef}
        open={isPopoverOpen}
        value={normalizedHex}
        displayValue={draftValue}
        onClose={closePopover}
        onSelect={handleSelect}
      />

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

type ColorPickerPopoverProps = {
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  value: string;
  displayValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

function ColorPickerPopover({
  anchorRef,
  open,
  value,
  displayValue,
  onSelect,
  onClose,
}: ColorPickerPopoverProps) {
  const portalRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!open) return;

    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const measuredHeight = popoverRef.current?.offsetHeight ?? 0;
    const availableHeight = window.innerHeight * POPOVER_MAX_HEIGHT_RATIO;
    const height = measuredHeight
      ? Math.min(measuredHeight, availableHeight)
      : Math.min(POPOVER_ESTIMATED_HEIGHT, availableHeight);
    const margin = POPOVER_MARGIN;
    const preferredTop = rect.bottom + margin;
    let top = preferredTop;
    if (preferredTop + height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - height - margin);
    }

    const width = POPOVER_WIDTH;
    const centerLeft = rect.left + rect.width / 2 - width / 2;
    const clampedLeft = Math.max(margin, Math.min(centerLeft, window.innerWidth - width - margin));

    setPosition({ top, left: clampedLeft });
  }, [anchorRef, open]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const portalNode = document.createElement("div");
    portalNode.className = "color-picker-portal";
    document.body.appendChild(portalNode);
    portalRef.current = portalNode;
    setMounted(true);
    return () => {
      if (portalRef.current && portalRef.current.parentNode) {
        portalRef.current.parentNode.removeChild(portalRef.current);
      }
      portalRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    if (!popoverRef.current) return undefined;

    const frame = requestAnimationFrame(() => {
      updatePosition();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [displayValue, open, updatePosition, value]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted || !portalRef.current || !position) {
    return null;
  }

  return createPortal(
    <>
      <div className="color-picker-overlay" onClick={onClose} />
      <div
        className="color-picker-popover"
        data-state={open ? "open" : "closed"}
        ref={popoverRef}
        style={{ top: position.top, left: position.left }}
      >
        <div className="color-picker-header">
          <span
            className="color-picker-preview"
            style={{ backgroundColor: displayValue ?? value }}
          />
          <span className="color-picker-value">{displayValue ?? value}</span>
        </div>
        <input
          aria-label="Color spectrum"
          className="color-picker-spectrum"
          type="color"
          value={value}
          onChange={(event) => onSelect(event.target.value)}
        />
        <div className="color-picker-swatches">
          {PRESET_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className="color-picker-swatch"
              style={{ background: swatch }}
              onClick={() => onSelect(swatch)}
              aria-label={`Use ${swatch}`}
            />
          ))}
        </div>
      </div>

      <style jsx global>{`
        .color-picker-overlay {
          position: fixed;
          inset: 0;
          background: transparent;
          z-index: 9998;
        }

        .color-picker-popover {
          position: fixed !important;
          top: auto;
          left: auto;
          z-index: 9999;
          width: ${POPOVER_WIDTH}px;
          padding: 16px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          gap: 16px;
          pointer-events: auto;
          opacity: 0;
          transform: scale(0.98);
          transform-origin: top center;
          transition: opacity 0.15s ease-out, transform 0.15s ease-out;
          will-change: opacity, transform;
          max-height: 70vh;
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .color-picker-popover[data-state='open'] {
          opacity: 1;
          transform: scale(1);
        }

        .color-picker-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .color-picker-preview {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
          background-image: ${CHECKERBOARD_BACKGROUND};
        }

        .color-picker-value {
          font-family: "JetBrains Mono", "Fira Code", monospace;
          font-size: 0.75rem;
          color: ${inspectorColors.text};
        }

        .color-picker-spectrum {
          width: 100%;
          height: 160px;
          border-radius: 12px;
          border: none;
          padding: 0;
          background: transparent;
        }

        .color-picker-spectrum::-webkit-color-swatch-wrapper {
          padding: 0;
        }

        .color-picker-spectrum::-webkit-color-swatch {
          border-radius: 12px;
          border: none;
        }

        .color-picker-swatches {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }

        .color-picker-swatch {
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 8px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
          cursor: pointer;
        }

        .color-picker-swatch:focus-visible {
          outline: 2px solid ${tokens.colors.accent};
          outline-offset: 2px;
        }
      `}</style>
    </>,
    portalRef.current,
  );
}
