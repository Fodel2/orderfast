import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableAttributes,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SlidesManager, {
  DEVICE_DIMENSIONS,
  DEFAULT_BUTTON_CONFIG,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  type BlockBackground,
  type BlockBackgroundGradientDirection,
  type BlockShadowPreset,
  type ButtonBlockConfig,
  type ButtonBlockSize,
  type ButtonBlockVariant,
  type BlockAnimationConfig,
  type BlockAnimationType,
  DEFAULT_IMAGE_CONFIG,
  type GalleryBlockItem,
  DEFAULT_GALLERY_CONFIG,
  type ImageBlockConfig,
  type GalleryBlockConfig,
  DEFAULT_QUOTE_CONFIG,
  type QuoteBlockConfig,
  type BlockHoverTransition,
  type BlockTransitionConfig,
  DEFAULT_BLOCK_VISIBILITY,
  type BlockVisibilityConfig,
  type DeviceKind,
  type Frame,
  type SlideBackground,
  type SlideBlock,
  type SlideCfg,
  type SlidesManagerChangeOptions,
  getAspectRatioValue,
  normalizeBlockAspectRatio,
  resolveButtonConfig,
  resolveImageConfig,
  resolveGalleryConfig,
  MIN_GALLERY_AUTOPLAY_INTERVAL,
  MAX_GALLERY_AUTOPLAY_INTERVAL,
  resolveQuoteConfig,
  resolveBlockVisibility,
  resolveBlockAnimationConfig,
  resolveBlockTransitionConfig,
  DEFAULT_BLOCK_ANIMATION_CONFIG,
  DEFAULT_BLOCK_TRANSITION_CONFIG,
  DEFAULT_TEXT_PLACEHOLDER,
  readTextSizingConfig,
  pickTextSizingDimensions,
  writeTextSizingToConfig,
  updateConfigWithTextContent,
} from "./SlidesManager";
import {
  DEFAULT_TEXT_FONT_FAMILY,
  normalizeFontFamily,
} from "@/lib/slideFonts";
import FontSelect from "./ui/FontSelect";
import { APP_FONTS, ensureFontLoaded } from "@/lib/fonts";
import Button from "@/components/ui/Button";
import {
  InputCheckbox,
  InputColor,
  InputNumber,
  InputSelect,
  InputSlider,
  InputText,
  InputToggle,
} from "./ui";
import InspectorSection from "../src/components/inspector/InspectorSection";
import ControlRow from "../src/components/inspector/ControlRow";
import InspectorInputColor from "../src/components/inspector/controls/InputColor";
import InspectorInputSelect, {
  type InputSelectOption,
} from "../src/components/inspector/controls/InputSelect";
import InspectorInputSlider from "../src/components/inspector/controls/InputSlider";
import InspectorInputText from "../src/components/inspector/controls/InputText";
import InspectorInputTextArea from "../src/components/inspector/controls/InputTextArea";
import InspectorInputToggle from "../src/components/inspector/controls/InputToggle";
import InspectorInputUpload from "../src/components/inspector/controls/InputUpload";
import { inspectorColors, inspectorLayout } from "../src/components/inspector/layout";
import { tokens } from "../src/ui/tokens";
import { supabase } from "@/utils/supabaseClient";
import { STORAGE_BUCKET } from "@/lib/storage";
import { SlideRow } from "@/components/customer/home/SlidesContainer";
import { LockClosedIcon } from "@heroicons/react/24/solid";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Star,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";

type LinkOption = InputSelectOption;

const ROUTE_OPTIONS: LinkOption[] = [
  { value: "/menu", label: "Menu" },
  { value: "/orders", label: "Orders" },
  { value: "/more", label: "More" },
];

const CUSTOM_LINK_OPTION: LinkOption = {
  value: "custom",
  label: "Custom URL",
};

const INSPECTOR_NESTED_GROUP_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: tokens.spacing.sm,
  paddingLeft: tokens.spacing.md,
};

const DEFAULT_BORDER_COLOR = "rgba(15, 23, 42, 0.12)";

const DEFAULT_FRAMES: Record<SlideBlock["kind"], Frame> = {
  heading: { x: 12, y: 12, w: 76, h: 18, r: 0 },
  subheading: { x: 12, y: 32, w: 70, h: 14, r: 0 },
  text: { x: 12, y: 48, w: 72, h: 24, r: 0 },
  button: { x: 12, y: 76, w: 40, h: 12, r: 0 },
  image: { x: 20, y: 20, w: 48, h: 40, r: 0 },
  quote: { x: 10, y: 50, w: 60, h: 22, r: 0 },
  gallery: { x: 6, y: 60, w: 88, h: 26, r: 0 },
  spacer: { x: 0, y: 0, w: 10, h: 10, r: 0 },
};

const FONT_ENABLED_BLOCK_KINDS: SlideBlock["kind"][] = [
  "heading",
  "subheading",
  "text",
  "quote",
  "button",
];

const isFontEnabledBlock = (kind: SlideBlock["kind"]): boolean =>
  FONT_ENABLED_BLOCK_KINDS.includes(kind);

const TEXTUAL_BLOCK_KINDS: SlideBlock["kind"][] = [
  "heading",
  "subheading",
  "text",
  "quote",
  "button",
];

const isTextualBlock = (kind: SlideBlock["kind"]): boolean =>
  TEXTUAL_BLOCK_KINDS.includes(kind);

const TEXT_SIZES: { value: NonNullable<SlideBlock["size"]>; label: string }[] =
  [
    { value: "sm", label: "Small" },
    { value: "md", label: "Medium" },
    { value: "lg", label: "Large" },
    { value: "xl", label: "Extra large" },
  ];

const FONT_WEIGHT_OPTIONS: { value: number; label: string }[] = [
  { value: 400, label: "Normal (400)" },
  { value: 500, label: "Medium (500)" },
  { value: 600, label: "Semibold (600)" },
  { value: 700, label: "Bold (700)" },
];

const TEXT_ALIGNMENT_OPTIONS: {
  value: NonNullable<SlideBlock["align"]>;
  label: string;
}[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const BLOCK_SHADOW_OPTIONS: { value: BlockShadowPreset; label: string }[] = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
];

const ENABLED_SHADOW_OPTIONS = BLOCK_SHADOW_OPTIONS.filter(
  (option) => option.value !== "none",
);

const BLOCK_BACKGROUND_TYPE_OPTIONS: {
  value: NonNullable<BlockBackground["type"]>;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "color", label: "Color" },
  { value: "gradient", label: "Gradient" },
  { value: "image", label: "Image" },
];

const ENABLED_BACKGROUND_STYLE_OPTIONS = BLOCK_BACKGROUND_TYPE_OPTIONS.filter(
  (option) => option.value !== "none",
);

const BLOCK_BACKGROUND_GRADIENT_DIRECTIONS: {
  value: BlockBackgroundGradientDirection;
  label: string;
}[] = [
  { value: "to-top", label: "To top" },
  { value: "to-bottom", label: "To bottom" },
  { value: "to-left", label: "To left" },
  { value: "to-right", label: "To right" },
];

const DEFAULT_ENABLED_SHADOW: BlockShadowPreset = "sm";
const DEFAULT_ENABLED_BACKGROUND_TYPE: Exclude<
  NonNullable<BlockBackground["type"]>,
  "none"
> = "color";
const DEFAULT_ENABLED_ANIMATION: Exclude<BlockAnimationType, "none"> = "fade-in";
const DEFAULT_ENABLED_TRANSITION: Exclude<BlockHoverTransition, "none"> = "grow";

const IMAGE_ASPECT_RATIO_OPTIONS: {
  value: ImageBlockConfig["aspectRatio"];
  label: string;
}[] = [
  { value: "original", label: "Original" },
  { value: "square", label: "Square (1:1)" },
  { value: "4:3", label: "4:3" },
  { value: "16:9", label: "16:9" },
];

type InspectorInlineButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: "default" | "danger";
  };

const InspectorInlineButton: React.FC<InspectorInlineButtonProps> = ({
  tone = "default",
  className = "",
  type = "button",
  children,
  disabled,
  ...rest
}) => {
  const classes = [
    "inspector-inline-button",
    `inspector-inline-button--${tone}`,
    disabled ? "inspector-inline-button--disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button type={type} className={classes} disabled={disabled} {...rest}>
        {children}
      </button>
      <style jsx>{`
        .inspector-inline-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
          height: ${inspectorLayout.controlHeight}px;
          padding: 0 ${tokens.spacing.md}px;
          border-radius: ${inspectorLayout.radius}px;
          border: ${inspectorLayout.borderWidth}px solid ${inspectorColors.border};
          background: ${inspectorColors.background};
          color: ${inspectorColors.text};
          font-size: 0.875rem;
          font-weight: 500;
          line-height: 1;
          white-space: nowrap;
          transition: border-color 0.2s ease, background-color 0.2s ease,
            color 0.2s ease, box-shadow 0.2s ease;
        }

        .inspector-inline-button:focus-visible {
          outline: 2px solid #10b981;
          outline-offset: 2px;
        }

        .inspector-inline-button:not(.inspector-inline-button--disabled):hover {
          border-color: rgba(15, 23, 42, 0.24);
          box-shadow: ${tokens.shadow.sm};
        }

        .inspector-inline-button--danger {
          color: #b91c1c;
          border-color: rgba(220, 38, 38, 0.4);
        }

        .inspector-inline-button--danger:not(.inspector-inline-button--disabled):hover {
          background: rgba(254, 226, 226, 0.7);
          border-color: rgba(220, 38, 38, 0.55);
        }

        .inspector-inline-button--disabled,
        .inspector-inline-button:disabled {
          opacity: ${tokens.opacity[50]};
          cursor: not-allowed;
          box-shadow: none;
        }
      `}</style>
    </>
  );
};

const BLOCK_ANIMATION_OPTIONS: { value: BlockAnimationType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade-in", label: "Fade In" },
  { value: "slide-in-left", label: "Slide In Left" },
  { value: "slide-in-right", label: "Slide In Right" },
  { value: "slide-in-up", label: "Slide In Up" },
  { value: "slide-in-down", label: "Slide In Down" },
  { value: "zoom-in", label: "Zoom In" },
];

const ENABLED_ANIMATION_OPTIONS = BLOCK_ANIMATION_OPTIONS.filter(
  (option) => option.value !== "none",
);

const BLOCK_TRANSITION_OPTIONS: { value: BlockHoverTransition; label: string }[] = [
  { value: "none", label: "None" },
  { value: "grow", label: "Grow" },
  { value: "shrink", label: "Shrink" },
  { value: "pulse", label: "Pulse" },
  { value: "shadow", label: "Shadow" },
  { value: "rotate", label: "Rotate" },
];

const ENABLED_TRANSITION_OPTIONS = BLOCK_TRANSITION_OPTIONS.filter(
  (option) => option.value !== "none",
);

const DEFAULT_BLOCK_BACKGROUND_COLOR = "#ffffff";
const DEFAULT_BLOCK_GRADIENT_FROM = "rgba(15, 23, 42, 0.45)";
const DEFAULT_BLOCK_GRADIENT_TO = "rgba(15, 23, 42, 0.05)";

const BUTTON_FONT_SIZE_PX: Record<ButtonBlockSize, number> = {
  Small: 14,
  Medium: 16,
  Large: 18,
};

const BACKGROUND_STYLE_OPTIONS: { value: NonNullable<SlideBlock["bgStyle"]>; label: string }[] = [
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "glass", label: "Glass" },
];

const QUOTE_STYLE_OPTIONS: { value: QuoteBlockConfig["style"]; label: string }[] = [
  { value: "plain", label: "Plain" },
  { value: "emphasis", label: "Emphasis" },
  { value: "card", label: "Card" },
];

const QUOTE_STAR_COUNT = 5;

type QuoteStarRatingSelectorProps = {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
};

function QuoteStarRatingSelector({
  value,
  onChange,
  disabled = false,
}: QuoteStarRatingSelectorProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const activeValue = disabled ? value : hoverValue ?? value;

  return (
    <>
      <div
        className={`quote-star-rating-control${disabled ? " is-disabled" : ""}`}
        role="group"
        aria-label="Star rating"
        aria-disabled={disabled || undefined}
      >
        {Array.from({ length: QUOTE_STAR_COUNT }).map((_, index) => {
          const starValue = index + 1;
          const isActive = activeValue >= starValue;
          const isSelected = value >= starValue;
          const label = `${starValue} star${starValue === 1 ? "" : "s"}`;

          const handleSelect = () => {
            if (disabled) return;
            onChange(value === starValue ? 0 : starValue);
          };

          const handleEnter = () => {
            if (disabled) return;
            setHoverValue(starValue);
          };

          const handleLeave = () => {
            if (disabled) return;
            setHoverValue(null);
          };

          return (
            <button
              key={starValue}
              type="button"
              className={`quote-star-rating-control__button${
                isActive ? " is-active" : ""
              }${isSelected ? " is-selected" : ""}`}
              aria-label={label}
              aria-pressed={isSelected}
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
              onFocus={handleEnter}
              onBlur={handleLeave}
              onClick={handleSelect}
              disabled={disabled}
            >
              <Star
                className="quote-star-rating-control__icon"
                aria-hidden
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
      <style jsx>{`
        .quote-star-rating-control {
          display: inline-flex;
          gap: ${tokens.spacing.xs}px;
          align-items: center;
          color: var(--brand-primary, ${tokens.colors.accent});
        }
        .quote-star-rating-control.is-disabled {
          opacity: 0.6;
        }
        .quote-star-rating-control__button {
          appearance: none;
          border: none;
          background: transparent;
          padding: ${tokens.spacing.xs / 2}px;
          border-radius: ${tokens.radius.sm}px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
          outline: none;
        }
        .quote-star-rating-control__button:hover,
        .quote-star-rating-control__button:focus-visible {
          box-shadow: ${tokens.shadow.sm};
          background-color: rgba(15, 23, 42, 0.06);
          transform: translateY(-1px);
        }
        .quote-star-rating-control__button:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 2px;
        }
        .quote-star-rating-control__button:disabled {
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
          background: transparent;
        }
        .quote-star-rating-control__button:disabled:focus-visible {
          outline: none;
        }
        .quote-star-rating-control__icon {
          width: ${tokens.spacing.md}px;
          height: ${tokens.spacing.md}px;
          stroke: currentColor;
          fill: transparent;
          opacity: 0.35;
          transition: fill 120ms ease, opacity 120ms ease;
        }
        .quote-star-rating-control__button.is-active .quote-star-rating-control__icon,
        .quote-star-rating-control__button.is-selected .quote-star-rating-control__icon {
          fill: currentColor;
          opacity: 1;
        }
      `}</style>
    </>
  );
}

type ReviewOption = {
  id: string;
  author: string;
  text: string;
};

const DEFAULT_REVIEW_OPTIONS: ReviewOption[] = [
  { id: "mock-1", author: "Jasmine", text: "🔥 The best burger I've had in years!" },
  { id: "mock-2", author: "Luke", text: "Quick delivery and amazing fries." },
  { id: "mock-3", author: "Aminah", text: "So good I came back the next day." },
  { id: "mock-4", author: "Ben", text: "Perfect hangover cure!" },
];

const DEVICE_VISIBILITY_CONTROLS: { key: keyof BlockVisibilityConfig; label: string }[] = [
  { key: "mobile", label: "Show on Mobile" },
  { key: "tablet", label: "Show on Tablet" },
  { key: "desktop", label: "Show on Desktop" },
];

const formatReviewOptionLabel = (option: ReviewOption) => {
  const snippet = option.text.length > 60 ? `${option.text.slice(0, 57)}…` : option.text;
  return `${option.author} — ${snippet}`;
};

const SIZE_TO_FONT_SIZE_PX: Record<NonNullable<SlideBlock["size"]>, number> = {
  sm: 18,
  md: 24,
  lg: 40,
  xl: 56,
};

const TEXT_KIND_FONT_DEFAULT: Partial<Record<SlideBlock["kind"], number>> = {
  heading: 56,
  subheading: SIZE_TO_FONT_SIZE_PX.md,
};

const DEFAULT_TEXT_SHADOW: NonNullable<SlideBlock["textShadow"]> = {
  x: 0,
  y: 2,
  blur: 4,
  color: "rgba(0, 0, 0, 0.3)",
};

const BLOCK_KIND_LABELS: Record<SlideBlock["kind"], string> = {
  heading: "Heading",
  subheading: "Subheading",
  text: "Text",
  button: "Button",
  image: "Image",
  quote: "Quote",
  gallery: "Gallery",
  spacer: "Spacer",
};

const PREVIEW_PADDING_X = tokens.spacing.md;
const PREVIEW_PADDING_Y = tokens.spacing.md;
const INSPECTOR_MIN_WIDTH = tokens.spacing.xl * 8;
const INSPECTOR_MAX_WIDTH = tokens.spacing.xl * 14;
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;

const INSPECTOR_CONTENT_CLASS = [
  "space-y-4 px-4 pb-4 pt-3",
  "[&_label:not(.flex)]:flex",
  "[&_label:not(.flex)]:flex-col",
  "[&_label:not(.flex)]:gap-1",
  "[&_label:not(.flex)]:text-xs",
  "[&_label:not(.flex)]:font-medium",
  "[&_label]:text-neutral-600",
  "[&_label:not(.flex)>span:first-child]:!text-[11px]",
  "[&_label:not(.flex)>span:first-child]:!font-semibold",
  "[&_label:not(.flex)>span:first-child]:!text-neutral-600",
  "[&_label:not(.flex)>span:first-child]:leading-tight",
  "[&_label:not(.flex)>input]:!mt-0",
  "[&_label:not(.flex)>textarea]:!mt-0",
  "[&_label:not(.flex)>select]:!mt-0",
  "[&_label:not(.flex)>div]:!mt-0",
  "[&_.gap-4]:gap-3",
  "[&_.space-y-4]:space-y-3",
  "[&_.space-y-6]:space-y-4",
].join(" ");

const TEXTUAL_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
]);

const TEXTUAL_INPUT_SELECTOR =
  'input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input[type="number"], textarea, [contenteditable="true"]';

const isTextualInteractiveElement = (
  element: Element | null,
): element is HTMLInputElement | HTMLTextAreaElement | HTMLElement => {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    const type = element.type?.toLowerCase() ?? "";
    return type === "" || TEXTUAL_INPUT_TYPES.has(type);
  }
  if (element instanceof HTMLElement && element.isContentEditable) {
    return true;
  }
  return false;
};

const INSPECTOR_INPUT_CLASS = [
  "w-full",
  "rounded-md",
  "border",
  "border-neutral-300",
  "bg-white",
  "px-3",
  "py-2",
  "text-sm",
  "text-neutral-900",
  "shadow-sm",
  "focus:border-neutral-400",
  "focus:outline-none",
  "focus:ring-1",
  "focus:ring-neutral-400",
].join(" ");

const CHECKERBOARD_BACKGROUND =
  "linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)";

type ParsedColor = {
  hex: string;
  alpha: number;
};

function parseColorValue(raw: string | null | undefined): ParsedColor {
  if (!raw) {
    return { hex: "#000000", alpha: 1 };
  }
  const value = raw.trim();
  if (value.length === 0) {
    return { hex: "#000000", alpha: 1 };
  }
  if (value.toLowerCase() === "transparent") {
    return { hex: "#000000", alpha: 0 };
  }
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length === 6) {
      return { hex: `#${hex}`, alpha: 1 };
    }
    if (hex.length === 8) {
      const base = hex.slice(0, 6);
      const alphaHex = hex.slice(6, 8);
      const alpha = parseInt(alphaHex, 16);
      return {
        hex: `#${base}`,
        alpha: Number.isNaN(alpha) ? 1 : clamp01(alpha / 255),
      };
    }
    return { hex: `#${hex.slice(0, 6).padEnd(6, "0")}`, alpha: 1 };
  }
  const rgbaMatch = value.match(/rgba?\(([^)]+)\)/i);
  if (rgbaMatch) {
    const [r, g, b, a] = rgbaMatch[1]
      .split(",")
      .map((part) => part.trim())
      .map((part, index) =>
        index < 3 ? parseInt(part, 10) : Number.parseFloat(part || "1"),
      );
    if ([r, g, b].some((channel) => Number.isNaN(channel))) {
      return { hex: "#000000", alpha: 1 };
    }
    const toHex = (channel: number) => {
      const clamped = Math.min(255, Math.max(0, Math.round(channel)));
      return clamped.toString(16).padStart(2, "0");
    };
    return {
      hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      alpha: Number.isNaN(a) ? 1 : clamp01(a),
    };
  }
  return { hex: "#000000", alpha: 1 };
}

function hexToRgbaString(hex: string, alpha: number): string {
  if (!hex) {
    return `rgba(0, 0, 0, ${clamp01(alpha)})`;
  }
  let normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const safeR = Number.isNaN(r) ? 0 : r;
  const safeG = Number.isNaN(g) ? 0 : g;
  const safeB = Number.isNaN(b) ? 0 : b;
  const alphaString = clamp01(alpha).toFixed(2).replace(/\.00$/, "");
  return `rgba(${safeR}, ${safeG}, ${safeB}, ${alphaString})`;
}

type InspectorColorInputProps = {
  value: string;
  onChange: (next: string) => void;
  allowAlpha?: boolean;
  disabled?: boolean;
};

const InspectorColorInput: React.FC<InspectorColorInputProps> = ({
  value,
  onChange,
  allowAlpha = false,
  disabled = false,
}) => {
  const parsed = useMemo(() => parseColorValue(value), [value]);
  const [textValue, setTextValue] = useState(value ?? "");

  useEffect(() => {
    setTextValue(value ?? "");
  }, [value]);

  const previewColor = textValue?.trim().length ? textValue : parsed.hex;

  const handleCommit = useCallback(
    (nextValue: string) => {
      if (disabled) return;
      setTextValue(nextValue);
      onChange(nextValue);
    },
    [disabled, onChange],
  );

  const handleColorChange = useCallback(
    (nextHex: string) => {
      if (allowAlpha && parsed.alpha < 0.999) {
        handleCommit(hexToRgbaString(nextHex, parsed.alpha));
        return;
      }
      handleCommit(nextHex);
    },
    [allowAlpha, handleCommit, parsed.alpha],
  );

  const handleAlphaChange = useCallback(
    (next: number) => {
      const normalized = clamp01(next / 100);
      if (!allowAlpha) {
        return;
      }
      if (normalized >= 0.999) {
        handleCommit(parsed.hex);
        return;
      }
      handleCommit(hexToRgbaString(parsed.hex, normalized));
    },
    [allowAlpha, handleCommit, parsed.hex],
  );

  return (
    <div className="flex flex-col gap-2">
      <InputColor
        value={textValue}
        previewValue={previewColor}
        onChange={handleCommit}
        onColorInputChange={handleColorChange}
        disabled={disabled}
      />
      {allowAlpha && (
        <InputSlider
          min={0}
          max={100}
          step={1}
          value={Math.round(parsed.alpha * 100)}
          fallbackValue={100}
          onValueChange={(next) =>
            handleAlphaChange(typeof next === "number" ? next : 0)
          }
          disabled={disabled}
          containerClassName="mt-0 flex flex-1 items-center gap-2"
          sliderClassName="flex-1"
          numberInputClassName="w-16 shrink-0 text-right text-xs"
          numberInputProps={{ inputMode: "numeric" }}
        />
      )}
    </div>
  );
};

type InspectorSliderControlProps = {
  label: React.ReactNode;
  value: number | undefined;
  fallbackValue?: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number | undefined) => void;
  formatValue?: (
    value: number | undefined,
    fallbackValue?: number,
  ) => string;
  disabled?: boolean;
  numberInputClassName?: string;
};

const InspectorSliderControl: React.FC<InspectorSliderControlProps> = ({
  label,
  value,
  fallbackValue,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  disabled = false,
  numberInputClassName,
}) => {
  const handleValueChange = useCallback(
    (next: number | undefined) => {
      if (Number.isNaN(next as number)) {
        onChange(undefined);
        return;
      }
      onChange(next);
    },
    [onChange],
  );

  return (
    <InputSlider
      label={<span>{label}</span>}
      labelClassName="text-neutral-500"
      min={min}
      max={max}
      step={step}
      value={value}
      fallbackValue={fallbackValue ?? min}
      formatValue={formatValue}
      onValueChange={handleValueChange}
      disabled={disabled}
      numberInputClassName={`${INSPECTOR_INPUT_CLASS} w-[60px] shrink-0 text-right ${numberInputClassName ?? ""}`}
    />
  );
};

const cloneCfg = (cfg: SlideCfg): SlideCfg => JSON.parse(JSON.stringify(cfg));

function defaultBackground(): SlideCfg["background"] {
  return {
    type: "color",
    color: "#111",
    opacity: 1,
    overlay: { color: "#000", opacity: 0.25 },
  };
}

function clampPct(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

function clamp01(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function clampRange(v: number, min: number, max: number) {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function getDefaultFrame(kind: SlideBlock["kind"]): Frame {
  return { ...DEFAULT_FRAMES[kind] };
}

function ensureFrame(block: SlideBlock, device: DeviceKind): Frame {
  return block.frames[device]
    ? { ...block.frames[device]! }
    : getDefaultFrame(block.kind);
}

function convertLegacyFrame(pos: any): Frame {
  const w = typeof pos?.wPct === "number" ? clampPct(pos.wPct) : 40;
  const h = typeof pos?.hPct === "number" ? clampPct(pos.hPct) : 20;
  const cx = typeof pos?.xPct === "number" ? clampPct(pos.xPct) : 50;
  const cy = typeof pos?.yPct === "number" ? clampPct(pos.yPct) : 50;
  const x = clampPct(cx - w / 2);
  const y = clampPct(cy - h / 2);
  const r = typeof pos?.rotateDeg === "number" ? pos.rotateDeg : 0;
  return { x, y, w, h, r };
}

function normalizeBackground(raw: any): SlideCfg["background"] {
  if (raw === null) return { type: "none" };
  if (!raw) return defaultBackground();
  const overlayFrom = (source: any) => {
    if (!source) return undefined;
    const overlay = source.overlay ?? source;
    const hasOverlay =
      overlay &&
      (typeof overlay.color === "string" ||
        typeof overlay.opacity === "number" ||
        typeof overlay.overlayColor === "string" ||
        typeof overlay.overlayOpacity === "number");
    if (!hasOverlay) return undefined;
    const color =
      typeof overlay.color === "string"
        ? overlay.color
        : typeof overlay.overlayColor === "string"
          ? overlay.overlayColor
          : "#000000";
    const opacitySource =
      typeof overlay.opacity === "number"
        ? overlay.opacity
        : typeof overlay.overlayOpacity === "number"
          ? overlay.overlayOpacity
          : 0.25;
    return { color, opacity: clamp01(opacitySource) };
  };

  const type: SlideCfg["background"]["type"] =
    raw.type ?? raw.kind ?? "color";
  if (type === "none") {
    return { type: "none" };
  }
  if (type === "color") {
    const color =
      typeof raw.color === "string"
        ? raw.color
        : typeof raw.value === "string"
          ? raw.value
          : "#111111";
    const opacity =
      typeof raw.opacity === "number"
        ? clamp01(raw.opacity)
        : undefined;
    return {
      type: "color",
      color,
      opacity,
      overlay: overlayFrom(raw.overlay ? raw.overlay : undefined),
    };
  }
  const url =
    typeof raw.url === "string"
      ? raw.url
      : typeof raw.src === "string"
        ? raw.src
        : typeof raw.value === "string"
          ? raw.value
          : undefined;
  const fit: NonNullable<SlideCfg["background"]>["fit"] =
    raw.fit === "contain" ? "contain" : "cover";
  const focalX =
    typeof raw.focal?.x === "number"
      ? raw.focal.x
      : typeof raw.focal_x === "number"
        ? raw.focal_x
        : typeof raw.focalX === "number"
          ? raw.focalX
          : undefined;
  const focalY =
    typeof raw.focal?.y === "number"
      ? raw.focal.y
      : typeof raw.focal_y === "number"
        ? raw.focal_y
        : typeof raw.focalY === "number"
          ? raw.focalY
          : undefined;
  const focal =
    typeof focalX === "number" || typeof focalY === "number"
      ? { x: clamp01(focalX ?? 0.5), y: clamp01(focalY ?? 0.5) }
      : undefined;
  const blur =
    typeof raw.blur === "number" ? clampRange(raw.blur, 0, 12) : undefined;
  if (type === "image") {
    return {
      type: "image",
      url,
      fit,
      focal,
      blur,
      overlay: overlayFrom(raw.overlay ? raw.overlay : raw),
    };
  }
  if (type === "video") {
    const poster =
      typeof raw.poster === "string"
        ? raw.poster
        : typeof raw.thumbnail === "string"
          ? raw.thumbnail
          : undefined;
    const loop =
      typeof raw.loop === "boolean"
        ? raw.loop
        : typeof raw.autoloop === "boolean"
          ? raw.autoloop
          : true;
    const mute =
      typeof raw.mute === "boolean"
        ? raw.mute
        : typeof raw.muted === "boolean"
          ? raw.muted
          : true;
    const autoplay =
      typeof raw.autoplay === "boolean"
        ? raw.autoplay
        : typeof raw.autoPlay === "boolean"
          ? raw.autoPlay
          : true;
    return {
      type: "video",
      url,
      fit,
      focal,
      blur,
      poster,
      loop,
      mute,
      autoplay,
      overlay: overlayFrom(raw.overlay ? raw.overlay : raw),
    };
  }
  return defaultBackground();
}

function parseNumericValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function clampBackgroundOpacityPercent(rawValue: number | undefined): number {
  if (rawValue === undefined) {
    return 100;
  }
  if (Number.isNaN(rawValue)) {
    return 100;
  }
  if (rawValue <= 1) {
    return Math.round(Math.min(1, Math.max(0, rawValue)) * 100);
  }
  return Math.round(Math.min(100, Math.max(0, rawValue)));
}

function normalizeBlockBackground(raw: any): BlockBackground {
  if (!raw) {
    return { type: "none", radius: 0, opacity: 100 };
  }

  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "none" || normalized.length === 0) {
      return { type: "none", radius: 0, opacity: 100 };
    }
  }

  if (typeof raw !== "object") {
    return { type: "none", radius: 0, opacity: 100 };
  }

  const source = raw as Record<string, any>;
  const typeValue =
    typeof source.type === "string"
      ? source.type.toLowerCase()
      : typeof source.kind === "string"
        ? source.kind.toLowerCase()
        : undefined;

  let type: BlockBackground["type"] = "none";
  if (typeValue === "color" || typeValue === "gradient" || typeValue === "image" || typeValue === "none") {
    type = typeValue as BlockBackground["type"];
  } else if (source.gradient || typeof source.color2 === "string") {
    type = "gradient";
  } else if (
    typeof source.color === "string" ||
    typeof source.value === "string" ||
    typeof source.backgroundColor === "string" ||
    typeof source.fill === "string"
  ) {
    type = "color";
  } else if (
    (source.image && typeof source.image === "object") ||
    typeof source.url === "string" ||
    typeof source.src === "string"
  ) {
    type = "image";
  }

  const radiusCandidate =
    parseNumericValue(source.radius) ??
    parseNumericValue(source.borderRadius) ??
    parseNumericValue(source.cornerRadius);
  const opacityCandidate =
    parseNumericValue(source.opacity) ??
    parseNumericValue(source.alpha) ??
    parseNumericValue(source.backgroundOpacity) ??
    parseNumericValue(source.opacityPercent);

  const base: BlockBackground = {
    type,
    radius: radiusCandidate !== undefined ? Math.max(0, radiusCandidate) : 0,
    opacity: clampBackgroundOpacityPercent(opacityCandidate),
  };

  if (type === "none") {
    return base;
  }

  if (type === "color") {
    const color =
      typeof source.color === "string"
        ? source.color
        : typeof source.value === "string"
          ? source.value
          : typeof source.backgroundColor === "string"
            ? source.backgroundColor
            : typeof source.fill === "string"
              ? source.fill
              : DEFAULT_BLOCK_BACKGROUND_COLOR;
    return { ...base, type: "color", color };
  }

  if (type === "gradient") {
    const gradientSource =
      source.gradient && typeof source.gradient === "object" ? source.gradient : source;
    const from =
      typeof gradientSource.from === "string"
        ? gradientSource.from
        : typeof gradientSource.start === "string"
          ? gradientSource.start
          : typeof gradientSource.color1 === "string"
            ? gradientSource.color1
            : DEFAULT_BLOCK_GRADIENT_FROM;
    const to =
      typeof gradientSource.to === "string"
        ? gradientSource.to
        : typeof gradientSource.end === "string"
          ? gradientSource.end
          : typeof gradientSource.color2 === "string"
            ? gradientSource.color2
            : DEFAULT_BLOCK_GRADIENT_TO;
    const directionValue =
      typeof gradientSource.direction === "string"
        ? gradientSource.direction.replace(/\s+/g, "-").toLowerCase()
        : typeof source.direction === "string"
          ? source.direction.replace(/\s+/g, "-").toLowerCase()
          : undefined;
    const direction: BlockBackgroundGradientDirection =
      directionValue === "to-top" ||
      directionValue === "to-left" ||
      directionValue === "to-right" ||
      directionValue === "to-bottom"
        ? (directionValue as BlockBackgroundGradientDirection)
        : "to-bottom";
    return {
      ...base,
      type: "gradient",
      color: from,
      color2: to,
      direction,
    };
  }

  const imageSource =
    source.image && typeof source.image === "object" ? source.image : source;
  const url =
    typeof imageSource.url === "string"
      ? imageSource.url
      : typeof imageSource.src === "string"
        ? imageSource.src
        : typeof source.url === "string"
          ? source.url
          : undefined;
  return {
    ...base,
    type: "image",
    url,
  };
}

function cloneBlockBackground(background?: BlockBackground | null): BlockBackground {
  if (!background || typeof background !== "object") {
    return { type: "none", radius: 0, opacity: 100 };
  }
  return {
    type: background.type ?? "none",
    color: background.color,
    color2: background.color2,
    direction: background.direction,
    url: background.url,
    radius:
      typeof background.radius === "number" && Number.isFinite(background.radius)
        ? Math.max(0, background.radius)
        : 0,
    opacity: clampBackgroundOpacityPercent(
      typeof background.opacity === "number" ? background.opacity : undefined,
    ),
  };
}

function extractConfig(config: SlideBlock["config"]): Record<string, any> {
  if (config && typeof config === "object") {
    return { ...(config as Record<string, any>) };
  }
  return {};
}

function applyFontFamilyToConfig(
  config: Record<string, any>,
  fontFamily: SlideBlock["fontFamily"] | undefined,
): Record<string, any> {
  const next = { ...config };
  if (typeof fontFamily === "string" && fontFamily.length > 0) {
    next.fontFamily = fontFamily;
  } else {
    delete next.fontFamily;
  }
  return next;
}

function mergeInteractionConfig(
  block: SlideBlock,
  candidate?: Record<string, any>,
): Record<string, any> {
  const base = { ...(candidate ?? {}) };
  const syntheticBlock: SlideBlock = { ...block, config: base };
  const visibility = resolveBlockVisibility(syntheticBlock);
  base.visibleOn = { ...visibility } satisfies BlockVisibilityConfig;
  const animation = resolveBlockAnimationConfig(syntheticBlock);
  const transition = resolveBlockTransitionConfig(syntheticBlock);
  base.animation = {
    type: animation.type,
    duration: Math.max(
      0,
      animation.duration ?? DEFAULT_BLOCK_ANIMATION_CONFIG.duration,
    ),
    delay: Math.max(
      0,
      animation.delay ?? DEFAULT_BLOCK_ANIMATION_CONFIG.delay,
    ),
  } satisfies BlockAnimationConfig;
  base.transition = {
    hover: transition.hover,
    duration: Math.max(
      0,
      transition.duration ?? DEFAULT_BLOCK_TRANSITION_CONFIG.duration,
    ),
  } satisfies BlockTransitionConfig;
  return base;
}

function normalizeBlock(raw: any, positions?: Record<string, any>): SlideBlock {
  const kind: SlideBlock["kind"] = raw.kind ?? raw.type ?? "text";
  const frames: SlideBlock["frames"] = {};
  if (raw.frames && typeof raw.frames === "object") {
    (Object.keys(raw.frames) as DeviceKind[]).forEach((device) => {
      const f = raw.frames[device];
      if (f) {
        frames[device] = {
          x: clampPct(f.x ?? f.xPct ?? DEFAULT_FRAMES[kind].x),
          y: clampPct(f.y ?? f.yPct ?? DEFAULT_FRAMES[kind].y),
          w: clampPct(f.w ?? f.wPct ?? DEFAULT_FRAMES[kind].w),
          h: clampPct(f.h ?? f.hPct ?? DEFAULT_FRAMES[kind].h),
          r:
            typeof f.r === "number"
              ? f.r
              : typeof f.rotateDeg === "number"
                ? f.rotateDeg
                : DEFAULT_FRAMES[kind].r,
        };
      }
    });
  }
  if (Object.keys(frames).length === 0) {
    const legacy = positions?.[raw.id];
    if (legacy) {
      const converted = convertLegacyFrame(legacy);
      frames.mobile = converted;
      frames.tablet = converted;
      frames.desktop = converted;
    } else {
      frames.desktop = getDefaultFrame(kind);
    }
  }

  const block: SlideBlock = {
    id: raw.id || crypto.randomUUID(),
    kind,
    frames,
    text: raw.text ?? raw.label ?? "",
    href: raw.href,
    src: raw.src || raw.url,
    color: raw.color,
    align: raw.align,
    size: raw.size,
    buttonVariant: raw.buttonVariant,
    config:
      raw.config && typeof raw.config === "object"
        ? { ...(raw.config as Record<string, any>) }
        : undefined,
    fit: raw.fit,
    author: raw.author,
    items: Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.images)
        ? raw.images.map((src: string) => ({ src }))
        : undefined,
    height: raw.height,
    locked: Boolean(raw.locked),
  };

  let workingConfig = extractConfig(block.config);

  if (kind === "image") {
    const existingConfig = extractConfig(block.config);
    const imageConfig = resolveImageConfig(block);
    const hydratedConfig = {
      ...existingConfig,
      ...imageConfig,
    } satisfies Record<string, any>;
    block.config = hydratedConfig;
    block.src = imageConfig.url;
    block.fit = imageConfig.fit;
    block.radius = imageConfig.radius;
    block.alt = imageConfig.alt;
    block.aspectRatio = imageConfig.aspectRatio;
    workingConfig = extractConfig(block.config);
  }
  if (kind === "gallery") {
    const existingConfig = extractConfig(block.config);
    const galleryConfig = resolveGalleryConfig(block);
    block.items = galleryConfig.items.map((item) => ({
      src: item.url,
      alt: item.alt ?? "",
    }));
    const hydratedConfig = {
      ...existingConfig,
      ...galleryConfig,
      items: galleryConfig.items,
    } satisfies Record<string, any>;
    block.config = hydratedConfig;
    block.radius = galleryConfig.radius;
    block.aspectRatio = galleryConfig.aspectRatio;
    workingConfig = extractConfig(block.config);
  }
  if (kind === "heading" && !block.size) block.size = "xl";
  if (kind === "subheading" && !block.size) block.size = "md";
  if (kind === "text" && !block.size) block.size = "sm";
  if (kind === "button" && !block.text) block.text = "Button";
  if (kind === "button") {
    const normalizedConfig = resolveButtonConfig(block);
    block.config = normalizedConfig;
    block.text = normalizedConfig.label;
    block.href = normalizedConfig.href;
    block.buttonVariant =
      normalizedConfig.variant === "Outline" ? "secondary" : "primary";
    workingConfig = extractConfig(block.config);
  }
  if (
    (kind === "heading" || kind === "subheading" || kind === "text") &&
    !block.color
  ) {
    block.color = "#ffffff";
  }

  if (
    kind === "heading" ||
    kind === "subheading" ||
    kind === "text"
  ) {
    const configText =
      typeof workingConfig.text === "string" ? workingConfig.text : undefined;
    const configContent =
      typeof workingConfig.content === "string" ? workingConfig.content : configText;
    const fallbackText =
      typeof raw.text === "string"
        ? raw.text
        : typeof raw.label === "string"
          ? raw.label
          : configText ?? block.text ?? "";
    const content =
      typeof raw.content === "string"
        ? raw.content
        : configContent ?? fallbackText;
    block.content = content;
    block.text = content;
    workingConfig.text = content;
    workingConfig.content = content;
  } else if (isTextualBlock(kind)) {
    const configText =
      typeof workingConfig.text === "string" ? workingConfig.text : undefined;
    if (!block.text && configText) {
      block.text = configText;
    }
  }

  if (isFontEnabledBlock(kind)) {
    const configFontFamily =
      block.config && typeof block.config === "object"
        ? normalizeFontFamily((block.config as Record<string, any>).fontFamily)
        : undefined;
    const rawFontFamily = normalizeFontFamily((raw as Record<string, any>).fontFamily);
    const currentFontFamily = normalizeFontFamily(block.fontFamily);
    block.fontFamily =
      configFontFamily ??
      rawFontFamily ??
      currentFontFamily ??
      DEFAULT_TEXT_FONT_FAMILY;
  }

  if (kind === "heading" || kind === "subheading" || kind === "text") {
    const fallbackWeight =
      kind === "heading" ? 700 : kind === "subheading" ? 600 : 400;
    block.fontWeight =
      typeof raw.fontWeight === "number"
        ? raw.fontWeight
        : typeof block.fontWeight === "number"
          ? block.fontWeight
          : fallbackWeight;
    const fontSizeFallback =
      typeof raw.fontSize === "number"
        ? raw.fontSize
        : block.size
          ? SIZE_TO_FONT_SIZE_PX[block.size]
          : kind === "heading"
            ? 56
            : kind === "subheading"
              ? SIZE_TO_FONT_SIZE_PX.md
              : 16;
    block.fontSize = fontSizeFallback;
    if (typeof raw.lineHeight === "number") {
      block.lineHeight = raw.lineHeight;
    }
    if (raw.lineHeightUnit === "px" || raw.lineHeightUnit === "em") {
      block.lineHeightUnit = raw.lineHeightUnit;
    } else if (typeof block.lineHeightUnit !== "string") {
      block.lineHeightUnit = undefined;
    }
    if (typeof raw.letterSpacing === "number") {
      block.letterSpacing = raw.letterSpacing;
    }
    const textColor =
      typeof raw.textColor === "string"
        ? raw.textColor
        : block.color || "#000000";
    block.textColor = textColor;
    block.color = textColor;
    if (kind === "heading" || kind === "text") {
      const bgStyleValue = raw.bgStyle;
      const normalizedBgStyle: SlideBlock["bgStyle"] =
        bgStyleValue === "solid" || bgStyleValue === "glass"
          ? bgStyleValue
          : "none";
      block.bgStyle = normalizedBgStyle;
      const bgColor =
        typeof raw.bgColor === "string"
          ? raw.bgColor
          : typeof raw.backgroundColor === "string"
            ? raw.backgroundColor
            : block.bgColor ?? "#000000";
      block.bgColor = bgColor;
      const opacitySource =
        typeof raw.bgOpacity === "number"
          ? raw.bgOpacity
          : typeof raw.opacity === "number"
            ? raw.opacity
            : block.bgOpacity ?? (normalizedBgStyle === "glass" ? 0.5 : 1);
      block.bgOpacity = clamp01(opacitySource);
      const radiusSource =
        typeof raw.radius === "number"
          ? raw.radius
          : typeof raw.cornerRadius === "number"
            ? raw.cornerRadius
            : block.radius ?? 0;
      block.radius = radiusSource;
      const paddingSource =
        typeof raw.padding === "number"
          ? raw.padding
          : typeof raw.pad === "number"
            ? raw.pad
            : block.padding ?? 0;
      block.padding = paddingSource;
    }
  }

  if (isTextualBlock(kind)) {
    const shadowValue = raw.textShadow;
    const rawShadowX = typeof raw.shadowX === "number" ? raw.shadowX : undefined;
    const rawShadowY = typeof raw.shadowY === "number" ? raw.shadowY : undefined;
    const rawShadowBlur =
      typeof raw.shadowBlur === "number" ? raw.shadowBlur : undefined;
    const rawShadowColor =
      typeof raw.shadowColor === "string" ? raw.shadowColor : undefined;
    const x =
      rawShadowX ??
      (shadowValue && typeof shadowValue === "object" && typeof shadowValue.x === "number"
        ? shadowValue.x
        : block.shadowX ?? block.textShadow?.x ?? DEFAULT_TEXT_SHADOW.x);
    const y =
      rawShadowY ??
      (shadowValue && typeof shadowValue === "object" && typeof shadowValue.y === "number"
        ? shadowValue.y
        : block.shadowY ?? block.textShadow?.y ?? DEFAULT_TEXT_SHADOW.y);
    const blur =
      rawShadowBlur ??
      (shadowValue && typeof shadowValue === "object" && typeof shadowValue.blur === "number"
        ? shadowValue.blur
        : block.shadowBlur ?? block.textShadow?.blur ?? DEFAULT_TEXT_SHADOW.blur);
    const color =
      rawShadowColor ??
      (shadowValue && typeof shadowValue === "object" && typeof shadowValue.color === "string"
        ? shadowValue.color
        : block.shadowColor ?? block.textShadow?.color ?? DEFAULT_TEXT_SHADOW.color);

    block.shadowX = x;
    block.shadowY = y;
    block.shadowBlur = blur;
    block.shadowColor = color;

    if (shadowValue && typeof shadowValue === "object") {
      block.textShadow = { x, y, blur, color };
    } else if (shadowValue === null || shadowValue === false) {
      block.textShadow = null;
    } else if (block.textShadow === undefined) {
      block.textShadow = null;
    }
  }

  if (isTextualBlock(kind)) {
    const sizingSnapshot = readTextSizingConfig(workingConfig);
    (Object.keys(frames) as DeviceKind[]).forEach((device) => {
      const dims = pickTextSizingDimensions(sizingSnapshot, device);
      if (!dims) return;
      const current = frames[device];
      if (!current) return;
      if (dims.width !== undefined) current.w = clampPct(dims.width);
      if (dims.height !== undefined) current.h = clampPct(dims.height);
    });
    const sizingRecord =
      workingConfig.textSizing && typeof workingConfig.textSizing === "object"
        ? { ...(workingConfig.textSizing as Record<string, any>) }
        : {};
    if (sizingRecord.autoWidth !== true) {
      sizingRecord.autoWidth = true;
    }
    if (sizingRecord.autoHeight !== true) {
      sizingRecord.autoHeight = true;
    }
    workingConfig.textSizing = sizingRecord;
  }

  const rawShadow = raw.boxShadow ?? raw.shadowPreset ?? block.boxShadow;
  const normalizedShadow: BlockShadowPreset =
    rawShadow === "sm" || rawShadow === "md" || rawShadow === "lg" || rawShadow === "none"
      ? (rawShadow as BlockShadowPreset)
      : "none";
  block.boxShadow = normalizedShadow;

  const borderColorSource =
    typeof raw.borderColor === "string"
      ? raw.borderColor
      : typeof block.borderColor === "string"
        ? block.borderColor
        : undefined;
  block.borderColor = borderColorSource;

  const borderWidthSource =
    typeof raw.borderWidth === "number"
      ? Math.max(0, raw.borderWidth)
      : typeof block.borderWidth === "number"
        ? Math.max(0, block.borderWidth)
        : undefined;
  block.borderWidth = borderWidthSource;

  const borderRadiusSource =
    typeof raw.borderRadius === "number"
      ? Math.max(0, raw.borderRadius)
      : typeof block.borderRadius === "number"
        ? Math.max(0, block.borderRadius)
        : undefined;
  block.borderRadius = borderRadiusSource;

  const backgroundSource =
    raw.background ?? raw.blockBackground ?? raw.backgroundFill ?? block.background;
  const normalizedBackground = normalizeBlockBackground(backgroundSource);
  block.background = normalizedBackground;
  workingConfig.background = normalizedBackground;

  const configWithFont = isFontEnabledBlock(kind)
    ? applyFontFamilyToConfig(workingConfig, block.fontFamily)
    : workingConfig;
  const blockForConfig: SlideBlock = { ...block, config: configWithFont };
  block.config = mergeInteractionConfig(blockForConfig, configWithFont);

  return block;
}

function normalizeConfig(raw: any, slide: SlideRow): SlideCfg {
  const source = raw && typeof raw === "object" ? raw : {};
  const cfg: SlideCfg = {
    background: normalizeBackground(source.background),
    blocks: Array.isArray(source.blocks)
      ? source.blocks.map((b: any) => normalizeBlock(b, source.positions))
      : [],
  };

  if (cfg.blocks.length === 0) {
    const blocks: SlideBlock[] = [];
    if (slide.title) {
      blocks.push({
        id: crypto.randomUUID(),
        kind: "heading",
        text: slide.title,
        color: "#ffffff",
        size: "xl",
        frames: { desktop: getDefaultFrame("heading") },
      });
    }
    if (slide.subtitle) {
      blocks.push({
        id: crypto.randomUUID(),
        kind: "subheading",
        text: slide.subtitle,
        color: "#ffffff",
        size: "md",
        frames: { desktop: getDefaultFrame("subheading") },
      });
    }
    if (slide.cta_label) {
      const buttonConfig: ButtonBlockConfig = {
        ...DEFAULT_BUTTON_CONFIG,
        label: slide.cta_label,
        href: slide.cta_href ?? DEFAULT_BUTTON_CONFIG.href,
      };
      blocks.push({
        id: crypto.randomUUID(),
        kind: "button",
        text: buttonConfig.label,
        href: buttonConfig.href,
        config: buttonConfig,
        buttonVariant:
          buttonConfig.variant === "Outline" ? "secondary" : "primary",
        frames: { desktop: getDefaultFrame("button") },
      });
    }
    cfg.blocks = blocks.length
      ? blocks
      : [
          {
            id: crypto.randomUUID(),
            kind: "heading",
            text: "New Slide",
            color: "#ffffff",
            size: "xl",
            frames: { desktop: getDefaultFrame("heading") },
          },
        ];
  }

  cfg.blocks = cfg.blocks.map((block) => {
    const baseConfig = extractConfig(block.config);
    if (isFontEnabledBlock(block.kind)) {
      const normalizedFont =
        normalizeFontFamily(block.fontFamily) ??
        normalizeFontFamily(baseConfig.fontFamily) ??
        DEFAULT_TEXT_FONT_FAMILY;
      const configWithFont = applyFontFamilyToConfig(baseConfig, normalizedFont);
      const nextBlock: SlideBlock = {
        ...block,
        fontFamily: normalizedFont,
      };
      return {
        ...nextBlock,
        config: mergeInteractionConfig(nextBlock, configWithFont),
      };
    }
    return {
      ...block,
      config: mergeInteractionConfig(block, baseConfig),
    };
  });

  return cfg;
}

interface SlideModalProps {
  slide: SlideRow;
  initialCfg: SlideCfg | Record<string, any> | null;
  onSave: (cfg: SlideCfg) => Promise<void> | void;
  onClose: () => void;
}

type GalleryInspectorItemContentProps = {
  item: GalleryBlockItem;
  itemKey: string;
  onAltChange: (value: string) => void;
  onRemove: () => void;
  dragHandleAttributes?: DraggableAttributes;
  dragHandleListeners?: React.HTMLAttributes<HTMLButtonElement>;
  dragHandleRef?: (instance: HTMLButtonElement | null) => void;
  isDragging?: boolean;
  disableInteractions?: boolean;
  style?: React.CSSProperties;
};

const GalleryInspectorItemContent = React.forwardRef<
  HTMLDivElement,
  GalleryInspectorItemContentProps
>(
  (
    {
      item,
      itemKey,
      onAltChange,
      onRemove,
      dragHandleAttributes,
      dragHandleListeners,
      dragHandleRef,
      isDragging = false,
      disableInteractions = false,
      style,
    },
    ref,
  ) => {
    const thumbnailSize = inspectorLayout.controlHeight * 1.5;
    const handleSize = inspectorLayout.controlHeight;
    const itemPadding = tokens.spacing.xs;

    const classes = [
      "gallery-item",
      isDragging ? "gallery-item--dragging" : "",
      disableInteractions ? "gallery-item--disabled" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={ref} data-gallery-key={itemKey} className={classes} style={style}>
        <ControlRow label="">
          <div className="gallery-item-row">
            <button
              type="button"
              aria-label="Drag to reorder image"
              className="gallery-item-handle"
              ref={dragHandleRef}
              {...(dragHandleAttributes ?? {})}
              {...(dragHandleListeners ?? {})}
              disabled={disableInteractions}
            >
              <GripVertical size={tokens.spacing.md} />
            </button>
            <div className="gallery-item-thumbnail-wrapper">
              <img
                src={item.url}
                alt={item.alt ?? ""}
                className="gallery-item-thumbnail"
                draggable={false}
              />
            </div>
            <div className="gallery-item-fields">
              <label
                className="gallery-item-alt-label"
                htmlFor={`gallery-alt-${itemKey}`}
              >
                Alt text
              </label>
              <input
                id={`gallery-alt-${itemKey}`}
                className="gallery-item-alt-input"
                type="text"
                value={item.alt ?? ""}
                placeholder="Describe the image"
                onChange={(event) => onAltChange(event.target.value)}
                disabled={disableInteractions}
              />
              <div className="gallery-item-actions">
                <InspectorInlineButton
                  tone="danger"
                  onClick={onRemove}
                  disabled={disableInteractions}
                  className="gallery-item-remove"
                >
                  Remove
                </InspectorInlineButton>
              </div>
            </div>
          </div>
        </ControlRow>
        <style jsx>{`
          .gallery-item {
            display: flex;
            flex-direction: column;
            padding: ${itemPadding}px;
            border-radius: ${inspectorLayout.radius}px;
            border: ${inspectorLayout.borderWidth}px solid ${inspectorColors.border};
            background: ${inspectorColors.background};
            transition: box-shadow 0.2s ease, border-color 0.2s ease;
          }

          .gallery-item--dragging {
            border-color: rgba(16, 185, 129, 0.4);
            box-shadow: ${tokens.shadow.md};
          }

          .gallery-item--disabled {
            pointer-events: none;
          }

          .gallery-item-row {
            display: grid;
            grid-template-columns: auto auto 1fr;
            align-items: center;
            gap: ${tokens.spacing.sm}px;
            width: 100%;
          }

          .gallery-item-handle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: ${handleSize}px;
            height: ${handleSize}px;
            border-radius: ${inspectorLayout.radius}px;
            border: ${inspectorLayout.borderWidth}px solid transparent;
            background: transparent;
            color: ${inspectorColors.labelMuted};
            cursor: grab;
            transition: border-color 0.2s ease, color 0.2s ease,
              box-shadow 0.2s ease;
          }

          .gallery-item-handle:focus-visible {
            outline: 2px solid #10b981;
            outline-offset: 2px;
          }

          .gallery-item-handle:not(:disabled):hover {
            border-color: rgba(15, 23, 42, 0.24);
            color: ${inspectorColors.text};
            box-shadow: ${tokens.shadow.sm};
          }

          .gallery-item-handle:not(:disabled):active {
            cursor: grabbing;
          }

          .gallery-item-handle:disabled {
            cursor: not-allowed;
            opacity: ${tokens.opacity[50]};
            box-shadow: none;
          }

          .gallery-item-thumbnail-wrapper {
            width: ${thumbnailSize}px;
            height: ${thumbnailSize}px;
            border-radius: ${tokens.radius.sm}px;
            overflow: hidden;
            border: ${inspectorLayout.borderWidth}px solid ${inspectorColors.border};
            flex-shrink: 0;
            display: flex;
          }

          .gallery-item-thumbnail {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .gallery-item-fields {
            display: flex;
            flex-direction: column;
            gap: ${tokens.spacing.xs}px;
            align-items: flex-end;
            width: 100%;
          }

          .gallery-item-alt-label {
            font-size: 0.75rem;
            font-weight: 500;
            color: ${inspectorColors.label};
            align-self: stretch;
            text-align: right;
          }

          .gallery-item-alt-input {
            width: 100%;
            height: ${inspectorLayout.controlHeight}px;
            border-radius: ${inspectorLayout.radius}px;
            border: ${inspectorLayout.borderWidth}px solid ${inspectorColors.border};
            padding: 0 ${tokens.spacing.sm}px;
            font-size: 0.875rem;
            color: ${inspectorColors.text};
            background: ${inspectorColors.background};
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
          }

          .gallery-item-alt-input::placeholder {
            color: ${inspectorColors.labelMuted};
          }

          .gallery-item-alt-input:focus-visible {
            outline: 2px solid #10b981;
            outline-offset: 2px;
          }

          .gallery-item-alt-input:disabled {
            opacity: ${tokens.opacity[50]};
            cursor: not-allowed;
          }

          .gallery-item-actions {
            display: flex;
            justify-content: flex-end;
            width: 100%;
          }

          .gallery-item-remove {
            width: auto !important;
            align-self: flex-end;
          }
        `}</style>
      </div>
    );
  },
);

GalleryInspectorItemContent.displayName = "GalleryInspectorItemContent";

type GalleryInspectorItemProps = {
  item: GalleryBlockItem;
  itemKey: string;
  index: number;
  onAltChange: (value: string) => void;
  onRemove: () => void;
};

const GalleryInspectorItem: React.FC<GalleryInspectorItemProps> = ({
  item,
  itemKey,
  index,
  onAltChange,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${index}`,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <GalleryInspectorItemContent
      ref={setNodeRef}
      item={item}
      itemKey={itemKey}
      onAltChange={onAltChange}
      onRemove={onRemove}
      dragHandleAttributes={attributes}
      dragHandleListeners={
        listeners as React.HTMLAttributes<HTMLButtonElement>
      }
      dragHandleRef={setActivatorNodeRef}
      style={style}
    />
  );
};

export default function SlideModal({
  slide,
  initialCfg,
  onSave,
  onClose,
}: SlideModalProps) {
  const restaurantId = slide.restaurant_id;
  const [cfg, setCfg] = useState<SlideCfg>(() =>
    normalizeConfig(initialCfg ?? {}, slide),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [activeDevice, setActiveDevice] = useState<DeviceKind>("desktop");
  const [editInPreview, setEditInPreview] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [customPages, setCustomPages] = useState<LinkOption[]>([]);
  const [uploading, setUploading] = useState(false);
  const [galleryUrlInput, setGalleryUrlInput] = useState("");
  const [activeGalleryDragId, setActiveGalleryDragId] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const pastRef = useRef<SlideCfg[]>([]);
  const futureRef = useRef<SlideCfg[]>([]);
  const [, forceHistoryTick] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const blockImageInputRef = useRef<HTMLInputElement | null>(null);
  const videoPosterInputRef = useRef<HTMLInputElement | null>(null);
  const galleryItemIdentityRef = useRef<
    { url: string; alt: string; key: string }[]
  >([]);

  const isManipulatingRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const inspectorOpenRef = useRef(inspectorOpen);
  const inspectorWasOpenRef = useRef(false);
  const reviewOptions = DEFAULT_REVIEW_OPTIONS;

  const shadowPresetCacheRef = useRef<Record<string, BlockShadowPreset>>({});
  const borderCacheRef = useRef<
    Record<string, { color?: string; width?: number; radius?: number }>
  >({});
  const backgroundTypeCacheRef = useRef<Record<string, BlockBackground["type"]>>({});
  const animationTypeCacheRef = useRef<Record<string, BlockAnimationType>>({});
  const transitionHoverCacheRef = useRef<Record<string, BlockHoverTransition>>({});

  useEffect(() => {
    inspectorOpenRef.current = inspectorOpen;
  }, [inspectorOpen]);

  useEffect(() => {
    setCfg(normalizeConfig(initialCfg ?? {}, slide));
    setSelectedId(null);
    setInspectorOpen(false);
    isManipulatingRef.current = false;
    pastRef.current = [];
    futureRef.current = [];
    forceHistoryTick((v) => v + 1);
  }, [initialCfg, slide]);

  useEffect(() => {
    if (!restaurantId) {
      setCustomPages([]);
      return;
    }
    supabase
      .from("custom_pages")
      .select("slug, title")
      .eq("restaurant_id", restaurantId)
      .order("slug")
      .then(({ data }) => {
        if (!data) {
          setCustomPages([]);
          return;
        }
        setCustomPages(
          data.map((row) => {
            const title = typeof row.title === "string" ? row.title.trim() : "";
            return {
              value: `/p/${row.slug}`,
              label: title.length > 0 ? title : row.slug,
            } satisfies LinkOption;
          }),
        );
      });
  }, [restaurantId]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const node = previewContainerRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setPreviewSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setPreviewSize({ width, height });
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const pushHistory = useCallback((snapshot: SlideCfg) => {
    pastRef.current.push(snapshot);
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
    forceHistoryTick((v) => v + 1);
  }, []);

  const handlePreviewChange = useCallback(
    (next: SlideCfg, options?: SlidesManagerChangeOptions) => {
      setCfg((prev) => {
        if (prev === next) return prev;
        if (options?.commit) {
          pushHistory(cloneCfg(prev));
        }
        return next;
      });
    },
    [pushHistory],
  );

  const updateCfg = useCallback(
    (mutator: (prev: SlideCfg) => SlideCfg, commit = true) => {
      setCfg((prev) => {
        const next = mutator(prev);
        if (next === prev) return prev;
        if (commit) {
          pushHistory(cloneCfg(prev));
        }
        return next;
      });
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    setCfg((current) => {
      const previous = pastRef.current.pop();
      if (!previous) return current;
      futureRef.current.push(cloneCfg(current));
      forceHistoryTick((v) => v + 1);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setCfg((current) => {
      const next = futureRef.current.pop();
      if (!next) return current;
      pastRef.current.push(cloneCfg(current));
      forceHistoryTick((v) => v + 1);
      return next;
    });
  }, []);

  const addBlock = (kind: SlideBlock["kind"]) => {
    const id = crypto.randomUUID();
    const frame = getDefaultFrame(kind);
    const block: SlideBlock = {
      id,
      kind,
      text:
        kind === "heading" ||
        kind === "subheading" ||
        kind === "text" ||
        kind === "quote"
          ? DEFAULT_TEXT_PLACEHOLDER
          : kind === "button"
            ? "Button"
            : "",
      href: kind === "button" ? "/menu" : undefined,
      frames: { [activeDevice]: frame },
      color:
        kind === "heading" || kind === "subheading" || kind === "text"
          ? "#ffffff"
          : undefined,
      size:
        kind === "heading"
          ? "xl"
          : kind === "subheading"
            ? "md"
            : kind === "text"
              ? "sm"
              : undefined,
      fit: kind === "image" ? "cover" : undefined,
      items: kind === "gallery" ? [] : undefined,
    };
    if (kind === "button") {
      const buttonConfig: ButtonBlockConfig = { ...DEFAULT_BUTTON_CONFIG };
      block.config = buttonConfig;
      block.text = buttonConfig.label;
      block.href = buttonConfig.href;
      block.buttonVariant =
        buttonConfig.variant === "Outline" ? "secondary" : "primary";
    }
    if (kind === "image") {
      const imageConfig: ImageBlockConfig = { ...DEFAULT_IMAGE_CONFIG };
      block.config = imageConfig;
      block.src = imageConfig.url;
      block.fit = imageConfig.fit;
      block.radius = imageConfig.radius;
      block.alt = imageConfig.alt;
      block.aspectRatio = imageConfig.aspectRatio;
    }
    if (kind === "gallery") {
      const galleryConfig: GalleryBlockConfig = { ...DEFAULT_GALLERY_CONFIG };
      block.config = galleryConfig;
      block.items = galleryConfig.items.map((item) => ({
        src: item.url,
        alt: item.alt ?? "",
      }));
      block.radius = galleryConfig.radius;
      block.aspectRatio = galleryConfig.aspectRatio;
    }
    if (kind === "quote") {
      const quoteConfig: QuoteBlockConfig = {
        ...DEFAULT_QUOTE_CONFIG,
        text: block.text ?? DEFAULT_QUOTE_CONFIG.text,
      };
      block.config = quoteConfig;
      block.text = quoteConfig.text;
      block.content = quoteConfig.text;
      block.author = quoteConfig.author;
      block.align = quoteConfig.align;
      block.bgColor = quoteConfig.bgColor;
      block.bgOpacity = quoteConfig.bgOpacity;
      block.radius = quoteConfig.radius;
      block.padding = quoteConfig.padding;
    }
    if (kind === "heading" || kind === "subheading" || kind === "text") {
      const initialContent = block.text ?? "";
      block.content = initialContent;
      block.fontFamily = DEFAULT_TEXT_FONT_FAMILY;
      block.fontWeight =
        kind === "heading" ? 700 : kind === "subheading" ? 600 : 400;
      block.fontSize = block.size
        ? SIZE_TO_FONT_SIZE_PX[block.size]
        : kind === "heading"
          ? 56
          : kind === "subheading"
            ? SIZE_TO_FONT_SIZE_PX.md
            : 16;
      block.lineHeight = undefined;
      block.lineHeightUnit = undefined;
      block.textColor = block.color ?? "#ffffff";
      block.color = block.textColor;
      if (kind === "heading" || kind === "text") {
        block.textShadow = null;
        block.bgStyle = "none";
        block.bgColor = "#000000";
        block.bgOpacity = 1;
        block.radius = 0;
        block.padding = 0;
      }
    }
    let baseConfig = extractConfig(block.config);
    if (isFontEnabledBlock(kind)) {
      const normalizedFont =
        normalizeFontFamily(block.fontFamily) ?? DEFAULT_TEXT_FONT_FAMILY;
      block.fontFamily = normalizedFont;
      baseConfig = applyFontFamilyToConfig(baseConfig, normalizedFont);
    }
    if (isTextualBlock(kind)) {
      const sizing =
        baseConfig.textSizing && typeof baseConfig.textSizing === "object"
          ? { ...(baseConfig.textSizing as Record<string, any>) }
          : {};
      if (typeof sizing.autoWidth !== "boolean") {
        sizing.autoWidth = true;
      }
      baseConfig.textSizing = sizing;
      if (kind === "heading" || kind === "subheading" || kind === "text") {
        const initialText = block.text ?? "";
        baseConfig.text = initialText;
        baseConfig.content = initialText;
      }
    }
    block.config = mergeInteractionConfig(block, baseConfig);
    updateCfg((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    handleSelectBlock(id, { openInspector: true });
  };

  const removeBlock = (id: string) => {
    updateCfg((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== id),
    }));
    if (selectedIdRef.current === id) {
      handleSelectBlock(null);
    }
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    updateCfg((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const swap = idx + direction;
      if (swap < 0 || swap >= prev.blocks.length) return prev;
      const blocks = [...prev.blocks];
      const [item] = blocks.splice(idx, 1);
      blocks.splice(swap, 0, item);
      return { ...prev, blocks };
    });
  };

  const patchBlock = (
    id: string,
    patch: Partial<SlideBlock>,
    commit = true,
  ) => {
    updateCfg(
      (prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => {
          if (b.id !== id) return b;
          let nextBlock: SlideBlock = { ...b, ...patch };
          let nextConfig = extractConfig(b.config);
          let shouldMergeConfig = false;

          if ("background" in patch) {
            const normalizedBackground = normalizeBlockBackground(patch.background);
            nextBlock = { ...nextBlock, background: normalizedBackground };
            nextConfig = { ...nextConfig, background: normalizedBackground };
            shouldMergeConfig = true;
          }

          if ("fontFamily" in patch && isFontEnabledBlock(b.kind)) {
            const normalizedFont =
              normalizeFontFamily(nextBlock.fontFamily) ?? DEFAULT_TEXT_FONT_FAMILY;
            nextBlock = { ...nextBlock, fontFamily: normalizedFont };
            nextConfig = applyFontFamilyToConfig(nextConfig, normalizedFont);
            shouldMergeConfig = true;
          }

          if (isTextualBlock(b.kind)) {
            const textValue =
              typeof patch.content === "string"
                ? patch.content
                : typeof patch.text === "string"
                  ? patch.text
                  : typeof nextBlock.content === "string"
                    ? nextBlock.content
                    : typeof nextBlock.text === "string"
                      ? nextBlock.text
                      : "";
            const updatedConfig = updateConfigWithTextContent(
              { ...nextBlock, config: nextConfig },
              textValue,
            );
            if (updatedConfig) {
              nextConfig = extractConfig(updatedConfig);
            }
            shouldMergeConfig = true;
          }

          if (shouldMergeConfig) {
            const mergedConfig = mergeInteractionConfig(
              { ...nextBlock, config: nextConfig },
              nextConfig,
            );
            return {
              ...nextBlock,
              config: mergedConfig,
            };
          }

          return nextBlock;
        }),
      }),
      commit,
    );
  };

  const resolveFontFamilyValue = (
    value?: SlideBlock["fontFamily"],
  ): SlideBlock["fontFamily"] => {
    const normalized = normalizeFontFamily(value);
    if (!normalized) {
      return DEFAULT_TEXT_FONT_FAMILY;
    }
    const match = APP_FONTS.find(
      (font) => normalizeFontFamily(font.id) === normalized,
    );
    return match ? match.id : DEFAULT_TEXT_FONT_FAMILY;
  };

  const handleFontFamilyChange = (blockId: string, rawValue: string) => {
    const normalized = normalizeFontFamily(rawValue) ?? DEFAULT_TEXT_FONT_FAMILY;
    patchBlock(blockId, { fontFamily: normalized });
  };

  const updateButtonConfig = (
    id: string,
    mutator: (prev: ButtonBlockConfig) => ButtonBlockConfig,
    commit = true,
  ) => {
    updateCfg(
      (prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => {
          if (b.id !== id) return b;
          const current = resolveButtonConfig(b);
          const nextConfig = mutator({ ...current });
          const previous = extractConfig(b.config);
          const candidate = { ...previous, ...nextConfig };
          return {
            ...b,
            config: mergeInteractionConfig({ ...b, config: candidate }, candidate),
            text: nextConfig.label,
            href: nextConfig.href,
            buttonVariant:
              nextConfig.variant === "Outline" ? "secondary" : "primary",
          };
        }),
      }),
      commit,
    );
  };

  const updateImageConfig = (
    id: string,
    mutator: (prev: ImageBlockConfig) => ImageBlockConfig,
    commit = true,
  ) => {
    updateCfg(
      (prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => {
          if (b.id !== id) return b;
          if (b.kind !== "image") return b;
          const current = resolveImageConfig(b);
          const next = mutator({ ...current });
          const sanitized: ImageBlockConfig = {
            url:
              typeof next.url === "string"
                ? next.url.trim()
                : DEFAULT_IMAGE_CONFIG.url,
            fit: next.fit === "contain" ? "contain" : "cover",
            focalX:
              typeof next.focalX === "number"
                ? clamp01(next.focalX)
                : DEFAULT_IMAGE_CONFIG.focalX,
            focalY:
              typeof next.focalY === "number"
                ? clamp01(next.focalY)
                : DEFAULT_IMAGE_CONFIG.focalY,
            radius:
              typeof next.radius === "number"
                ? Math.max(0, next.radius)
                : DEFAULT_IMAGE_CONFIG.radius,
            shadow: Boolean(next.shadow),
            alt:
              typeof next.alt === "string"
                ? next.alt
                : DEFAULT_IMAGE_CONFIG.alt,
            aspectRatio: normalizeBlockAspectRatio(
              next.aspectRatio,
              DEFAULT_IMAGE_CONFIG.aspectRatio,
            ),
          };
          const previous = extractConfig(b.config);
          const candidate = { ...previous, ...sanitized };
          return {
            ...b,
            src: sanitized.url,
            fit: sanitized.fit,
            radius: sanitized.radius,
            alt: sanitized.alt,
            aspectRatio: sanitized.aspectRatio,
            config: mergeInteractionConfig({ ...b, config: candidate }, candidate),
          };
        }),
      }),
      commit,
    );
  };

  const updateGalleryConfig = (
    id: string,
    mutator: (prev: GalleryBlockConfig) => GalleryBlockConfig,
    commit = true,
  ) => {
    updateCfg(
      (prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => {
          if (b.id !== id) return b;
          if (b.kind !== "gallery") return b;
          const current = resolveGalleryConfig(b);
          const next = mutator({ ...current });
          const sanitizedItems = Array.isArray(next.items)
            ? next.items
                .map((item): GalleryBlockItem | null => {
                  if (!item) return null;
                  const urlSource =
                    typeof item.url === "string"
                      ? item.url
                      : typeof (item as any).src === "string"
                        ? (item as any).src
                        : "";
                  const url = urlSource.trim();
                  if (!url) return null;
                  const altRaw =
                    typeof (item as any).alt === "string"
                      ? (item as any).alt
                      : "";
                  const alt = altRaw.trim().length > 0 ? altRaw : "";
                  const normalized: GalleryBlockItem = {
                    url,
                    alt,
                  };
                  return normalized;
                })
                .filter((item): item is GalleryBlockItem => Boolean(item))
            : [];
          const intervalRaw =
            typeof next.interval === "number"
              ? next.interval
              : Number(next.interval);
          const radiusRaw =
            typeof next.radius === "number"
              ? next.radius
              : Number(next.radius);
          const intervalCandidate =
            Number.isFinite(intervalRaw) && intervalRaw > 0
              ? Math.round(intervalRaw)
              : DEFAULT_GALLERY_CONFIG.interval;
          const intervalSeconds = Math.min(
            MAX_GALLERY_AUTOPLAY_INTERVAL,
            Math.max(MIN_GALLERY_AUTOPLAY_INTERVAL, intervalCandidate),
          );
          const radiusCandidate =
            Number.isFinite(radiusRaw) && radiusRaw >= 0
              ? radiusRaw
              : DEFAULT_GALLERY_CONFIG.radius;
          const sanitized: GalleryBlockConfig = {
            items: sanitizedItems,
            layout: next.layout === "carousel" ? "carousel" : "grid",
            autoplay:
              next.layout === "carousel" ? Boolean(next.autoplay) : false,
            interval: intervalSeconds,
            radius: radiusCandidate,
            shadow: Boolean(next.shadow),
            aspectRatio: normalizeBlockAspectRatio(
              next.aspectRatio,
              DEFAULT_GALLERY_CONFIG.aspectRatio,
            ),
          };
          const previous = extractConfig(b.config);
          const candidate = { ...previous, ...sanitized };
          return {
            ...b,
            config: mergeInteractionConfig({ ...b, config: candidate }, candidate),
            items: sanitized.items.map((item) => ({
              src: item.url,
              alt: item.alt ?? "",
            })),
            radius: sanitized.radius,
            aspectRatio: sanitized.aspectRatio,
          };
        }),
      }),
      commit,
    );
  };

  const updateQuoteConfig = (
    id: string,
    mutator: (prev: QuoteBlockConfig) => QuoteBlockConfig,
    commit = true,
  ) => {
    updateCfg(
      (prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => {
          if (b.id !== id) return b;
          if (b.kind !== "quote") return b;
          const current = resolveQuoteConfig(b);
          const next = mutator({ ...current });
          const normalized = resolveQuoteConfig({
            ...b,
            config: next,
            text: next.text,
            author: next.author,
            align: next.align,
            bgColor: next.bgColor,
            bgOpacity: next.bgOpacity,
            radius: next.radius,
            padding: next.padding,
          });
          const previous = extractConfig(b.config);
          const candidate = { ...previous, ...normalized };
          return {
            ...b,
            text: normalized.text,
            author: normalized.author,
            align: normalized.align,
            bgColor: normalized.bgColor,
            bgOpacity: normalized.bgOpacity,
            radius: normalized.radius,
            padding: normalized.padding,
            config: mergeInteractionConfig({ ...b, config: candidate }, candidate),
          };
        }),
      }),
      commit,
    );
  };

  const updateVisibilityConfig = (
    id: string,
    mutator: (prev: BlockVisibilityConfig) => BlockVisibilityConfig,
    commit = true,
  ) => {
    updateCfg(
      (prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => {
          if (b.id !== id) return b;
          const current = resolveBlockVisibility(b);
          const next = mutator({ ...current });
          const normalized: BlockVisibilityConfig = {
            mobile: next.mobile,
            tablet: next.tablet,
            desktop: next.desktop,
          };
          const previous = extractConfig(b.config);
          const candidate = { ...previous, visibleOn: normalized };
          return {
            ...b,
            config: mergeInteractionConfig({ ...b, config: candidate }, candidate),
          };
        }),
      }),
      commit,
    );
  };

  const updateBackground = useCallback(
    (
      mutator: (
        prev: SlideCfg["background"] | undefined,
      ) => SlideCfg["background"] | undefined,
      commit = true,
    ) => {
      updateCfg(
        (prev) => ({
          ...prev,
          background: mutator(prev.background),
        }),
        commit,
      );
    },
    [updateCfg],
  );

  const handleManipulationChange = useCallback((manipulating: boolean) => {
    isManipulatingRef.current = manipulating;
    if (manipulating) {
      inspectorWasOpenRef.current = inspectorOpenRef.current;
      if (inspectorOpenRef.current) {
        setInspectorOpen(false);
      }
    } else {
      if (inspectorWasOpenRef.current && selectedIdRef.current) {
        setInspectorOpen(true);
      }
      inspectorWasOpenRef.current = false;
    }
  }, []);

  const handleSelectBlock = useCallback(
    (id: string | null, options?: { openInspector?: boolean }) => {
      setSelectedId(id);
      selectedIdRef.current = id;
      const shouldOpen = Boolean(options?.openInspector);
      inspectorWasOpenRef.current = shouldOpen;
      if (!id) {
        setInspectorOpen(false);
        return;
      }
      if (isManipulatingRef.current) {
        if (!shouldOpen) {
          setInspectorOpen(false);
        }
        return;
      }
      setInspectorOpen(shouldOpen);
    },
    [],
  );

  const openInspectorForSelection = useCallback(() => {
    if (isManipulatingRef.current) return;
    if (!selectedIdRef.current) return;
    inspectorWasOpenRef.current = true;
    setInspectorOpen(true);
  }, []);

  const handleCanvasClick = useCallback(() => {
    handleSelectBlock(null);
  }, [handleSelectBlock]);

  const handleLayerSelect = useCallback(
    (id: string) => {
      handleSelectBlock(id, { openInspector: true });
    },
    [handleSelectBlock],
  );

  const handleDuplicateBlock = useCallback(
    (id: string) => {
      const newId = crypto.randomUUID();
      updateCfg((prev) => {
        const index = prev.blocks.findIndex((b) => b.id === id);
        if (index === -1) return prev;
        const source = prev.blocks[index];
        const clone: SlideBlock = JSON.parse(JSON.stringify(source));
        clone.id = newId;
        clone.locked = false;
        const blocks = [...prev.blocks];
        blocks.splice(index + 1, 0, clone);
        return { ...prev, blocks };
      });
      handleSelectBlock(newId, { openInspector: true });
    },
    [handleSelectBlock, updateCfg],
  );

  const toggleBlockLock = useCallback(
    (id: string) => {
      updateCfg((prev) => ({
        ...prev,
        blocks: prev.blocks.map((block) =>
          block.id === id ? { ...block, locked: !block.locked } : block,
        ),
      }));
    },
    [updateCfg],
  );

  const handleInspectorDone = useCallback(() => {
    handleSelectBlock(null);
  }, [handleSelectBlock]);

  const blurActiveTextInput = useCallback(() => {
    if (typeof document === "undefined") return;
    const activeElement = document.activeElement;
    if (!activeElement) return;
    if (
      isTextualInteractiveElement(activeElement) &&
      activeElement instanceof HTMLElement
    ) {
      activeElement.blur();
    }
  }, []);

  const handleInspectorPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const interactiveTarget = target.closest(
        "input, textarea, select, button, [contenteditable=\"true\"]",
      ) as HTMLElement | null;

      if (isTextualInteractiveElement(interactiveTarget)) {
        return;
      }

      if (interactiveTarget) {
        blurActiveTextInput();
        return;
      }

      const labelTarget = target.closest("label");
      if (labelTarget) {
        const containsTextField = labelTarget.querySelector(
          TEXTUAL_INPUT_SELECTOR,
        );
        if (containsTextField) {
          event.preventDefault();
          blurActiveTextInput();
          return;
        }
      }

      blurActiveTextInput();
    },
    [blurActiveTextInput],
  );

  useEffect(() => {
    blurActiveTextInput();
  }, [blurActiveTextInput, selectedId]);

  const handleBackgroundTypeChange = useCallback(
    (type: SlideBackground["type"]) => {
      updateBackground((prev) => {
        if (type === "none") {
          return { type: "none" };
        }
        if (type === "color") {
          const prevColor = prev?.type === "color" ? prev : undefined;
          return {
            type: "color",
            color: prevColor?.color || "#111111",
            opacity:
              typeof prevColor?.opacity === "number"
                ? clamp01(prevColor.opacity)
                : 1,
          };
        }
        if (type === "image") {
          const prevImage = prev?.type === "image" ? prev : undefined;
          return {
            type: "image",
            url: prevImage?.url,
            fit: prevImage?.fit || "cover",
            focal: prevImage?.focal || { x: 0.5, y: 0.5 },
            overlay: prevImage?.overlay,
            blur:
              typeof prevImage?.blur === "number"
                ? clampRange(prevImage.blur, 0, 12)
                : 0,
          };
        }
        if (type === "video") {
          const prevVideo = prev?.type === "video" ? prev : undefined;
          return {
            type: "video",
            url: prevVideo?.url,
            fit: prevVideo?.fit || "cover",
            focal: prevVideo?.focal || { x: 0.5, y: 0.5 },
            overlay: prevVideo?.overlay,
            blur:
              typeof prevVideo?.blur === "number"
                ? clampRange(prevVideo.blur, 0, 12)
                : 0,
            poster: prevVideo?.poster,
            loop: prevVideo?.loop ?? true,
            mute: prevVideo?.mute ?? true,
            autoplay: prevVideo?.autoplay ?? true,
          };
        }
        return prev ?? defaultBackground();
      });
    },
    [updateBackground],
  );

  const handleUpload = async (file: File, onUrl: (url: string) => void) => {
    if (!restaurantId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `slides/${restaurantId}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(data.path);
      if (pub?.publicUrl) onUrl(pub.publicUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(cfg);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const { width: deviceWidth, height: deviceHeight } =
    DEVICE_DIMENSIONS[activeDevice] ?? DEVICE_DIMENSIONS.desktop;
  const availableWidth = Math.max(previewSize.width - PREVIEW_PADDING_X * 2, 0);
  const availableHeight = Math.max(previewSize.height - PREVIEW_PADDING_Y * 2, 0);
  const fitScale = useMemo(() => {
    if (availableWidth <= 0 || availableHeight <= 0) return 1;
    const widthScale = availableWidth / deviceWidth;
    const heightScale = availableHeight / deviceHeight;
    const computed = Math.min(widthScale, heightScale, 1);
    if (!Number.isFinite(computed) || computed <= 0) return 1;
    return computed;
  }, [availableWidth, availableHeight, deviceHeight, deviceWidth]);
  const clampZoomValue = useCallback(
    (value: number) => clampRange(value, ZOOM_MIN, ZOOM_MAX),
    [],
  );
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => clampZoomValue(prev + ZOOM_STEP));
  }, [clampZoomValue]);
  const handleZoomOut = useCallback(() => {
    setZoom((prev) => clampZoomValue(prev - ZOOM_STEP));
  }, [clampZoomValue]);
  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);
  const previewScale = useMemo(() => {
    const computed = fitScale * zoom;
    if (!Number.isFinite(computed) || computed <= 0) {
      return fitScale;
    }
    return computed;
  }, [fitScale, zoom]);

  const selectedBlock = useMemo(
    () => cfg.blocks.find((b) => b.id === selectedId) || null,
    [cfg.blocks, selectedId],
  );

  useEffect(() => {
    if (!selectedBlock || !isFontEnabledBlock(selectedBlock.kind)) {
      return;
    }
    const normalized = normalizeFontFamily(selectedBlock.fontFamily);
    if (!normalized) {
      return;
    }
    const match = APP_FONTS.find(
      (font) => normalizeFontFamily(font.id) === normalized,
    );
    if (match) {
      void ensureFontLoaded(match);
    }
  }, [selectedBlock]);

  const layerEntries = useMemo(
    () => cfg.blocks.map((block, index) => ({ block, index })),
    [cfg.blocks],
  );

  const selectedButtonConfig = useMemo(
    () =>
      selectedBlock?.kind === "button"
        ? resolveButtonConfig(selectedBlock)
        : null,
    [selectedBlock],
  );

  const selectedImageConfig = useMemo(
    () =>
      selectedBlock?.kind === "image"
        ? resolveImageConfig(selectedBlock)
        : null,
    [selectedBlock],
  );

  const selectedImageAspectRatio = useMemo(
    () =>
      selectedImageConfig
        ? getAspectRatioValue(selectedImageConfig.aspectRatio)
        : undefined,
    [selectedImageConfig],
  );

  const selectedGalleryConfig = useMemo(
    () =>
      selectedBlock?.kind === "gallery"
        ? resolveGalleryConfig(selectedBlock)
        : null,
    [selectedBlock],
  );

  const galleryRenderedItems = useMemo(
    () => (selectedGalleryConfig ? selectedGalleryConfig.items : []),
    [selectedGalleryConfig],
  );

  const isGalleryCarousel =
    selectedGalleryConfig?.layout === "carousel";

  const createGalleryItemKey = useCallback(() => {
    if (
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.randomUUID === "function"
    ) {
      return `gallery-item-${globalThis.crypto.randomUUID()}`;
    }
    return `gallery-item-${Math.random().toString(36).slice(2)}`;
  }, []);

  const galleryItemIdentities = useMemo(() => {
    if (!galleryRenderedItems.length) {
      galleryItemIdentityRef.current = [];
      return [] as { url: string; alt: string; key: string }[];
    }
    const previous = galleryItemIdentityRef.current;
    const used = new Set<number>();
    const nextIdentities = galleryRenderedItems.map((item) => {
      const altValue = item.alt ?? "";
      const exactIndex = previous.findIndex((identity, index) => {
        if (used.has(index)) return false;
        return identity.url === item.url && identity.alt === altValue;
      });
      if (exactIndex !== -1) {
        used.add(exactIndex);
        return previous[exactIndex];
      }
      const looseIndex = previous.findIndex((identity, index) => {
        if (used.has(index)) return false;
        return identity.url === item.url;
      });
      if (looseIndex !== -1) {
        used.add(looseIndex);
        return {
          url: item.url,
          alt: altValue,
          key: previous[looseIndex].key,
        };
      }
      return {
        url: item.url,
        alt: altValue,
        key: createGalleryItemKey(),
      };
    });
    galleryItemIdentityRef.current = nextIdentities;
    return nextIdentities;
  }, [createGalleryItemKey, galleryRenderedItems]);

  const ensureGalleryItemKey = useCallback(
    (item: GalleryBlockItem) => {
      const altValue = item.alt ?? "";
      const match = galleryItemIdentityRef.current.find(
        (identity) => identity.url === item.url && identity.alt === altValue,
      );
      if (match) {
        return match.key;
      }
      const fallback = {
        url: item.url,
        alt: altValue,
        key: createGalleryItemKey(),
      };
      galleryItemIdentityRef.current = [
        ...galleryItemIdentityRef.current,
        fallback,
      ];
      return fallback.key;
    },
    [createGalleryItemKey],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
  );

  const handleGalleryDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      if (!selectedBlock || selectedBlock.kind !== "gallery") {
        return;
      }
      setActiveGalleryDragId(String(active.id));
    },
    [selectedBlock],
  );

  const handleGalleryDragCancel = useCallback(() => {
    setActiveGalleryDragId(null);
  }, []);

  const handleGalleryDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveGalleryDragId(null);
      if (!selectedBlock || selectedBlock.kind !== "gallery") {
        return;
      }
      if (!over) {
        return;
      }
      const fromIndex = Number(active.id);
      const toIndex = Number(over.id);
      if (Number.isNaN(fromIndex) || Number.isNaN(toIndex)) {
        return;
      }
      if (fromIndex === toIndex) {
        return;
      }
      updateGalleryConfig(selectedBlock.id, (config) => ({
        ...config,
        items: arrayMove(config.items, fromIndex, toIndex),
      }));
    },
    [selectedBlock, updateGalleryConfig],
  );

  const gallerySortableIds = useMemo(
    () => galleryRenderedItems.map((_, index) => `${index}`),
    [galleryRenderedItems],
  );

  const activeGalleryDragItem = useMemo(() => {
    if (activeGalleryDragId === null) {
      return null;
    }
    const index = Number(activeGalleryDragId);
    if (Number.isNaN(index)) {
      return null;
    }
    return galleryRenderedItems[index] ?? null;
  }, [activeGalleryDragId, galleryRenderedItems]);

  const activeGalleryDragIdentity = useMemo(() => {
    if (activeGalleryDragId === null) {
      return null;
    }
    const index = Number(activeGalleryDragId);
    if (Number.isNaN(index)) {
      return null;
    }
    return galleryItemIdentities[index] ?? null;
  }, [activeGalleryDragId, galleryItemIdentities]);

  const handleAddGalleryImageByUrl = useCallback(
    (blockId: string) => {
      const url = galleryUrlInput.trim();
      if (!url) {
        return;
      }
      updateGalleryConfig(blockId, (config) => ({
        ...config,
        items: [...config.items, { url }],
      }));
      setGalleryUrlInput("");
    },
    [galleryUrlInput, updateGalleryConfig],
  );

  const galleryUrlHasValue = galleryUrlInput.trim().length > 0;

  const selectedQuoteConfig = useMemo(
    () =>
      selectedBlock?.kind === "quote"
        ? resolveQuoteConfig(selectedBlock)
        : null,
    [selectedBlock],
  );

  const selectedVisibilityConfig = useMemo(() => {
    if (!selectedBlock) {
      return { ...DEFAULT_BLOCK_VISIBILITY };
    }
    return resolveBlockVisibility(selectedBlock);
  }, [selectedBlock]);

  const selectedBlockBackground = useMemo(() => {
    if (!selectedBlock) {
      return cloneBlockBackground();
    }
    const configRecord =
      selectedBlock.config && typeof selectedBlock.config === "object"
        ? (selectedBlock.config as Record<string, any>).background
        : undefined;
    return cloneBlockBackground(configRecord ?? selectedBlock.background);
  }, [selectedBlock]);

  const updateSelectedBlockBackground = useCallback(
    (mutator: (background: BlockBackground) => BlockBackground) => {
      if (!selectedBlock) return;
      const configRecord =
        selectedBlock.config && typeof selectedBlock.config === "object"
          ? (selectedBlock.config as Record<string, any>).background
          : undefined;
      const current = cloneBlockBackground(configRecord ?? selectedBlock.background);
      const next = mutator(current);
      patchBlock(selectedBlock.id, { background: next });
    },
    [patchBlock, selectedBlock],
  );

  const applyBackgroundType = useCallback(
    (nextType: BlockBackground["type"]) => {
      updateSelectedBlockBackground((prev) => {
        const next = cloneBlockBackground(prev);
        next.type = nextType;
        if (nextType === "none") {
          return next;
        }
        if (nextType === "color") {
          next.color =
            next.color && next.color.trim().length > 0
              ? next.color
              : DEFAULT_BLOCK_BACKGROUND_COLOR;
          next.color2 = undefined;
          next.direction = undefined;
          next.url = undefined;
          return next;
        }
        if (nextType === "gradient") {
          next.color =
            next.color && next.color.trim().length > 0
              ? next.color
              : DEFAULT_BLOCK_GRADIENT_FROM;
          next.color2 =
            next.color2 && next.color2.trim().length > 0
              ? next.color2
              : DEFAULT_BLOCK_GRADIENT_TO;
          next.direction = next.direction ?? "to-bottom";
          next.url = undefined;
          return next;
        }
        if (nextType === "image") {
          next.url = next.url ?? "";
        }
        return next;
      });
    },
    [updateSelectedBlockBackground],
  );

  const selectedAnimationConfig = useMemo(
    () =>
      selectedBlock
        ? resolveBlockAnimationConfig(selectedBlock)
        : DEFAULT_BLOCK_ANIMATION_CONFIG,
    [selectedBlock],
  );

  const selectedTransitionConfig = useMemo(
    () =>
      selectedBlock
        ? resolveBlockTransitionConfig(selectedBlock)
        : DEFAULT_BLOCK_TRANSITION_CONFIG,
    [selectedBlock],
  );

  const selectedBlockId = selectedBlock?.id ?? null;
  const currentShadowPreset: BlockShadowPreset = selectedBlock?.boxShadow ?? "none";
  const borderWidthValue =
    typeof selectedBlock?.borderWidth === "number" &&
    Number.isFinite(selectedBlock.borderWidth)
      ? selectedBlock.borderWidth
      : undefined;
  const borderColorValue =
    typeof selectedBlock?.borderColor === "string" &&
    selectedBlock.borderColor.trim().length > 0
      ? selectedBlock.borderColor
      : undefined;
  const borderRadiusValue =
    typeof selectedBlock?.borderRadius === "number" &&
    Number.isFinite(selectedBlock.borderRadius)
      ? selectedBlock.borderRadius
      : undefined;
  const shadowEnabled = currentShadowPreset !== "none";
  const borderEnabled = Boolean(borderWidthValue && borderWidthValue > 0);
  const backgroundEnabled = selectedBlockBackground.type !== "none";
  const animationEnabled = selectedAnimationConfig.type !== "none";
  const transitionEnabled = selectedTransitionConfig.hover !== "none";

  useEffect(() => {
    if (!selectedBlockId) return;
    if (currentShadowPreset !== "none") {
      shadowPresetCacheRef.current[selectedBlockId] =
        currentShadowPreset as BlockShadowPreset;
    }
  }, [currentShadowPreset, selectedBlockId]);

  useEffect(() => {
    if (!selectedBlockId || !borderEnabled) return;
    borderCacheRef.current[selectedBlockId] = {
      color: borderColorValue ?? DEFAULT_BORDER_COLOR,
      width:
        typeof borderWidthValue === "number" && borderWidthValue > 0
          ? borderWidthValue
          : 1,
      radius: borderRadiusValue,
    };
  }, [borderColorValue, borderEnabled, borderRadiusValue, borderWidthValue, selectedBlockId]);

  useEffect(() => {
    if (!selectedBlockId) return;
    const type = selectedBlockBackground.type;
    if (type && type !== "none") {
      backgroundTypeCacheRef.current[selectedBlockId] = type;
    }
  }, [selectedBlockBackground.type, selectedBlockId]);

  useEffect(() => {
    if (!selectedBlockId) return;
    const type = selectedAnimationConfig.type;
    if (type && type !== "none") {
      animationTypeCacheRef.current[selectedBlockId] = type;
    }
  }, [selectedAnimationConfig.type, selectedBlockId]);

  useEffect(() => {
    if (!selectedBlockId) return;
    const hover = selectedTransitionConfig.hover;
    if (hover && hover !== "none") {
      transitionHoverCacheRef.current[selectedBlockId] = hover;
    }
  }, [selectedBlockId, selectedTransitionConfig.hover]);

  const cachedShadowPreset =
    (selectedBlockId ? shadowPresetCacheRef.current[selectedBlockId] : undefined) ??
    DEFAULT_ENABLED_SHADOW;
  const cachedBorderConfig =
    (selectedBlockId ? borderCacheRef.current[selectedBlockId] : undefined) ?? {
      color: borderColorValue ?? DEFAULT_BORDER_COLOR,
      width: borderWidthValue && borderWidthValue > 0 ? borderWidthValue : 1,
      radius: borderRadiusValue,
    };
  const cachedBackgroundType =
    (selectedBlockId ? backgroundTypeCacheRef.current[selectedBlockId] : undefined) ??
    DEFAULT_ENABLED_BACKGROUND_TYPE;
  const cachedAnimationType =
    (selectedBlockId ? animationTypeCacheRef.current[selectedBlockId] : undefined) ??
    DEFAULT_ENABLED_ANIMATION;
  const cachedTransitionHover =
    (selectedBlockId ? transitionHoverCacheRef.current[selectedBlockId] : undefined) ??
    DEFAULT_ENABLED_TRANSITION;

  const applyAnimationConfig = useCallback(
    (mutator: (prev: BlockAnimationConfig) => BlockAnimationConfig) => {
      if (!selectedBlock) return;
      const next = mutator(selectedAnimationConfig);
      const normalized: BlockAnimationConfig = {
        type: next.type,
        duration: Math.max(
          0,
          next.duration ?? DEFAULT_BLOCK_ANIMATION_CONFIG.duration,
        ),
        delay: Math.max(
          0,
          next.delay ?? DEFAULT_BLOCK_ANIMATION_CONFIG.delay,
        ),
      };
      const previous = extractConfig(selectedBlock.config);
      previous.animation = normalized;
      patchBlock(selectedBlock.id, {
        config: mergeInteractionConfig(
          { ...selectedBlock, config: previous },
          previous,
        ),
      });
    },
    [patchBlock, selectedAnimationConfig, selectedBlock],
  );

  const applyTransitionConfig = useCallback(
    (mutator: (prev: BlockTransitionConfig) => BlockTransitionConfig) => {
      if (!selectedBlock) return;
      const next = mutator(selectedTransitionConfig);
      const normalized: BlockTransitionConfig = {
        hover: next.hover,
        duration: Math.max(
          0,
          next.duration ?? DEFAULT_BLOCK_TRANSITION_CONFIG.duration,
        ),
      };
      const previous = extractConfig(selectedBlock.config);
      previous.transition = normalized;
      patchBlock(selectedBlock.id, {
        config: mergeInteractionConfig(
          { ...selectedBlock, config: previous },
          previous,
        ),
      });
    },
    [patchBlock, selectedBlock, selectedTransitionConfig],
  );

  useEffect(() => {
    if (!selectedBlock) {
      setInspectorOpen(false);
    }
  }, [selectedBlock]);

  useEffect(() => {
    setGalleryUrlInput("");
  }, [selectedBlock?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const targetIsContentEditable = target?.isContentEditable;
      if (event.key === "Escape") {
        event.preventDefault();
        handleSelectBlock(null);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !targetIsContentEditable) {
        const key = event.key.toLowerCase();
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
        if (key === "y") {
          event.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSelectBlock, redo, undo]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!selectedIdRef.current) return;
    const exists = cfg.blocks.some((block) => block.id === selectedIdRef.current);
    if (!exists) {
      handleSelectBlock(null);
    }
  }, [cfg.blocks, handleSelectBlock]);

  const linkOptions = useMemo(
    () => [...ROUTE_OPTIONS, ...customPages, CUSTOM_LINK_OPTION],
    [customPages],
  );

  const knownLinkValues = useMemo(
    () =>
      new Set(
        linkOptions
          .filter((option) => option.value !== CUSTOM_LINK_OPTION.value)
          .map((option) => option.value),
      ),
    [linkOptions],
  );

  const selectionLabel = selectedBlock
    ? BLOCK_KIND_LABELS[selectedBlock.kind] ?? selectedBlock.kind
    : "None";
  const background = cfg.background;
  const backgroundType = background?.type ?? "color";
  const colorBackground = background?.type === "color" ? background : undefined;
  const imageBackground = background?.type === "image" ? background : undefined;
  const videoBackground = background?.type === "video" ? background : undefined;
  const hasPreviewBounds = previewSize.width > 0 && previewSize.height > 0;
  const zoomPercent = Math.round(zoom * 100);
  const canZoomIn = zoom < ZOOM_MAX - 1e-3;
  const canZoomOut = zoom > ZOOM_MIN + 1e-3;
  const canResetZoom = Math.abs(zoom - 1) > 1e-3;
  const previewToolbarStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
    borderBottom: `${tokens.border.thin}px solid ${inspectorColors.border}`,
    background: "#ffffff",
    gap: tokens.spacing.md,
  };
  const zoomControlsStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacing.xs,
  };
  const zoomButtonBaseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: tokens.control.height,
    height: tokens.control.height,
    borderRadius: tokens.radius.sm,
    border: `${tokens.border.thin}px solid ${inspectorColors.border}`,
    background: "#ffffff",
    transition: "background-color 120ms ease, color 120ms ease, opacity 120ms ease",
  };
  const zoomResetButtonBaseStyle: React.CSSProperties = {
    ...zoomButtonBaseStyle,
    width: "auto",
    paddingLeft: tokens.spacing.sm,
    paddingRight: tokens.spacing.sm,
  };

  return (
    <div className="fixed inset-0 z-[80] flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-[81] m-4 flex w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] flex-1 overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex min-h-[80vh] w-full flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                className={`rounded border border-neutral-200 px-3 py-1 text-sm ${drawerOpen ? "border-emerald-500 bg-emerald-50" : ""}`}
                aria-pressed={drawerOpen}
              >
                Blocks
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={undo}
                  disabled={!canUndo}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  title="Undo (Ctrl+Z / ⌘Z)"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={!canRedo}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                  title="Redo (Ctrl+Shift+Z / ⌘+Shift+Z)"
                >
                  Redo
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <InputCheckbox
                  
                  checked={editInPreview}
                  onChange={(e) => setEditInPreview(e.target.checked)}
                />
                Edit in preview
              </label>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <button
                onClick={onClose}
                className="rounded border px-3 py-1 text-sm"
              >
                Close
              </button>
            </div>
          </header>
          <div className="flex flex-1 overflow-hidden">
            {drawerOpen && (
              <aside className="w-72 shrink-0 border-r bg-white">
                <div className="h-full space-y-6 overflow-y-auto p-4">
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-600">
                      Device
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(["mobile", "tablet", "desktop"] as DeviceKind[]).map(
                        (device) => (
                          <button
                            key={device}
                            type="button"
                            onClick={() => setActiveDevice(device)}
                            className={`rounded border px-2 py-1 text-xs capitalize ${
                              activeDevice === device
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-neutral-200"
                            }`}
                          >
                            {device}
                          </button>
                        ),
                      )}
                    </div>
                  </section>
                  <section>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                      Blocks
                    </h3>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(
                        [
                          "heading",
                          "subheading",
                          "text",
                          "button",
                          "image",
                          "quote",
                          "gallery",
                        ] as SlideBlock["kind"][]
                      ).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => addBlock(kind)}
                          className="rounded border px-2 py-1 text-left text-xs capitalize hover:border-emerald-500"
                        >
                          + {kind}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-600">
                      Layers
                    </h3>
                    <div className="space-y-1">
                      {layerEntries
                        .slice()
                        .reverse()
                        .map(({ block, index }) => {
                          const isSelected = block.id === selectedId;
                          const isBottom = index === 0;
                          const isTop = index === layerEntries.length - 1;
                          const displayIndex = layerEntries.length - index;
                          return (
                            <div
                              key={block.id}
                              className={`flex h-10 items-center gap-2 rounded border px-2 text-xs transition ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-neutral-200"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleLayerSelect(block.id)}
                              className="flex h-full flex-1 items-center gap-2 overflow-hidden text-left"
                            >
                              <span className="flex items-center gap-1 truncate capitalize">
                                {block.locked && (
                                  <LockClosedIcon className="h-3.5 w-3.5 flex-none text-neutral-500" />
                                )}
                                <span className="truncate">{block.kind}</span>
                              </span>
                              <span className="ml-auto text-[11px] text-neutral-500">
                                #{displayIndex}
                              </span>
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, 1)}
                                disabled={isTop}
                                aria-label="Bring block forward"
                                title="Bring block forward"
                                className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, -1)}
                                disabled={isBottom}
                                aria-label="Send block backward"
                                title="Send block backward"
                                className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeBlock(block.id)}
                                aria-label="Delete block"
                                title="Delete block"
                                className="flex h-7 w-7 items-center justify-center rounded border border-transparent text-neutral-500 transition hover:border-red-200 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                        })}
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-600">
                      Background
                    </h3>
                    <div className="space-y-3 text-sm">
                      <InputSelect
                        label="Type"
                        value={backgroundType}
                        onChange={(e) =>
                          handleBackgroundTypeChange(
                            e.target.value as SlideBackground["type"],
                          )
                        }
                        labelClassName="block text-xs font-medium text-neutral-500"
                        options={[
                          { value: "none", label: "None" },
                          { value: "color", label: "Color" },
                          { value: "image", label: "Image" },
                          { value: "video", label: "Video" },
                        ]}
                      />
                      {backgroundType === "color" && (
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-neutral-500">
                            Color
                            <InspectorColorInput
                              value={colorBackground?.color || "#111111"}
                              onChange={(nextColor) =>
                                updateBackground((prev) => {
                                  const next: SlideBackground =
                                    prev?.type === "color"
                                      ? { ...prev }
                                      : { type: "color", color: "#111111", opacity: 1 };
                                  next.color = nextColor;
                                  return next;
                                })
                              }
                            />
                          </label>
                          <InspectorSliderControl
                            label="Opacity"
                            value={
                              colorBackground?.opacity !== undefined
                                ? colorBackground.opacity * 100
                                : undefined
                            }
                            fallbackValue={((colorBackground?.opacity ?? 1) * 100) || 0}
                            min={0}
                            max={100}
                            step={1}
                            onChange={(next) =>
                              updateBackground((prev) => {
                                const nextBackground: SlideBackground =
                                  prev?.type === "color"
                                    ? { ...prev }
                                    : {
                                        type: "color",
                                        color: "#111111",
                                        opacity: 1,
                                      };
                                const percent =
                                  next === undefined
                                    ? (nextBackground.opacity ?? 1) * 100
                                    : next;
                                const clampedPercent = Math.min(
                                  100,
                                  Math.max(0, percent ?? 0),
                                );
                                nextBackground.opacity = clamp01(
                                  clampedPercent / 100,
                                );
                                return nextBackground;
                              })
                            }
                          />
                        </div>
                      )}
                      {backgroundType === "image" && (
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-neutral-500">
                            Image URL
                            <InputText
                              type="text"
                              value={imageBackground?.url || ""}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  const next: SlideBackground =
                                    prev?.type === "image"
                                      ? { ...prev }
                                      : {
                                          type: "image",
                                          url: "",
                                          fit: "cover",
                                          focal: { x: 0.5, y: 0.5 },
                                          blur: 0,
                                        };
                                  next.url = e.target.value;
                                  return next;
                                })
                              }
                              className={INSPECTOR_INPUT_CLASS}
                              placeholder="https://"
                            />
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              ref={imageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUpload(file, (url) =>
                                    updateBackground((prev) => {
                                      const next: SlideBackground =
                                        prev?.type === "image"
                                          ? { ...prev }
                                          : {
                                              type: "image",
                                              url: "",
                                              fit: "cover",
                                              focal: { x: 0.5, y: 0.5 },
                                              blur: 0,
                                            };
                                      next.url = url;
                                      return next;
                                    }),
                                  );
                                  e.target.value = "";
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => imageInputRef.current?.click()}
                              className="rounded border px-3 py-1 text-xs"
                            >
                              Upload
                            </button>
                            {uploading && (
                              <span className="text-xs text-neutral-500">
                                Uploading…
                              </span>
                            )}
                          </div>
                          <InputSelect
                            label="Fit"
                            value={imageBackground?.fit || "cover"}
                            onChange={(e) =>
                              updateBackground((prev) => {
                                if (prev?.type !== "image")
                                  return {
                                    type: "image",
                                    url: "",
                                    fit: e.target.value as "cover" | "contain",
                                    focal: { x: 0.5, y: 0.5 },
                                    blur: 0,
                                  };
                                return { ...prev, fit: e.target.value as "cover" | "contain" };
                              })
                            }
                            labelClassName="block text-xs font-medium text-neutral-500"
                            options={[
                              { value: "cover", label: "Cover" },
                              { value: "contain", label: "Contain" },
                            ]}
                          />
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <InputSlider
                              label="Focal X"
                              labelClassName="text-neutral-500"
                              min={0}
                              max={1}
                              step={0.01}
                              value={imageBackground?.focal?.x}
                              fallbackValue={0.5}
                              onValueChange={(next) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "image") return prev;
                                  const resolved =
                                    typeof next === "number" && Number.isFinite(next)
                                      ? clamp01(next)
                                      : 0.5;
                                  const nextFocal = {
                                    ...(prev.focal || { x: 0.5, y: 0.5 }),
                                    x: resolved,
                                  };
                                  return { ...prev, focal: nextFocal };
                                })
                              }
                              containerClassName="mt-1 flex items-center gap-2"
                              sliderClassName="flex-1"
                              numberInputClassName="w-24 shrink-0 border border-neutral-300 px-2 py-1 text-right text-xs text-neutral-900"
                              numberInputProps={{ inputMode: "decimal" }}
                            />
                            <InputSlider
                              label="Focal Y"
                              labelClassName="text-neutral-500"
                              min={0}
                              max={1}
                              step={0.01}
                              value={imageBackground?.focal?.y}
                              fallbackValue={0.5}
                              onValueChange={(next) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "image") return prev;
                                  const resolved =
                                    typeof next === "number" && Number.isFinite(next)
                                      ? clamp01(next)
                                      : 0.5;
                                  const nextFocal = {
                                    ...(prev.focal || { x: 0.5, y: 0.5 }),
                                    y: resolved,
                                  };
                                  return { ...prev, focal: nextFocal };
                                })
                              }
                              containerClassName="mt-1 flex items-center gap-2"
                              sliderClassName="flex-1"
                              numberInputClassName="w-24 shrink-0 border border-neutral-300 px-2 py-1 text-right text-xs text-neutral-900"
                              numberInputProps={{ inputMode: "decimal" }}
                            />
                          </div>
                          <label className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                            <InputCheckbox
                              
                              checked={Boolean(imageBackground?.overlay)}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "image") return prev;
                                  if (!e.target.checked) {
                                    return { ...prev, overlay: undefined };
                                  }
                                  return {
                                    ...prev,
                                    overlay: {
                                      color: prev.overlay?.color || "#000000",
                                      opacity: prev.overlay?.opacity ?? 0.25,
                                    },
                                  };
                                })
                              }
                            />
                            Overlay
                          </label>
                          {imageBackground?.overlay && (
                            <div className="space-y-2">
                              <InspectorColorInput
                                value={imageBackground.overlay.color || "#000000"}
                                onChange={(nextColor) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "image") return prev;
                                    return {
                                      ...prev,
                                      overlay: {
                                        color: nextColor,
                                        opacity: prev.overlay?.opacity ?? 0.25,
                                      },
                                    };
                                  })
                                }
                              />
                              <InspectorSliderControl
                                label="Opacity"
                                value={
                                  imageBackground.overlay.opacity !== undefined
                                    ? imageBackground.overlay.opacity * 100
                                    : undefined
                                }
                                fallbackValue={
                                  (imageBackground.overlay.opacity ?? 0.25) * 100
                                }
                                min={0}
                                max={100}
                                step={1}
                                onChange={(next) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "image") return prev;
                                    const percent =
                                      next === undefined
                                        ? (prev.overlay?.opacity ?? 0.25) * 100
                                        : next;
                                    const clampedPercent = Math.min(
                                      100,
                                      Math.max(0, percent ?? 0),
                                    );
                                    return {
                                      ...prev,
                                      overlay: {
                                        color: prev.overlay?.color || "#000000",
                                        opacity: clamp01(clampedPercent / 100),
                                      },
                                    };
                                  })
                                }
                              />
                            </div>
                          )}
                          <InspectorSliderControl
                            label="Blur"
                            value={imageBackground?.blur}
                            fallbackValue={0}
                            min={0}
                            max={20}
                            step={1}
                            onChange={(next) =>
                              updateBackground((prev) => {
                                if (prev?.type !== "image") return prev;
                                const resolved =
                                  next === undefined
                                    ? prev.blur ?? 0
                                    : next;
                                return {
                                  ...prev,
                                  blur: clampRange(resolved, 0, 20),
                                };
                              })
                            }
                          />
                        </div>
                      )}
                      {backgroundType === "video" && (
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-neutral-500">
                            Video URL
                            <InputText
                              type="text"
                              value={videoBackground?.url || ""}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  const next: SlideBackground =
                                    prev?.type === "video"
                                      ? { ...prev }
                                      : {
                                          type: "video",
                                          url: "",
                                          fit: "cover",
                                          focal: { x: 0.5, y: 0.5 },
                                          blur: 0,
                                          loop: true,
                                          mute: true,
                                          autoplay: true,
                                        };
                                  next.url = e.target.value;
                                  return next;
                                })
                              }
                              className={INSPECTOR_INPUT_CLASS}
                              placeholder="https://"
                            />
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              ref={imageInputRef}
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUpload(file, (url) =>
                                    updateBackground((prev) => {
                                      const next: SlideBackground =
                                        prev?.type === "video"
                                          ? { ...prev }
                                          : {
                                              type: "video",
                                              url: "",
                                              fit: "cover",
                                              focal: { x: 0.5, y: 0.5 },
                                              blur: 0,
                                              loop: true,
                                              mute: true,
                                              autoplay: true,
                                            };
                                      next.url = url;
                                      return next;
                                    }),
                                  );
                                  e.target.value = "";
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => imageInputRef.current?.click()}
                              className="rounded border px-3 py-1 text-xs"
                            >
                              Upload
                            </button>
                            {uploading && (
                              <span className="text-xs text-neutral-500">
                                Uploading…
                              </span>
                            )}
                          </div>
                          <label className="block text-xs font-medium text-neutral-500">
                            Poster URL
                            <InputText
                              type="text"
                              value={videoBackground?.poster || ""}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "video")
                                    return {
                                      type: "video",
                                      url: "",
                                      fit: "cover",
                                      focal: { x: 0.5, y: 0.5 },
                                      blur: 0,
                                      loop: true,
                                      mute: true,
                                      autoplay: true,
                                      poster: e.target.value,
                                    };
                                  return { ...prev, poster: e.target.value };
                                })
                              }
                              className={INSPECTOR_INPUT_CLASS}
                              placeholder="https://"
                            />
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              ref={videoPosterInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUpload(file, (url) =>
                                    updateBackground((prev) => {
                                      if (prev?.type !== "video") return prev;
                                      return { ...prev, poster: url };
                                    }),
                                  );
                                  e.target.value = "";
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => videoPosterInputRef.current?.click()}
                              className="rounded border px-3 py-1 text-xs"
                            >
                              Upload poster
                            </button>
                          </div>
                          <InputSelect
                            label="Fit"
                            value={videoBackground?.fit || "cover"}
                            onChange={(e) =>
                              updateBackground((prev) => {
                                if (prev?.type !== "video")
                                  return {
                                    type: "video",
                                    url: prev?.url,
                                    fit: e.target.value as "cover" | "contain",
                                    focal: { x: 0.5, y: 0.5 },
                                    blur: 0,
                                    loop: true,
                                    mute: true,
                                    autoplay: true,
                                    poster: prev?.poster,
                                  };
                                return { ...prev, fit: e.target.value as "cover" | "contain" };
                              })
                            }
                            labelClassName="block text-xs font-medium text-neutral-500"
                            options={[
                              { value: "cover", label: "Cover" },
                              { value: "contain", label: "Contain" },
                            ]}
                          />
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <InputSlider
                              label="Focal X"
                              labelClassName="text-neutral-500"
                              min={0}
                              max={1}
                              step={0.01}
                              value={videoBackground?.focal?.x}
                              fallbackValue={0.5}
                              onValueChange={(next) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "video") return prev;
                                  const resolved =
                                    typeof next === "number" && Number.isFinite(next)
                                      ? clamp01(next)
                                      : 0.5;
                                  const nextFocal = {
                                    ...(prev.focal || { x: 0.5, y: 0.5 }),
                                    x: resolved,
                                  };
                                  return { ...prev, focal: nextFocal };
                                })
                              }
                              containerClassName="mt-1 flex items-center gap-2"
                              sliderClassName="flex-1"
                              numberInputClassName="w-24 shrink-0 border border-neutral-300 px-2 py-1 text-right text-xs text-neutral-900"
                              numberInputProps={{ inputMode: "decimal" }}
                            />
                            <InputSlider
                              label="Focal Y"
                              labelClassName="text-neutral-500"
                              min={0}
                              max={1}
                              step={0.01}
                              value={videoBackground?.focal?.y}
                              fallbackValue={0.5}
                              onValueChange={(next) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "video") return prev;
                                  const resolved =
                                    typeof next === "number" && Number.isFinite(next)
                                      ? clamp01(next)
                                      : 0.5;
                                  const nextFocal = {
                                    ...(prev.focal || { x: 0.5, y: 0.5 }),
                                    y: resolved,
                                  };
                                  return { ...prev, focal: nextFocal };
                                })
                              }
                              containerClassName="mt-1 flex items-center gap-2"
                              sliderClassName="flex-1"
                              numberInputClassName="w-24 shrink-0 border border-neutral-300 px-2 py-1 text-right text-xs text-neutral-900"
                              numberInputProps={{ inputMode: "decimal" }}
                            />
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs font-medium text-neutral-500">
                            <label className="flex items-center gap-2">
                              <InputCheckbox
                                
                                checked={videoBackground?.loop ?? true}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    return { ...prev, loop: e.target.checked };
                                  })
                                }
                              />
                              Loop
                            </label>
                            <label className="flex items-center gap-2">
                              <InputCheckbox
                                
                                checked={videoBackground?.mute ?? true}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    return { ...prev, mute: e.target.checked };
                                  })
                                }
                              />
                              Mute
                            </label>
                            <label className="flex items-center gap-2">
                              <InputCheckbox
                                
                                checked={videoBackground?.autoplay ?? true}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    return { ...prev, autoplay: e.target.checked };
                                  })
                                }
                              />
                              Autoplay
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                            <InputCheckbox
                              
                              checked={Boolean(videoBackground?.overlay)}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "video") return prev;
                                  if (!e.target.checked) {
                                    return { ...prev, overlay: undefined };
                                  }
                                  return {
                                    ...prev,
                                    overlay: {
                                      color: prev.overlay?.color || "#000000",
                                      opacity: prev.overlay?.opacity ?? 0.25,
                                    },
                                  };
                                })
                              }
                            />
                            Overlay
                          </label>
                          {videoBackground?.overlay && (
                            <div className="space-y-2">
                              <InspectorColorInput
                                value={videoBackground.overlay.color || "#000000"}
                                onChange={(nextColor) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    return {
                                      ...prev,
                                      overlay: {
                                        color: nextColor,
                                        opacity: prev.overlay?.opacity ?? 0.25,
                                      },
                                    };
                                  })
                                }
                              />
                              <InspectorSliderControl
                                label="Opacity"
                                value={
                                  videoBackground.overlay.opacity !== undefined
                                    ? videoBackground.overlay.opacity * 100
                                    : undefined
                                }
                                fallbackValue={
                                  (videoBackground.overlay.opacity ?? 0.25) * 100
                                }
                                min={0}
                                max={100}
                                step={1}
                                onChange={(next) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    const percent =
                                      next === undefined
                                        ? (prev.overlay?.opacity ?? 0.25) * 100
                                        : next;
                                    const clampedPercent = Math.min(
                                      100,
                                      Math.max(0, percent ?? 0),
                                    );
                                    return {
                                      ...prev,
                                      overlay: {
                                        color: prev.overlay?.color || "#000000",
                                        opacity: clamp01(clampedPercent / 100),
                                      },
                                    };
                                  })
                                }
                              />
                            </div>
                          )}
                          <InspectorSliderControl
                            label="Blur"
                            value={videoBackground?.blur}
                            fallbackValue={0}
                            min={0}
                            max={20}
                            step={1}
                            onChange={(next) =>
                              updateBackground((prev) => {
                                if (prev?.type !== "video") return prev;
                                const resolved =
                                  next === undefined
                                    ? prev.blur ?? 0
                                    : next;
                                return {
                                  ...prev,
                                  blur: clampRange(resolved, 0, 20),
                                };
                              })
                            }
                          />
                        </div>
                      )}
                      {backgroundType === "none" && (
                        <p className="text-xs text-neutral-500">
                          No background will be displayed for this slide.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              </aside>
            )}
            <div className="flex flex-1 overflow-hidden bg-neutral-50">
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <div style={previewToolbarStyle}>
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                    Preview
                  </span>
                  <div style={zoomControlsStyle}>
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      disabled={!canZoomOut}
                      style={{
                        ...zoomButtonBaseStyle,
                        color: canZoomOut
                          ? inspectorColors.text
                          : inspectorColors.labelMuted,
                        cursor: canZoomOut ? "pointer" : "not-allowed",
                        opacity: canZoomOut ? 1 : 0.6,
                      }}
                      aria-label="Zoom out"
                    >
                      <ZoomOut size={tokens.spacing.md} strokeWidth={1.5} />
                    </button>
                    <span className="text-sm font-medium text-neutral-700">
                      {zoomPercent}%
                    </span>
                    <button
                      type="button"
                      onClick={handleZoomIn}
                      disabled={!canZoomIn}
                      style={{
                        ...zoomButtonBaseStyle,
                        color: canZoomIn
                          ? inspectorColors.text
                          : inspectorColors.labelMuted,
                        cursor: canZoomIn ? "pointer" : "not-allowed",
                        opacity: canZoomIn ? 1 : 0.6,
                      }}
                      aria-label="Zoom in"
                    >
                      <ZoomIn size={tokens.spacing.md} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={handleZoomReset}
                      disabled={!canResetZoom}
                      style={{
                        ...zoomResetButtonBaseStyle,
                        color: canResetZoom
                          ? inspectorColors.text
                          : inspectorColors.labelMuted,
                        cursor: canResetZoom ? "pointer" : "not-allowed",
                        opacity: canResetZoom ? 1 : 0.6,
                        gap: tokens.spacing.xs,
                      }}
                    >
                      <RotateCcw size={tokens.spacing.md} strokeWidth={1.5} />
                      <span className="text-xs font-medium text-neutral-700">
                        Reset
                      </span>
                    </button>
                  </div>
                </div>
                <div
                  ref={previewContainerRef}
                  className="flex flex-1 min-h-0 overflow-hidden"
                >
                  <div
                    className="flex h-full w-full min-h-0 items-start justify-center overflow-hidden"
                    style={{
                      paddingTop: PREVIEW_PADDING_Y,
                      paddingBottom: PREVIEW_PADDING_Y,
                      paddingLeft: PREVIEW_PADDING_X,
                      paddingRight: PREVIEW_PADDING_X,
                    }}
                  >
                    {hasPreviewBounds && (
                      <SlidesManager
                        initialCfg={cfg}
                        onChange={handlePreviewChange}
                        editable={true}
                        selectedId={selectedId}
                        onSelectBlock={handleSelectBlock}
                        openInspector={openInspectorForSelection}
                        onCanvasClick={handleCanvasClick}
                        activeDevice={activeDevice}
                        editInPreview={editInPreview}
                        scale={previewScale}
                        onManipulationChange={handleManipulationChange}
                      />
                    )}
                  </div>
                </div>
              </div>
              {inspectorOpen && selectedBlock && (
                <aside
                  className="flex h-full flex-col border-l bg-white"
                  style={{
                    flexBasis: `min(50%, ${INSPECTOR_MAX_WIDTH}px)`,
                    minWidth: INSPECTOR_MIN_WIDTH,
                  }}
                >
                  <div className="flex-1 overflow-y-auto">
                    <div
                      className="sticky top-0 z-10 border-b bg-white"
                      style={{
                        paddingLeft: tokens.spacing.md,
                        paddingRight: tokens.spacing.md,
                        paddingTop: tokens.spacing.sm,
                        paddingBottom: tokens.spacing.sm,
                      }}
                    >
                      <div
                        className="flex flex-wrap items-center justify-between"
                        style={{ gap: tokens.spacing.sm }}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                          Inspector
                        </span>
                        <span className="text-xs text-neutral-500">
                          Selected: {selectionLabel}
                        </span>
                      </div>
                      <div
                        className="mt-2 flex flex-wrap items-center justify-between"
                        style={{ gap: tokens.spacing.sm }}
                      >
                        <div
                          className="min-w-0 flex flex-wrap items-center"
                          style={{ gap: tokens.spacing.xs }}
                        >
                          <span className="text-sm font-semibold text-neutral-900">
                            {selectionLabel}
                          </span>
                          {selectedBlock.locked && (
                            <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                              Locked
                            </span>
                          )}
                        </div>
                        <div
                          className="flex flex-wrap items-center"
                          style={{ gap: tokens.spacing.xs }}
                        >
                          <button
                            type="button"
                            onClick={() => handleDuplicateBlock(selectedBlock.id)}
                            className="rounded border px-2.5 py-1 text-xs font-medium"
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(selectedBlock.id)}
                            className="rounded border px-2.5 py-1 text-xs font-medium text-red-600"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleBlockLock(selectedBlock.id)}
                            className="rounded border px-2.5 py-1 text-xs font-medium"
                          >
                            {selectedBlock.locked ? "Unlock" : "Lock"}
                          </button>
                          <button
                            type="button"
                            onClick={handleInspectorDone}
                            className="rounded border px-2.5 py-1 text-xs font-medium"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                    <div
                      className={INSPECTOR_CONTENT_CLASS}
                      onPointerDownCapture={handleInspectorPointerDown}
                    >
                      <section>
                        <div className="mt-2 space-y-3 text-sm">
                          {(selectedBlock.kind === "heading" ||
                            selectedBlock.kind === "text") &&
                            (() => {
                              const textValue =
                                selectedBlock.content ?? selectedBlock.text ?? "";
                              const handleTextChange = (nextValue: string) => {
                                patchBlock(selectedBlock.id, {
                                  content: nextValue,
                                  text: nextValue,
                                });
                              };
                              const textColorValue =
                                selectedBlock.textColor ??
                                selectedBlock.color ??
                                "#000000";
                              const parsedTextColor = parseColorValue(textColorValue);
                              const textOpacityPercent = Math.round(
                                clampRange(parsedTextColor.alpha * 100, 0, 100),
                              );
                              const handleTextColorChange = (nextValue: string) => {
                                const trimmed = nextValue.trim();
                                if (!trimmed.length) {
                                  patchBlock(selectedBlock.id, {
                                    textColor: undefined,
                                    color: undefined,
                                  });
                                  return;
                                }
                                const parsedNext = parseColorValue(nextValue);
                                const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed);
                                const targetAlpha =
                                  isHex && parsedTextColor.alpha < 0.999
                                    ? parsedTextColor.alpha
                                    : parsedNext.alpha;
                                const resolvedColor =
                                  targetAlpha >= 0.999
                                    ? parsedNext.hex
                                    : hexToRgbaString(parsedNext.hex, targetAlpha);
                                patchBlock(selectedBlock.id, {
                                  textColor: resolvedColor,
                                  color: resolvedColor,
                                });
                              };
                              const handleTextOpacityChange = (next: number | undefined) => {
                                if (next === undefined) {
                                  patchBlock(selectedBlock.id, {
                                    textColor: parsedTextColor.hex,
                                    color: parsedTextColor.hex,
                                  });
                                  return;
                                }
                                const clamped = clampRange(next, 0, 100);
                                const normalized = clamp01(clamped / 100);
                                if (normalized >= 0.999) {
                                  patchBlock(selectedBlock.id, {
                                    textColor: parsedTextColor.hex,
                                    color: parsedTextColor.hex,
                                  });
                                  return;
                                }
                                const nextColor = hexToRgbaString(
                                  parsedTextColor.hex,
                                  normalized,
                                );
                                patchBlock(selectedBlock.id, {
                                  textColor: nextColor,
                                  color: nextColor,
                                });
                              };
                              const fontSizeFallback =
                                selectedBlock.fontSize ??
                                (selectedBlock.size
                                  ? SIZE_TO_FONT_SIZE_PX[selectedBlock.size]
                                  : TEXT_KIND_FONT_DEFAULT[selectedBlock.kind] ?? 16) ??
                                16;
                              return (
                                <>
                                  <InspectorSection title="Content">
                                    <InspectorInputTextArea
                                      label="Text"
                                      value={textValue}
                                      rows={selectedBlock.kind === "text" ? 4 : 3}
                                      onChange={handleTextChange}
                                    />
                                  </InspectorSection>
                                  <InspectorSection title="Typography">
                                    <ControlRow label="Font family">
                                      {(() => {
                                        const value = resolveFontFamilyValue(
                                          selectedBlock.fontFamily,
                                        );
                                        return (
                                          <FontSelect
                                            value={value}
                                            fonts={APP_FONTS}
                                            onChange={(nextValue) =>
                                              handleFontFamilyChange(
                                                selectedBlock.id,
                                                nextValue,
                                              )
                                            }
                                          />
                                        );
                                      })()}
                                    </ControlRow>
                                    <InspectorInputSelect
                                      label="Font weight"
                                      value={String(
                                        selectedBlock.fontWeight ??
                                          (selectedBlock.kind === "heading" ? 700 : 400),
                                      )}
                                      onChange={(nextValue) => {
                                        const parsed = Number(nextValue);
                                        patchBlock(selectedBlock.id, {
                                          fontWeight: Number.isNaN(parsed)
                                            ? selectedBlock.fontWeight
                                            : parsed,
                                        });
                                      }}
                                      options={FONT_WEIGHT_OPTIONS.map((option) => ({
                                        label: option.label,
                                        value: String(option.value),
                                      }))}
                                    />
                                    <InspectorInputSlider
                                      label="Font size (px)"
                                      value={selectedBlock.fontSize}
                                      fallbackValue={fontSizeFallback}
                                      min={8}
                                      max={120}
                                      step={1}
                                      onChange={(next) => {
                                        if (next === undefined) {
                                          patchBlock(selectedBlock.id, {
                                            fontSize: undefined,
                                          });
                                          return;
                                        }
                                        const normalized = Math.round(next);
                                        patchBlock(selectedBlock.id, {
                                          fontSize: Number.isNaN(normalized)
                                            ? undefined
                                            : normalized,
                                        });
                                      }}
                                    />
                                    <InspectorInputSlider
                                      label="Line height"
                                      value={selectedBlock.lineHeight}
                                      fallbackValue={selectedBlock.lineHeight ?? 1.2}
                                      min={0.5}
                                      max={3}
                                      step={0.1}
                                      formatValue={(current, fallback) => {
                                        const resolved =
                                          typeof current === "number" && Number.isFinite(current)
                                            ? current
                                            : typeof fallback === "number"
                                              ? fallback
                                              : 1.2;
                                        return resolved.toFixed(2);
                                      }}
                                      onChange={(next) => {
                                        if (next === undefined) {
                                          patchBlock(selectedBlock.id, {
                                            lineHeight: undefined,
                                            lineHeightUnit: undefined,
                                          });
                                          return;
                                        }
                                        const normalized = Math.round(next * 100) / 100;
                                        patchBlock(selectedBlock.id, {
                                          lineHeight: normalized,
                                          lineHeightUnit: undefined,
                                        });
                                      }}
                                    />
                                    <InspectorInputSlider
                                      label="Letter spacing (px)"
                                      value={selectedBlock.letterSpacing}
                                      fallbackValue={selectedBlock.letterSpacing ?? 0}
                                      min={-10}
                                      max={20}
                                      step={0.1}
                                      onChange={(next) => {
                                        if (next === undefined) {
                                          patchBlock(selectedBlock.id, {
                                            letterSpacing: undefined,
                                          });
                                          return;
                                        }
                                        const normalized = Math.round(next * 10) / 10;
                                        patchBlock(selectedBlock.id, {
                                          letterSpacing: normalized,
                                        });
                                      }}
                                    />
                                  </InspectorSection>
                                  <InspectorSection title="Color">
                                    <InspectorInputColor
                                      label="Text color"
                                      value={textColorValue}
                                      onChange={handleTextColorChange}
                                    />
                                    <InspectorInputSlider
                                      label="Opacity (%)"
                                      value={textOpacityPercent}
                                      fallbackValue={100}
                                      min={0}
                                      max={100}
                                      step={1}
                                      onChange={handleTextOpacityChange}
                                    />
                                  </InspectorSection>
                                  <InspectorSection title="Alignment">
                                    <InspectorInputSelect
                                      label="Alignment"
                                      value={selectedBlock.align ?? "left"}
                                      onChange={(nextValue) => {
                                        patchBlock(selectedBlock.id, {
                                          align: nextValue as SlideBlock["align"],
                                        });
                                      }}
                                      options={TEXT_ALIGNMENT_OPTIONS.map((option) => ({
                                        label: option.label,
                                        value: option.value,
                                      }))}
                                    />
                                  </InspectorSection>
                                  {selectedBlock.bgStyle &&
                                  selectedBlock.bgStyle !== "none" ? (
                                    <InspectorSection title="Effects">
                                      <InspectorInputSlider
                                        label="Corner radius (px)"
                                        value={selectedBlock.radius}
                                        fallbackValue={selectedBlock.radius ?? 0}
                                        min={0}
                                        max={50}
                                        step={1}
                                        onChange={(next) => {
                                          const resolved =
                                            next === undefined ? 0 : Math.round(next);
                                          patchBlock(selectedBlock.id, {
                                            radius: resolved,
                                          });
                                        }}
                                      />
                                    </InspectorSection>
                                  ) : null}
                                  <InspectorSection title="Background">
                                    <InspectorInputSelect
                                      label="Style"
                                      value={selectedBlock.bgStyle ?? "none"}
                                      onChange={(nextValue) => {
                                        const value = nextValue as SlideBlock["bgStyle"];
                                        if (value === "none") {
                                          patchBlock(selectedBlock.id, {
                                            bgStyle: "none",
                                          });
                                          return;
                                        }
                                        patchBlock(selectedBlock.id, {
                                          bgStyle: value,
                                          bgColor: selectedBlock.bgColor ?? "#000000",
                                          bgOpacity:
                                            selectedBlock.bgOpacity ??
                                            (value === "glass" ? 0.5 : 1),
                                          radius: selectedBlock.radius ?? 0,
                                          padding: selectedBlock.padding ?? 0,
                                        });
                                      }}
                                      options={BACKGROUND_STYLE_OPTIONS.map((option) => ({
                                        label: option.label,
                                        value: option.value,
                                      }))}
                                    />
                                    {selectedBlock.bgStyle &&
                                    selectedBlock.bgStyle !== "none" ? (
                                      <>
                                        <InspectorInputColor
                                          label="Background color"
                                          value={selectedBlock.bgColor ?? "#000000"}
                                          onChange={(nextColor) =>
                                            patchBlock(selectedBlock.id, {
                                              bgColor: nextColor,
                                            })
                                          }
                                        />
                                        <InspectorInputSlider
                                          label="Background opacity (%)"
                                          value={
                                            selectedBlock.bgOpacity !== undefined
                                              ? selectedBlock.bgOpacity * 100
                                              : undefined
                                          }
                                          fallbackValue={
                                            ((selectedBlock.bgStyle === "glass" ? 0.5 : 1) *
                                              100) || 0
                                          }
                                          min={0}
                                          max={100}
                                          step={1}
                                          onChange={(next) => {
                                            const fallbackValue =
                                              selectedBlock.bgStyle === "glass" ? 0.5 : 1;
                                            const percent =
                                              next === undefined
                                                ? (selectedBlock.bgOpacity ?? fallbackValue) * 100
                                                : next;
                                            const clampedPercent = Math.min(
                                              100,
                                              Math.max(0, percent ?? 0),
                                            );
                                            patchBlock(
                                              selectedBlock.id,
                                              {
                                                bgOpacity: clamp01(clampedPercent / 100),
                                              },
                                              false,
                                            );
                                          }}
                                        />
                                      </>
                                    ) : null}
                                  </InspectorSection>
                                  {selectedBlock.bgStyle &&
                                  selectedBlock.bgStyle !== "none" ? (
                                    <InspectorSection title="Spacing">
                                      <InspectorInputSlider
                                        label="Padding (px)"
                                        value={selectedBlock.padding}
                                        fallbackValue={selectedBlock.padding ?? 0}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onChange={(next) => {
                                          const resolved =
                                            next === undefined ? 0 : Math.round(next);
                                          patchBlock(selectedBlock.id, {
                                            padding: resolved,
                                          });
                                        }}
                                      />
                                    </InspectorSection>
                                  ) : null}
                                </>
                              );
                            })()}
                          {selectedBlock.kind === "subheading" &&
                            (() => {
                              const textColorValue =
                                selectedBlock.textColor ??
                                selectedBlock.color ??
                                "#000000";
                              const parsedTextColor =
                                parseColorValue(textColorValue);
                              const textOpacityPercent = Math.round(
                                clampRange(parsedTextColor.alpha * 100, 0, 100),
                              );
                              const handleTextColorChange = (nextValue: string) => {
                                const trimmed = nextValue.trim();
                                if (!trimmed.length) {
                                  patchBlock(selectedBlock.id, {
                                    textColor: undefined,
                                    color: undefined,
                                  });
                                  return;
                                }
                                const parsedNext = parseColorValue(nextValue);
                                const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed);
                                const targetAlpha =
                                  isHex && parsedTextColor.alpha < 0.999
                                    ? parsedTextColor.alpha
                                    : parsedNext.alpha;
                                const resolvedColor =
                                  targetAlpha >= 0.999
                                    ? parsedNext.hex
                                    : hexToRgbaString(parsedNext.hex, targetAlpha);
                                patchBlock(selectedBlock.id, {
                                  textColor: resolvedColor,
                                  color: resolvedColor,
                                });
                              };
                              const handleTextOpacityChange = (
                                next: number | undefined,
                              ) => {
                                if (next === undefined) {
                                  patchBlock(selectedBlock.id, {
                                    textColor: parsedTextColor.hex,
                                    color: parsedTextColor.hex,
                                  });
                                  return;
                                }
                                const clamped = clampRange(next, 0, 100);
                                const normalized = clamp01(clamped / 100);
                                if (normalized >= 0.999) {
                                  patchBlock(selectedBlock.id, {
                                    textColor: parsedTextColor.hex,
                                    color: parsedTextColor.hex,
                                  });
                                  return;
                                }
                                const nextColor = hexToRgbaString(
                                  parsedTextColor.hex,
                                  normalized,
                                );
                                patchBlock(selectedBlock.id, {
                                  textColor: nextColor,
                                  color: nextColor,
                                });
                              };
                              const fontSizeFallback =
                                selectedBlock.fontSize ??
                                (selectedBlock.size
                                  ? SIZE_TO_FONT_SIZE_PX[selectedBlock.size]
                                  : TEXT_KIND_FONT_DEFAULT.subheading ??
                                    SIZE_TO_FONT_SIZE_PX.md) ??
                                SIZE_TO_FONT_SIZE_PX.md;
                              return (
                                <>
                                  <InspectorSection title="Content">
                                    <InspectorInputTextArea
                                      label="Text"
                                      value={selectedBlock.text ?? ""}
                                      rows={3}
                                      onChange={(nextValue) =>
                                        patchBlock(selectedBlock.id, {
                                          text: nextValue,
                                          content: nextValue,
                                        })
                                      }
                                    />
                                  </InspectorSection>
                                  <InspectorSection title="Typography">
                                    <ControlRow label="Font family">
                                      {(() => {
                                        const value = resolveFontFamilyValue(
                                          selectedBlock.fontFamily,
                                        );
                                        return (
                                          <FontSelect
                                            value={value}
                                            fonts={APP_FONTS}
                                            onChange={(nextValue) =>
                                              handleFontFamilyChange(
                                                selectedBlock.id,
                                                nextValue,
                                              )
                                            }
                                          />
                                        );
                                      })()}
                                    </ControlRow>
                                    <InspectorInputSelect
                                      label="Font weight"
                                      value={String(selectedBlock.fontWeight ?? 600)}
                                      onChange={(nextValue) => {
                                        const parsed = Number(nextValue);
                                        patchBlock(selectedBlock.id, {
                                          fontWeight: Number.isNaN(parsed)
                                            ? selectedBlock.fontWeight
                                            : parsed,
                                        });
                                      }}
                                      options={FONT_WEIGHT_OPTIONS.map((option) => ({
                                        label: option.label,
                                        value: String(option.value),
                                      }))}
                                    />
                                    <InspectorInputSelect
                                      label="Size"
                                      value={selectedBlock.size ?? "md"}
                                      onChange={(nextValue) => {
                                        patchBlock(selectedBlock.id, {
                                          size: nextValue as SlideBlock["size"],
                                        });
                                      }}
                                      options={TEXT_SIZES.map((option) => ({
                                        label: option.label,
                                        value: option.value,
                                      }))}
                                    />
                                    <InspectorInputSlider
                                      label="Font size (px)"
                                      value={selectedBlock.fontSize}
                                      fallbackValue={fontSizeFallback}
                                      min={8}
                                      max={120}
                                      step={1}
                                      onChange={(next) => {
                                        if (next === undefined) {
                                          patchBlock(selectedBlock.id, {
                                            fontSize: undefined,
                                          });
                                          return;
                                        }
                                        const normalized = Math.round(next);
                                        patchBlock(selectedBlock.id, {
                                          fontSize: Number.isNaN(normalized)
                                            ? undefined
                                            : normalized,
                                        });
                                      }}
                                    />
                                    <InspectorInputSlider
                                      label="Line height"
                                      value={selectedBlock.lineHeight}
                                      fallbackValue={selectedBlock.lineHeight ?? 1.2}
                                      min={0.5}
                                      max={3}
                                      step={0.1}
                                      formatValue={(current, fallback) => {
                                        const resolved =
                                          typeof current === "number" &&
                                          Number.isFinite(current)
                                            ? current
                                            : typeof fallback === "number"
                                              ? fallback
                                              : 1.2;
                                        return resolved.toFixed(2);
                                      }}
                                      onChange={(next) => {
                                        if (next === undefined) {
                                          patchBlock(selectedBlock.id, {
                                            lineHeight: undefined,
                                            lineHeightUnit: undefined,
                                          });
                                          return;
                                        }
                                        const normalized = Math.round(next * 100) / 100;
                                        patchBlock(selectedBlock.id, {
                                          lineHeight: normalized,
                                          lineHeightUnit: undefined,
                                        });
                                      }}
                                    />
                                    <InspectorInputSlider
                                      label="Letter spacing (px)"
                                      value={selectedBlock.letterSpacing}
                                      fallbackValue={selectedBlock.letterSpacing ?? 0}
                                      min={-10}
                                      max={20}
                                      step={0.1}
                                      onChange={(next) => {
                                        if (next === undefined) {
                                          patchBlock(selectedBlock.id, {
                                            letterSpacing: undefined,
                                          });
                                          return;
                                        }
                                        const normalized = Math.round(next * 10) / 10;
                                        patchBlock(selectedBlock.id, {
                                          letterSpacing: normalized,
                                        });
                                      }}
                                    />
                                  </InspectorSection>
                                  <InspectorSection title="Color">
                                    <InspectorInputColor
                                      label="Text color"
                                      value={textColorValue}
                                      onChange={handleTextColorChange}
                                    />
                                    <InspectorInputSlider
                                      label="Opacity (%)"
                                      value={textOpacityPercent}
                                      fallbackValue={100}
                                      min={0}
                                      max={100}
                                      step={1}
                                      onChange={handleTextOpacityChange}
                                    />
                                  </InspectorSection>
                                  <InspectorSection title="Alignment">
                                    <InspectorInputSelect
                                      label="Alignment"
                                      value={selectedBlock.align ?? "left"}
                                      onChange={(nextValue) => {
                                        patchBlock(selectedBlock.id, {
                                          align: nextValue as SlideBlock["align"],
                                        });
                                      }}
                                      options={TEXT_ALIGNMENT_OPTIONS.map((option) => ({
                                        label: option.label,
                                        value: option.value,
                                      }))}
                                    />
                                  </InspectorSection>
                                </>
                              );
                            })()}
                          {selectedBlock.kind === "button" && selectedButtonConfig && (
                            <div className="space-y-4">
                              <InspectorSection title="Content">
                                <InspectorInputText
                                  label="Label"
                                  value={selectedButtonConfig.label}
                                  onChange={(nextValue) =>
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      label: nextValue,
                                    }))
                                  }
                                />
                                <InspectorInputSelect
                                  label="Link"
                                  value={
                                    selectedButtonConfig.href &&
                                    knownLinkValues.has(selectedButtonConfig.href)
                                      ? selectedButtonConfig.href
                                      : CUSTOM_LINK_OPTION.value
                                  }
                                  onChange={(nextValue) => {
                                    if (nextValue === CUSTOM_LINK_OPTION.value) {
                                      updateButtonConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        href:
                                          config.href &&
                                          !knownLinkValues.has(config.href)
                                            ? config.href
                                            : "",
                                      }));
                                      return;
                                    }
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      href: nextValue,
                                    }));
                                  }}
                                  options={linkOptions}
                                />
                                <InspectorInputText
                                  label="URL"
                                  value={selectedButtonConfig.href}
                                  placeholder="https://"
                                  onChange={(nextValue) =>
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      href: nextValue,
                                    }))
                                  }
                                />
                              </InspectorSection>
                              <InspectorSection title="Typography">
                                <ControlRow label="Font family">
                                  {(() => {
                                    const value = resolveFontFamilyValue(
                                      selectedBlock.fontFamily,
                                    );
                                    return (
                                      <FontSelect
                                        value={value}
                                        fonts={APP_FONTS}
                                        onChange={(nextValue) =>
                                          handleFontFamilyChange(
                                            selectedBlock.id,
                                            nextValue,
                                          )
                                        }
                                      />
                                    );
                                  })()}
                                </ControlRow>
                                <InspectorInputSelect
                                  label="Font weight"
                                  value={String(selectedBlock.fontWeight ?? 600)}
                                  onChange={(nextValue) => {
                                    const parsed = Number(nextValue);
                                    patchBlock(selectedBlock.id, {
                                      fontWeight: Number.isNaN(parsed)
                                        ? selectedBlock.fontWeight
                                        : parsed,
                                    });
                                  }}
                                  options={FONT_WEIGHT_OPTIONS.map((option) => ({
                                    label: option.label,
                                    value: String(option.value),
                                  }))}
                                />
                                <InspectorInputSlider
                                  label="Font size (px)"
                                  value={selectedBlock.fontSize}
                                  fallbackValue={
                                    selectedBlock.fontSize ??
                                    BUTTON_FONT_SIZE_PX[selectedButtonConfig.size] ??
                                      BUTTON_FONT_SIZE_PX.Medium
                                  }
                                  min={8}
                                  max={120}
                                  step={1}
                                  onChange={(next) => {
                                    if (next === undefined) {
                                      patchBlock(selectedBlock.id, {
                                        fontSize: undefined,
                                      });
                                      return;
                                    }
                                    const normalized = Math.round(next);
                                    patchBlock(selectedBlock.id, {
                                      fontSize: Number.isNaN(normalized)
                                        ? undefined
                                        : normalized,
                                    });
                                  }}
                                />
                                <InspectorInputSlider
                                  label="Line height"
                                  value={selectedBlock.lineHeight}
                                  fallbackValue={selectedBlock.lineHeight ?? 1.2}
                                  min={0.5}
                                  max={3}
                                  step={0.1}
                                  onChange={(next) => {
                                    if (next === undefined) {
                                      patchBlock(selectedBlock.id, {
                                        lineHeight: undefined,
                                        lineHeightUnit: undefined,
                                      });
                                      return;
                                    }
                                    patchBlock(selectedBlock.id, {
                                      lineHeight: next,
                                      lineHeightUnit: undefined,
                                    });
                                  }}
                                />
                              </InspectorSection>
                              <InspectorSection title="Color">
                                <InspectorInputColor
                                  label="Text color"
                                  value={selectedButtonConfig.textColor}
                                  onChange={(nextColor) =>
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      textColor: nextColor,
                                    }))
                                  }
                                />
                                <InspectorInputColor
                                  label="Background color"
                                  value={selectedButtonConfig.bgColor}
                                  onChange={(nextColor) =>
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      bgColor: nextColor,
                                    }))
                                  }
                                />
                              </InspectorSection>
                              <InspectorSection title="Alignment">
                                <InspectorInputSelect
                                  label="Alignment"
                                  value={selectedBlock.align ?? "left"}
                                  onChange={(nextValue) => {
                                    patchBlock(selectedBlock.id, {
                                      align: nextValue as SlideBlock["align"],
                                    });
                                  }}
                                  options={TEXT_ALIGNMENT_OPTIONS.map((option) => ({
                                    label: option.label,
                                    value: option.value,
                                  }))}
                                />
                              </InspectorSection>
                              <InspectorSection title="Options">
                                <InspectorInputSelect
                                  label="Variant"
                                  value={selectedButtonConfig.variant}
                                  onChange={(nextValue) =>
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      variant: nextValue as ButtonBlockVariant,
                                    }))
                                  }
                                  options={BUTTON_VARIANTS.map((variant) => ({
                                    value: variant,
                                    label: variant,
                                  }))}
                                />
                                <InspectorInputSelect
                                  label="Size"
                                  value={selectedButtonConfig.size}
                                  onChange={(nextValue) =>
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      size: nextValue as ButtonBlockSize,
                                    }))
                                  }
                                  options={BUTTON_SIZES.map((size) => ({
                                    value: size,
                                    label: size,
                                  }))}
                                />
                                <InspectorInputToggle
                                  label="Full width"
                                  checked={selectedButtonConfig.fullWidth}
                                  onChange={(nextChecked) =>
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      fullWidth: nextChecked,
                                    }))
                                  }
                                />
                                <InspectorInputToggle
                                  label="Button shadow"
                                  checked={selectedButtonConfig.shadow}
                                  onChange={(nextChecked) =>
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      shadow: nextChecked,
                                    }))
                                  }
                                />
                              </InspectorSection>
                              <InspectorSection title="Effects">
                                <InspectorInputSlider
                                  label="Corner radius (px)"
                                  value={selectedButtonConfig.radius}
                                  fallbackValue={
                                    selectedButtonConfig.radius ?? DEFAULT_BUTTON_CONFIG.radius
                                  }
                                  min={0}
                                  max={50}
                                  step={1}
                                  onChange={(next) => {
                                    const resolved =
                                      next === undefined || Number.isNaN(next)
                                        ? 0
                                        : Math.max(0, Math.round(next));
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      radius: resolved,
                                    }));
                                  }}
                                />
                              </InspectorSection>
                            </div>
                          )}
                          {selectedBlock.kind === "image" &&
                            selectedImageConfig && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Preview
                                  </span>
                                  <div
                                    className={[
                                      "flex w-full items-center justify-center overflow-hidden rounded",
                                      selectedImageConfig.shadow ? "shadow-lg" : "",
                                      selectedImageAspectRatio ? "" : "h-28",
                                      selectedImageConfig.url ? "bg-transparent" : "bg-neutral-200",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                    style={{
                                      borderRadius: selectedImageConfig.radius,
                                      aspectRatio: selectedImageAspectRatio,
                                      height: selectedImageAspectRatio ? "auto" : undefined,
                                    }}
                                  >
                                    {selectedImageConfig.url ? (
                                      <img
                                        src={selectedImageConfig.url}
                                        alt={selectedImageConfig.alt || ""}
                                        style={{
                                          objectFit: selectedImageConfig.fit,
                                          objectPosition: `${selectedImageConfig.focalX * 100}% ${selectedImageConfig.focalY * 100}%`,
                                          borderRadius: selectedImageConfig.radius,
                                          width: "100%",
                                          maxWidth: "100%",
                                          maxHeight: "100%",
                                          height: selectedImageAspectRatio ? "auto" : "100%",
                                          aspectRatio: selectedImageAspectRatio,
                                        }}
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                                        No image selected
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <InspectorSection title="Content">
                                  <InspectorInputText
                                    label="Image URL"
                                    value={selectedImageConfig.url}
                                    placeholder="https://example.com/image.jpg"
                                    onChange={(nextValue) =>
                                      updateImageConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        url: nextValue,
                                      }))
                                    }
                                  />
                                  <InspectorInputUpload
                                    ref={blockImageInputRef}
                                    label="Upload"
                                    buttonLabel={
                                      selectedImageConfig.url
                                        ? "Replace image"
                                        : "Upload image"
                                    }
                                    accept="image/*"
                                    uploading={uploading}
                                    onSelectFiles={(files) => {
                                      const file = files?.[0];
                                      if (!file) return;
                                      handleUpload(file, (url) => {
                                        updateImageConfig(selectedBlock.id, (config) => ({
                                          ...config,
                                          url,
                                        }));
                                      });
                                    }}
                                  />
                                  <InspectorInputText
                                    label="Alt text"
                                    value={selectedImageConfig.alt}
                                    placeholder="Describe the image"
                                    onChange={(nextValue) =>
                                      updateImageConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        alt: nextValue,
                                      }))
                                    }
                                  />
                                </InspectorSection>
                                <InspectorSection title="Display">
                                  <InspectorInputSelect
                                    label="Object fit"
                                    value={selectedImageConfig.fit}
                                    onChange={(nextValue) => {
                                      const normalized =
                                        nextValue === "contain" ? "contain" : "cover";
                                      updateImageConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        fit: normalized,
                                      }));
                                    }}
                                    options={[
                                      { value: "cover", label: "Cover" },
                                      { value: "contain", label: "Contain" },
                                    ]}
                                  />
                                  <InspectorInputSelect
                                    label="Aspect ratio"
                                    value={selectedImageConfig.aspectRatio}
                                    onChange={(nextValue) =>
                                      updateImageConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        aspectRatio: nextValue as ImageBlockConfig["aspectRatio"],
                                      }))
                                    }
                                    options={IMAGE_ASPECT_RATIO_OPTIONS.map((option) => ({
                                      label: option.label,
                                      value: option.value,
                                    }))}
                                  />
                                  <InspectorInputSlider
                                    label="Focal X (%)"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={Math.round(selectedImageConfig.focalX * 100)}
                                    fallbackValue={Math.round(
                                      DEFAULT_IMAGE_CONFIG.focalX * 100,
                                    )}
                                    onChange={(next) => {
                                      const percent =
                                        typeof next === "number" && Number.isFinite(next)
                                          ? next
                                          : DEFAULT_IMAGE_CONFIG.focalX * 100;
                                      const clamped = Math.min(100, Math.max(0, percent));
                                      updateImageConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        focalX: clamped / 100,
                                      }));
                                    }}
                                  />
                                  <InspectorInputSlider
                                    label="Focal Y (%)"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={Math.round(selectedImageConfig.focalY * 100)}
                                    fallbackValue={Math.round(
                                      DEFAULT_IMAGE_CONFIG.focalY * 100,
                                    )}
                                    onChange={(next) => {
                                      const percent =
                                        typeof next === "number" && Number.isFinite(next)
                                          ? next
                                          : DEFAULT_IMAGE_CONFIG.focalY * 100;
                                      const clamped = Math.min(100, Math.max(0, percent));
                                      updateImageConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        focalY: clamped / 100,
                                      }));
                                    }}
                                  />
                                </InspectorSection>
                                <InspectorSection title="Effects">
                                  <InspectorInputSlider
                                    label="Corner radius (px)"
                                    min={0}
                                    max={50}
                                    step={1}
                                    value={selectedImageConfig.radius}
                                    fallbackValue={DEFAULT_IMAGE_CONFIG.radius}
                                    onChange={(next) => {
                                      const resolved =
                                        typeof next === "number" && Number.isFinite(next)
                                          ? Math.max(0, Math.round(next))
                                          : DEFAULT_IMAGE_CONFIG.radius;
                                      updateImageConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        radius: resolved,
                                      }));
                                    }}
                                  />
                                </InspectorSection>
                              </div>
                            )}
                          {selectedBlock.kind === "gallery" &&
                            selectedGalleryConfig && (
                              <div className="space-y-4">
                                <InspectorSection title="Content">
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: tokens.spacing.sm,
                                    }}
                                  >
                                    <InspectorInputUpload
                                      label="Upload images"
                                      buttonLabel="Upload images"
                                      accept="image/*"
                                      multiple
                                      uploading={uploading}
                                      uploadingLabel="Uploading…"
                                      onSelectFiles={async (files) => {
                                        const galleryBlockId = selectedBlock.id;
                                        const fileList = files
                                          ? Array.from(files)
                                          : [];
                                        if (!fileList.length) {
                                          return;
                                        }
                                        const uploaded: string[] = [];
                                        for (const file of fileList) {
                                          // eslint-disable-next-line no-await-in-loop
                                          await handleUpload(file, (url) => {
                                            if (url) uploaded.push(url);
                                          });
                                        }
                                        if (uploaded.length) {
                                          updateGalleryConfig(
                                            galleryBlockId,
                                            (config) => ({
                                              ...config,
                                              items: [
                                                ...config.items,
                                                ...uploaded.map((url) => ({ url })),
                                              ],
                                            }),
                                          );
                                        }
                                      }}
                                    />
                                    <InspectorInputText
                                      label="Add image by URL"
                                      value={galleryUrlInput}
                                      placeholder="https://example.com/image.jpg"
                                      onChange={(nextValue) =>
                                        setGalleryUrlInput(nextValue)
                                      }
                                      trailing={
                                        <InspectorInlineButton
                                          onClick={() =>
                                            handleAddGalleryImageByUrl(
                                              selectedBlock.id,
                                            )
                                          }
                                          disabled={!galleryUrlHasValue}
                                        >
                                          Add
                                        </InspectorInlineButton>
                                      }
                                    />
                                    {galleryRenderedItems.length === 0 ? (
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          minHeight:
                                            inspectorLayout.controlHeight * 3,
                                          borderRadius: inspectorLayout.radius,
                                          border: `${inspectorLayout.borderWidth}px dashed ${inspectorColors.border}`,
                                          padding: tokens.spacing.md,
                                          color: inspectorColors.labelMuted,
                                          fontSize: "0.75rem",
                                        }}
                                      >
                                        No images yet
                                      </div>
                                    ) : (
                                      <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragStart={handleGalleryDragStart}
                                        onDragCancel={handleGalleryDragCancel}
                                        onDragEnd={handleGalleryDragEnd}
                                      >
                                        <SortableContext
                                          items={gallerySortableIds}
                                          strategy={verticalListSortingStrategy}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: tokens.spacing.xs,
                                            }}
                                          >
                                            {galleryRenderedItems.map((item, index) => {
                                              const identity =
                                                galleryItemIdentities[index] ?? null;
                                              const itemKey = identity
                                                ? identity.key
                                                : ensureGalleryItemKey(item);
                                              return (
                                                <GalleryInspectorItem
                                                  key={itemKey}
                                                  itemKey={itemKey}
                                                  item={item}
                                                  index={index}
                                                  onAltChange={(value) => {
                                                    updateGalleryConfig(
                                                      selectedBlock.id,
                                                      (config) => ({
                                                        ...config,
                                                        items: config.items.map(
                                                          (galleryItem, galleryIndex) =>
                                                            galleryIndex === index
                                                              ? {
                                                                  ...galleryItem,
                                                                  alt: value,
                                                                }
                                                              : galleryItem,
                                                        ),
                                                      }),
                                                    );
                                                  }}
                                                  onRemove={() => {
                                                    updateGalleryConfig(
                                                      selectedBlock.id,
                                                      (config) => ({
                                                        ...config,
                                                        items: config.items.filter(
                                                          (_, galleryIndex) =>
                                                            galleryIndex !== index,
                                                        ),
                                                      }),
                                                    );
                                                  }}
                                                />
                                              );
                                            })}
                                          </div>
                                        </SortableContext>
                                        <DragOverlay>
                                          {activeGalleryDragItem ? (
                                            <GalleryInspectorItemContent
                                              item={activeGalleryDragItem}
                                              itemKey={
                                                activeGalleryDragIdentity?.key ??
                                                ensureGalleryItemKey(activeGalleryDragItem)
                                              }
                                              onAltChange={() => {}}
                                              onRemove={() => {}}
                                              isDragging
                                              disableInteractions
                                              style={{ transform: "scale(1.05)" }}
                                            />
                                          ) : null}
                                        </DragOverlay>
                                      </DndContext>
                                    )}
                                  </div>
                                </InspectorSection>
                                <InspectorSection title="Layout">
                                  <InspectorInputSelect
                                    label="Layout"
                                    value={selectedGalleryConfig.layout}
                                    onChange={(nextValue) =>
                                      updateGalleryConfig(
                                        selectedBlock.id,
                                        (config) => ({
                                          ...config,
                                          layout: nextValue as GalleryBlockConfig["layout"],
                                        }),
                                      )
                                    }
                                    options={[
                                      { value: "grid", label: "Grid" },
                                      { value: "carousel", label: "Carousel" },
                                    ]}
                                  />
                                  <InspectorInputSelect
                                    label="Aspect ratio"
                                    value={selectedGalleryConfig.aspectRatio}
                                    onChange={(nextValue) =>
                                      updateGalleryConfig(
                                        selectedBlock.id,
                                        (config) => ({
                                          ...config,
                                          aspectRatio: nextValue as GalleryBlockConfig["aspectRatio"],
                                        }),
                                      )
                                    }
                                    options={IMAGE_ASPECT_RATIO_OPTIONS.map((option) => ({
                                      label: option.label,
                                      value: option.value,
                                    }))}
                                  />
                                </InspectorSection>
                                <InspectorSection title="Autoplay">
                                  <InspectorInputToggle
                                    label="Enable autoplay"
                                    checked={selectedGalleryConfig.autoplay}
                                    disabled={!isGalleryCarousel}
                                    onChange={(nextChecked) =>
                                      updateGalleryConfig(
                                        selectedBlock.id,
                                        (config) => ({
                                          ...config,
                                          autoplay: nextChecked,
                                        }),
                                      )
                                    }
                                  />
                                  {isGalleryCarousel && selectedGalleryConfig.autoplay ? (
                                    <div style={INSPECTOR_NESTED_GROUP_STYLE}>
                                      <InspectorInputSlider
                                        label="Interval (seconds)"
                                        min={MIN_GALLERY_AUTOPLAY_INTERVAL}
                                        max={MAX_GALLERY_AUTOPLAY_INTERVAL}
                                        step={1}
                                        value={selectedGalleryConfig.interval}
                                        fallbackValue={DEFAULT_GALLERY_CONFIG.interval}
                                        onChange={(next) => {
                                          const numeric =
                                            typeof next === "number" && Number.isFinite(next)
                                              ? next
                                              : DEFAULT_GALLERY_CONFIG.interval;
                                          const rounded = Math.round(numeric);
                                          const clamped = Math.min(
                                            MAX_GALLERY_AUTOPLAY_INTERVAL,
                                            Math.max(MIN_GALLERY_AUTOPLAY_INTERVAL, rounded),
                                          );
                                          updateGalleryConfig(
                                            selectedBlock.id,
                                            (config) => ({
                                              ...config,
                                              interval: clamped,
                                            }),
                                          );
                                        }}
                                      />
                                    </div>
                                  ) : null}
                                </InspectorSection>
                                <InspectorSection title="Effects">
                                  <InspectorInputSlider
                                    label="Corner radius (px)"
                                    value={selectedGalleryConfig.radius}
                                    fallbackValue={
                                      selectedGalleryConfig.radius ?? DEFAULT_GALLERY_CONFIG.radius
                                    }
                                    min={0}
                                    max={50}
                                    step={1}
                                    onChange={(next) => {
                                      updateGalleryConfig(
                                        selectedBlock.id,
                                        (config) => ({
                                          ...config,
                                          radius:
                                            next === undefined || Number.isNaN(next)
                                              ? config.radius
                                              : Math.max(0, Math.round(next)),
                                        }),
                                      );
                                    }}
                                  />
                                </InspectorSection>
                              </div>
                            )}
                          {selectedBlock.kind === "quote" && selectedQuoteConfig
                            ? (() => {
                                const textColorValue =
                                  selectedBlock.textColor ??
                                  selectedBlock.color ??
                                  "#000000";
                                const parsedTextColor =
                                  parseColorValue(textColorValue);
                                const textOpacityPercent = Math.round(
                                  clampRange(parsedTextColor.alpha * 100, 0, 100),
                                );
                                const handleTextColorChange = (nextValue: string) => {
                                  const trimmed = nextValue.trim();
                                  if (!trimmed.length) {
                                    patchBlock(selectedBlock.id, {
                                      textColor: undefined,
                                      color: undefined,
                                    });
                                    return;
                                  }
                                  const parsedNext = parseColorValue(nextValue);
                                  const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed);
                                  const targetAlpha =
                                    isHex && parsedTextColor.alpha < 0.999
                                      ? parsedTextColor.alpha
                                      : parsedNext.alpha;
                                  const resolvedColor =
                                    targetAlpha >= 0.999
                                      ? parsedNext.hex
                                      : hexToRgbaString(parsedNext.hex, targetAlpha);
                                  patchBlock(selectedBlock.id, {
                                    textColor: resolvedColor,
                                    color: resolvedColor,
                                  });
                                };
                                const handleTextOpacityChange = (
                                  next: number | undefined,
                                ) => {
                                  if (next === undefined) {
                                    patchBlock(selectedBlock.id, {
                                      textColor: parsedTextColor.hex,
                                      color: parsedTextColor.hex,
                                    });
                                    return;
                                  }
                                  const clamped = clampRange(next, 0, 100);
                                  const normalized = clamp01(clamped / 100);
                                  if (normalized >= 0.999) {
                                    patchBlock(selectedBlock.id, {
                                      textColor: parsedTextColor.hex,
                                      color: parsedTextColor.hex,
                                    });
                                    return;
                                  }
                                  const nextColor = hexToRgbaString(
                                    parsedTextColor.hex,
                                    normalized,
                                  );
                                  patchBlock(selectedBlock.id, {
                                    textColor: nextColor,
                                    color: nextColor,
                                  });
                                };
                                const fontSizeFallback =
                                  selectedBlock.fontSize ??
                                  (selectedQuoteConfig.style === "emphasis" ? 24 : 16);

                                return (
                                  <div className="space-y-4">
                                    <InspectorSection title="Content">
                                      <InspectorInputTextArea
                                        label="Quote text"
                                        value={selectedQuoteConfig.text}
                                        rows={4}
                                        onChange={(nextValue) =>
                                          updateQuoteConfig(selectedBlock.id, (config) => ({
                                            ...config,
                                            text: nextValue,
                                          }))
                                        }
                                      />
                                      <InspectorInputText
                                        label="Author (optional)"
                                        value={selectedQuoteConfig.author}
                                        onChange={(nextValue) =>
                                          updateQuoteConfig(selectedBlock.id, (config) => ({
                                            ...config,
                                            author: nextValue,
                                          }))
                                        }
                                      />
                                      <ControlRow label="Star rating">
                                        <QuoteStarRatingSelector
                                          value={selectedQuoteConfig.starRating}
                                          disabled={selectedQuoteConfig.useReview}
                                          onChange={(nextValue) =>
                                            updateQuoteConfig(selectedBlock.id, (config) => ({
                                              ...config,
                                              starRating: nextValue,
                                            }))
                                          }
                                        />
                                      </ControlRow>
                                    </InspectorSection>
                                    <InspectorSection title="Typography">
                                      <ControlRow label="Font family">
                                        {(() => {
                                          const value = resolveFontFamilyValue(
                                            selectedBlock.fontFamily,
                                          );
                                          return (
                                            <FontSelect
                                              value={value}
                                              fonts={APP_FONTS}
                                              onChange={(nextValue) =>
                                                handleFontFamilyChange(
                                                  selectedBlock.id,
                                                  nextValue,
                                                )
                                              }
                                            />
                                          );
                                        })()}
                                      </ControlRow>
                                      <InspectorInputSelect
                                        label="Font weight"
                                        value={String(
                                          selectedBlock.fontWeight ??
                                            (selectedQuoteConfig.style === "emphasis"
                                              ? 600
                                              : 400),
                                        )}
                                        onChange={(nextValue) => {
                                          const parsed = Number(nextValue);
                                          patchBlock(selectedBlock.id, {
                                            fontWeight: Number.isNaN(parsed)
                                              ? selectedBlock.fontWeight
                                              : parsed,
                                          });
                                        }}
                                        options={FONT_WEIGHT_OPTIONS.map((option) => ({
                                          label: option.label,
                                          value: String(option.value),
                                        }))}
                                      />
                                      <InspectorInputSlider
                                        label="Font size (px)"
                                        value={selectedBlock.fontSize}
                                        fallbackValue={fontSizeFallback}
                                        min={8}
                                        max={120}
                                        step={1}
                                        onChange={(next) => {
                                          if (next === undefined) {
                                            patchBlock(selectedBlock.id, {
                                              fontSize: undefined,
                                            });
                                            return;
                                          }
                                          const normalized = Math.round(next);
                                          patchBlock(selectedBlock.id, {
                                            fontSize: Number.isNaN(normalized)
                                              ? undefined
                                              : normalized,
                                          });
                                        }}
                                      />
                                      <InspectorInputSlider
                                        label="Line height"
                                        value={selectedBlock.lineHeight}
                                        fallbackValue={selectedBlock.lineHeight ?? 1.2}
                                        min={0.5}
                                        max={3}
                                        step={0.1}
                                        formatValue={(current, fallback) => {
                                          const resolved =
                                            typeof current === "number" &&
                                            Number.isFinite(current)
                                              ? current
                                              : typeof fallback === "number"
                                                ? fallback
                                                : 1.2;
                                          return resolved.toFixed(2);
                                        }}
                                        onChange={(next) => {
                                          if (next === undefined) {
                                            patchBlock(selectedBlock.id, {
                                              lineHeight: undefined,
                                              lineHeightUnit: undefined,
                                            });
                                            return;
                                          }
                                          const normalized = Math.round(next * 100) / 100;
                                          patchBlock(selectedBlock.id, {
                                            lineHeight: normalized,
                                            lineHeightUnit: undefined,
                                          });
                                        }}
                                      />
                                      <InspectorInputSlider
                                        label="Letter spacing (px)"
                                        value={selectedBlock.letterSpacing}
                                        fallbackValue={selectedBlock.letterSpacing ?? 0}
                                        min={-10}
                                        max={20}
                                        step={0.1}
                                        onChange={(next) => {
                                          if (next === undefined) {
                                            patchBlock(selectedBlock.id, {
                                              letterSpacing: undefined,
                                            });
                                            return;
                                          }
                                          const normalized = Math.round(next * 10) / 10;
                                          patchBlock(selectedBlock.id, {
                                            letterSpacing: normalized,
                                          });
                                        }}
                                      />
                                    </InspectorSection>
                                    <InspectorSection title="Color">
                                      <InspectorInputColor
                                        label="Text color"
                                        value={textColorValue}
                                        onChange={handleTextColorChange}
                                      />
                                      <InspectorInputSlider
                                        label="Opacity (%)"
                                        value={textOpacityPercent}
                                        fallbackValue={100}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onChange={handleTextOpacityChange}
                                      />
                                    </InspectorSection>
                                    <InspectorSection title="Alignment">
                                      <InspectorInputSelect
                                        label="Alignment"
                                        value={selectedQuoteConfig.align ?? "left"}
                                        onChange={(nextValue) =>
                                          updateQuoteConfig(selectedBlock.id, (config) => ({
                                            ...config,
                                            align: nextValue as QuoteBlockConfig["align"],
                                          }))
                                        }
                                        options={TEXT_ALIGNMENT_OPTIONS.map((option) => ({
                                          label: option.label,
                                          value: option.value,
                                        }))}
                                      />
                                    </InspectorSection>
                                    <InspectorSection title="Options">
                                      <InspectorInputToggle
                                        label="Use customer review"
                                        checked={selectedQuoteConfig.useReview}
                                        onChange={(checked) =>
                                          updateQuoteConfig(selectedBlock.id, (config) => ({
                                            ...config,
                                            useReview: checked,
                                            reviewId: checked ? config.reviewId : null,
                                          }))
                                        }
                                      />
                                      {selectedQuoteConfig.useReview ? (
                                        reviewOptions.length > 0 ? (
                                          <InspectorInputSelect
                                            label="Review"
                                            value={selectedQuoteConfig.reviewId ?? ""}
                                            onChange={(nextValue) => {
                                              const review = reviewOptions.find(
                                                (option) => option.id === nextValue,
                                              );
                                              updateQuoteConfig(selectedBlock.id, (config) => ({
                                                ...config,
                                                useReview: true,
                                                reviewId: nextValue.length > 0 ? nextValue : null,
                                                text: review ? review.text : config.text,
                                                author: review ? review.author : config.author,
                                              }));
                                            }}
                                            options={[
                                              { value: "", label: "Choose a review…" },
                                              ...reviewOptions.map((option) => ({
                                                value: option.id,
                                                label: formatReviewOptionLabel(option),
                                              })),
                                            ]}
                                          />
                                        ) : (
                                          <ControlRow label="Review">
                                            <span className="text-xs text-neutral-500">
                                              No reviews available.
                                            </span>
                                          </ControlRow>
                                        )
                                      ) : null}
                                    </InspectorSection>
                                    <InspectorSection title="Style">
                                      <InspectorInputSelect
                                        label="Variant"
                                        value={selectedQuoteConfig.style}
                                        onChange={(nextValue) =>
                                          updateQuoteConfig(selectedBlock.id, (config) => ({
                                            ...config,
                                            style: nextValue as QuoteBlockConfig["style"],
                                          }))
                                        }
                                        options={QUOTE_STYLE_OPTIONS.map((option) => ({
                                          label: option.label,
                                          value: option.value,
                                        }))}
                                      />
                                    </InspectorSection>
                                    {(selectedQuoteConfig.style === "emphasis" ||
                                      selectedQuoteConfig.style === "card") && (
                                      <InspectorSection title="Effects">
                                        <InspectorInputSlider
                                          label="Corner radius (px)"
                                          value={selectedQuoteConfig.radius}
                                          fallbackValue={
                                            selectedQuoteConfig.radius ?? DEFAULT_QUOTE_CONFIG.radius
                                          }
                                          min={0}
                                          max={50}
                                          step={1}
                                          onChange={(next) => {
                                            const resolved =
                                              next === undefined || Number.isNaN(next)
                                                ? selectedQuoteConfig.radius ?? DEFAULT_QUOTE_CONFIG.radius
                                                : Math.round(next);
                                            updateQuoteConfig(selectedBlock.id, (config) => ({
                                              ...config,
                                              radius: resolved,
                                            }));
                                          }}
                                        />
                                      </InspectorSection>
                                    )}
                                    {(selectedQuoteConfig.style === "emphasis" ||
                                      selectedQuoteConfig.style === "card") && (
                                      <>
                                        <InspectorSection title="Background">
                                          <InspectorInputColor
                                            label="Color"
                                            value={selectedQuoteConfig.bgColor}
                                            onChange={(nextColor) =>
                                              updateQuoteConfig(selectedBlock.id, (config) => ({
                                                ...config,
                                                bgColor: nextColor,
                                              }))
                                            }
                                          />
                                          <InspectorInputSlider
                                            label="Opacity (%)"
                                            value={
                                              selectedQuoteConfig.bgOpacity !== undefined
                                                ? selectedQuoteConfig.bgOpacity * 100
                                                : undefined
                                            }
                                            fallbackValue={
                                              ((selectedQuoteConfig.bgOpacity ?? DEFAULT_QUOTE_CONFIG.bgOpacity) *
                                                100) || 0
                                            }
                                            min={0}
                                            max={100}
                                            step={1}
                                            onChange={(next) => {
                                              const fallback =
                                                selectedQuoteConfig.bgOpacity ?? DEFAULT_QUOTE_CONFIG.bgOpacity;
                                              const percent =
                                                next === undefined || Number.isNaN(next)
                                                  ? fallback * 100
                                                  : next;
                                              const clampedPercent = Math.min(
                                                100,
                                                Math.max(0, percent ?? 0),
                                              );
                                              updateQuoteConfig(selectedBlock.id, (config) => ({
                                                ...config,
                                                bgOpacity: clamp01(clampedPercent / 100),
                                              }));
                                            }}
                                          />
                                        </InspectorSection>
                                        <InspectorSection title="Spacing">
                                          <InspectorInputSlider
                                            label="Padding (px)"
                                            value={selectedQuoteConfig.padding}
                                            fallbackValue={
                                              selectedQuoteConfig.padding ?? DEFAULT_QUOTE_CONFIG.padding
                                            }
                                            min={0}
                                            max={100}
                                            step={1}
                                            onChange={(next) => {
                                              const resolved =
                                                next === undefined || Number.isNaN(next)
                                                  ? selectedQuoteConfig.padding ?? DEFAULT_QUOTE_CONFIG.padding
                                                  : Math.round(next);
                                              updateQuoteConfig(selectedBlock.id, (config) => ({
                                                ...config,
                                                padding: resolved,
                                              }));
                                            }}
                                          />
                                        </InspectorSection>
                                      </>
                                    )}
                                  </div>
                                );
                              })()
                            : null}
                          <InspectorSection title="Appearance">
                            <InspectorInputToggle
                              label="Enable shadow"
                              checked={shadowEnabled}
                              onChange={(checked) => {
                                if (!selectedBlockId) return;
                                if (checked) {
                                  patchBlock(selectedBlockId, { boxShadow: cachedShadowPreset });
                                  return;
                                }
                                if (currentShadowPreset !== "none") {
                                  shadowPresetCacheRef.current[selectedBlockId] =
                                    currentShadowPreset as BlockShadowPreset;
                                }
                                patchBlock(selectedBlockId, { boxShadow: "none" });
                              }}
                            />
                            {shadowEnabled ? (
                              <div style={INSPECTOR_NESTED_GROUP_STYLE}>
                                <InspectorInputSelect
                                  label="Shadow preset"
                                  value={currentShadowPreset}
                                  onChange={(nextValue) => {
                                    if (!selectedBlockId) return;
                                    const preset = nextValue as BlockShadowPreset;
                                    shadowPresetCacheRef.current[selectedBlockId] = preset;
                                    patchBlock(selectedBlockId, { boxShadow: preset });
                                  }}
                                  options={ENABLED_SHADOW_OPTIONS.map((option) => ({
                                    label: option.label,
                                    value: option.value,
                                  }))}
                                />
                              </div>
                            ) : null}
                            <InspectorInputToggle
                              label="Enable border"
                              checked={borderEnabled}
                              onChange={(checked) => {
                                if (!selectedBlockId) return;
                                if (checked) {
                                  const cached = cachedBorderConfig;
                                  const nextWidth =
                                    typeof cached.width === "number" && cached.width > 0
                                      ? cached.width
                                      : 1;
                                  const patch: Partial<SlideBlock> = {
                                    borderWidth: Math.max(1, Math.round(nextWidth)),
                                    borderColor: cached.color ?? DEFAULT_BORDER_COLOR,
                                  };
                                  if (typeof cached.radius === "number") {
                                    patch.borderRadius = cached.radius;
                                  }
                                  patchBlock(selectedBlockId, patch);
                                  return;
                                }
                                borderCacheRef.current[selectedBlockId] = {
                                  color: borderColorValue ?? cachedBorderConfig.color ?? DEFAULT_BORDER_COLOR,
                                  width:
                                    typeof borderWidthValue === "number" && borderWidthValue > 0
                                      ? borderWidthValue
                                      : cachedBorderConfig.width,
                                  radius: borderRadiusValue ?? cachedBorderConfig.radius,
                                };
                                patchBlock(selectedBlockId, {
                                  borderColor: undefined,
                                  borderWidth: undefined,
                                });
                              }}
                            />
                            {borderEnabled ? (
                              <div style={INSPECTOR_NESTED_GROUP_STYLE}>
                                <InspectorInputColor
                                  label="Border color"
                                  value={selectedBlock.borderColor ?? ""}
                                  onChange={(nextColor) => {
                                    const normalized = nextColor.trim();
                                    patchBlock(selectedBlock.id, {
                                      borderColor:
                                        normalized.length > 0 ? normalized : undefined,
                                    });
                                  }}
                                />
                                <InspectorInputSlider
                                  label="Border width (px)"
                                  value={selectedBlock.borderWidth}
                                  fallbackValue={
                                    selectedBlock.borderWidth ?? cachedBorderConfig.width ?? 0
                                  }
                                  min={0}
                                  max={20}
                                  step={1}
                                  onChange={(next) => {
                                    if (next === undefined || Number.isNaN(next)) {
                                      patchBlock(selectedBlock.id, { borderWidth: undefined });
                                      return;
                                    }
                                    patchBlock(selectedBlock.id, {
                                      borderWidth: Math.max(0, Math.round(next)),
                                    });
                                  }}
                                />
                                <InspectorInputSlider
                                  label="Corner radius (px)"
                                  value={selectedBlock.borderRadius}
                                  fallbackValue={
                                    selectedBlock.borderRadius ??
                                    cachedBorderConfig.radius ??
                                    0
                                  }
                                  min={0}
                                  max={50}
                                  step={1}
                                  onChange={(next) => {
                                    if (next === undefined || Number.isNaN(next)) {
                                      patchBlock(selectedBlock.id, { borderRadius: undefined });
                                      return;
                                    }
                                    patchBlock(selectedBlock.id, {
                                      borderRadius: Math.max(0, Math.round(next)),
                                    });
                                  }}
                                />
                              </div>
                            ) : null}
                          </InspectorSection>
                          <InspectorSection title="Background">
                            <InspectorInputToggle
                              label="Enable background"
                              checked={backgroundEnabled}
                              onChange={(checked) => {
                                if (!selectedBlockId) return;
                                if (checked) {
                                  applyBackgroundType(cachedBackgroundType);
                                  return;
                                }
                                const type = selectedBlockBackground.type;
                                if (type && type !== "none") {
                                  backgroundTypeCacheRef.current[selectedBlockId] = type;
                                }
                                applyBackgroundType("none");
                              }}
                            />
                            {backgroundEnabled ? (
                              <div style={INSPECTOR_NESTED_GROUP_STYLE}>
                                <InspectorInputSelect
                                  label="Style"
                                  value={
                                    selectedBlockBackground.type === "none"
                                      ? cachedBackgroundType
                                      : (selectedBlockBackground.type ??
                                        DEFAULT_ENABLED_BACKGROUND_TYPE)
                                  }
                                  onChange={(nextValue) => {
                                    if (!selectedBlockId) return;
                                    const nextType = nextValue as BlockBackground["type"];
                                    backgroundTypeCacheRef.current[selectedBlockId] = nextType;
                                    applyBackgroundType(nextType);
                                  }}
                                  options={ENABLED_BACKGROUND_STYLE_OPTIONS.map((option) => ({
                                    label: option.label,
                                    value: option.value,
                                  }))}
                                />
                                {selectedBlockBackground.type === "color" ? (
                                  <InspectorInputColor
                                    label="Color"
                                    value={
                                      selectedBlockBackground.color ??
                                      DEFAULT_BLOCK_BACKGROUND_COLOR
                                    }
                                    onChange={(nextColor) => {
                                      updateSelectedBlockBackground((prev) => {
                                        const next = cloneBlockBackground(prev);
                                        const normalized = nextColor.trim();
                                        next.type = "color";
                                        next.color =
                                          normalized.length > 0
                                            ? normalized
                                            : DEFAULT_BLOCK_BACKGROUND_COLOR;
                                        return next;
                                      });
                                    }}
                                  />
                                ) : null}
                                {selectedBlockBackground.type === "gradient" ? (
                                  <>
                                    <InspectorInputColor
                                      label="From"
                                      value={
                                        selectedBlockBackground.color ??
                                        DEFAULT_BLOCK_GRADIENT_FROM
                                      }
                                      onChange={(nextColor) => {
                                        updateSelectedBlockBackground((prev) => {
                                          const next = cloneBlockBackground(prev);
                                          const normalized = nextColor.trim();
                                          next.type = "gradient";
                                          next.color =
                                            normalized.length > 0
                                              ? normalized
                                              : DEFAULT_BLOCK_GRADIENT_FROM;
                                          next.color2 =
                                            next.color2 && next.color2.trim().length > 0
                                              ? next.color2
                                              : DEFAULT_BLOCK_GRADIENT_TO;
                                          next.direction = next.direction ?? "to-bottom";
                                          return next;
                                        });
                                      }}
                                    />
                                    <InspectorInputColor
                                      label="To"
                                      value={
                                        selectedBlockBackground.color2 ??
                                        DEFAULT_BLOCK_GRADIENT_TO
                                      }
                                      onChange={(nextColor) => {
                                        updateSelectedBlockBackground((prev) => {
                                          const next = cloneBlockBackground(prev);
                                          const normalized = nextColor.trim();
                                          next.type = "gradient";
                                          next.color =
                                            next.color && next.color.trim().length > 0
                                              ? next.color
                                              : DEFAULT_BLOCK_GRADIENT_FROM;
                                          next.color2 =
                                            normalized.length > 0
                                              ? normalized
                                              : DEFAULT_BLOCK_GRADIENT_TO;
                                          next.direction = next.direction ?? "to-bottom";
                                          return next;
                                        });
                                      }}
                                    />
                                    <InspectorInputSelect
                                      label="Direction"
                                      value={selectedBlockBackground.direction ?? "to-bottom"}
                                      onChange={(nextValue) => {
                                        const value =
                                          nextValue as BlockBackgroundGradientDirection;
                                        updateSelectedBlockBackground((prev) => {
                                          const next = cloneBlockBackground(prev);
                                          next.type = "gradient";
                                          next.direction = value;
                                          next.color =
                                            next.color && next.color.trim().length > 0
                                              ? next.color
                                              : DEFAULT_BLOCK_GRADIENT_FROM;
                                          next.color2 =
                                            next.color2 && next.color2.trim().length > 0
                                              ? next.color2
                                              : DEFAULT_BLOCK_GRADIENT_TO;
                                          return next;
                                        });
                                      }}
                                      options={BLOCK_BACKGROUND_GRADIENT_DIRECTIONS.map((option) => ({
                                        label: option.label,
                                        value: option.value,
                                      }))}
                                    />
                                  </>
                                ) : null}
                                {selectedBlockBackground.type === "image" ? (
                                  <>
                                    <InspectorInputUpload
                                      label="Upload"
                                      buttonLabel={
                                        selectedBlockBackground.url
                                          ? "Replace image"
                                          : "Upload image"
                                      }
                                      accept="image/*"
                                      uploading={uploading}
                                      onSelectFiles={(files) => {
                                        const file = files?.[0];
                                        if (!file) return;
                                        void handleUpload(file, (url) => {
                                          updateSelectedBlockBackground((prev) => {
                                            const next = cloneBlockBackground(prev);
                                            next.type = "image";
                                            next.url = url;
                                            return next;
                                          });
                                        });
                                      }}
                                    />
                                    <InspectorInputText
                                      label="Image URL"
                                      value={selectedBlockBackground.url ?? ""}
                                      placeholder="https://example.com/image.jpg"
                                      onChange={(nextValue) => {
                                        updateSelectedBlockBackground((prev) => {
                                          const next = cloneBlockBackground(prev);
                                          next.type = "image";
                                          next.url = nextValue;
                                          return next;
                                        });
                                      }}
                                    />
                                  </>
                                ) : null}
                                <InspectorInputSlider
                                  label="Corner radius (px)"
                                  value={selectedBlockBackground.radius}
                                  fallbackValue={selectedBlockBackground.radius ?? 0}
                                  min={0}
                                  max={50}
                                  step={1}
                                  onChange={(next) => {
                                    updateSelectedBlockBackground((prev) => {
                                      const nextBackground = cloneBlockBackground(prev);
                                      const resolved =
                                        next === undefined || Number.isNaN(next)
                                          ? nextBackground.radius ?? 0
                                          : Math.max(0, Math.round(next));
                                      nextBackground.radius = resolved;
                                      return nextBackground;
                                    });
                                  }}
                                />
                                <InspectorInputSlider
                                  label="Opacity (%)"
                                  value={selectedBlockBackground.opacity}
                                  fallbackValue={selectedBlockBackground.opacity ?? 100}
                                  min={0}
                                  max={100}
                                  step={1}
                                  onChange={(next) => {
                                    updateSelectedBlockBackground((prev) => {
                                      const nextBackground = cloneBlockBackground(prev);
                                      const resolved =
                                        next === undefined || Number.isNaN(next)
                                          ? nextBackground.opacity ?? 100
                                          : Math.min(100, Math.max(0, Math.round(next)));
                                      nextBackground.opacity = resolved;
                                      return nextBackground;
                                    });
                                  }}
                                />
                              </div>
                            ) : null}
                          </InspectorSection>
                          <InspectorSection title="Animations">
                            <InspectorInputToggle
                              label="Enable animation"
                              checked={animationEnabled}
                              onChange={(checked) => {
                                if (!selectedBlockId) return;
                                if (checked) {
                                  const nextType = cachedAnimationType;
                                  applyAnimationConfig((prev) => ({
                                    ...prev,
                                    type: nextType,
                                  }));
                                  return;
                                }
                                const type = selectedAnimationConfig.type;
                                if (type && type !== "none") {
                                  animationTypeCacheRef.current[selectedBlockId] = type;
                                }
                                applyAnimationConfig((prev) => ({ ...prev, type: "none" }));
                              }}
                            />
                            {animationEnabled ? (
                              <div style={INSPECTOR_NESTED_GROUP_STYLE}>
                                <InspectorInputSelect
                                  label="Entry animation"
                                  value={selectedAnimationConfig.type}
                                  onChange={(nextValue) => {
                                    if (!selectedBlockId) return;
                                    const nextType = nextValue as BlockAnimationType;
                                    animationTypeCacheRef.current[selectedBlockId] = nextType;
                                    applyAnimationConfig((prev) => ({ ...prev, type: nextType }));
                                  }}
                                  options={ENABLED_ANIMATION_OPTIONS.map((option) => ({
                                    label: option.label,
                                    value: option.value,
                                  }))}
                                />
                                <InspectorInputSlider
                                  label="Duration (ms)"
                                  value={selectedAnimationConfig.duration}
                                  fallbackValue={
                                    selectedAnimationConfig.duration ??
                                    DEFAULT_BLOCK_ANIMATION_CONFIG.duration
                                  }
                                  min={0}
                                  max={5000}
                                  step={50}
                                  onChange={(next) => {
                                    const fallback =
                                      selectedAnimationConfig.duration ??
                                      DEFAULT_BLOCK_ANIMATION_CONFIG.duration;
                                    const resolved =
                                      next === undefined || Number.isNaN(next)
                                        ? fallback
                                        : Math.max(0, Math.round(next));
                                    applyAnimationConfig((prev) => ({
                                      ...prev,
                                      duration: resolved,
                                    }));
                                  }}
                                />
                                <InspectorInputSlider
                                  label="Delay (ms)"
                                  value={selectedAnimationConfig.delay}
                                  fallbackValue={
                                    selectedAnimationConfig.delay ??
                                    DEFAULT_BLOCK_ANIMATION_CONFIG.delay
                                  }
                                  min={0}
                                  max={5000}
                                  step={50}
                                  onChange={(next) => {
                                    const fallback =
                                      selectedAnimationConfig.delay ??
                                      DEFAULT_BLOCK_ANIMATION_CONFIG.delay;
                                    const resolved =
                                      next === undefined || Number.isNaN(next)
                                        ? fallback
                                        : Math.max(0, Math.round(next));
                                    applyAnimationConfig((prev) => ({
                                      ...prev,
                                      delay: resolved,
                                    }));
                                  }}
                                />
                              </div>
                            ) : null}
                          </InspectorSection>
                          <InspectorSection title="Transitions">
                            <InspectorInputToggle
                              label="Enable hover effect"
                              checked={transitionEnabled}
                              onChange={(checked) => {
                                if (!selectedBlockId) return;
                                if (checked) {
                                  const nextHover = cachedTransitionHover;
                                  applyTransitionConfig((prev) => ({
                                    ...prev,
                                    hover: nextHover,
                                  }));
                                  return;
                                }
                                const hover = selectedTransitionConfig.hover;
                                if (hover && hover !== "none") {
                                  transitionHoverCacheRef.current[selectedBlockId] = hover;
                                }
                                applyTransitionConfig((prev) => ({ ...prev, hover: "none" }));
                              }}
                            />
                            {transitionEnabled ? (
                              <div style={INSPECTOR_NESTED_GROUP_STYLE}>
                                <InspectorInputSelect
                                  label="Hover effect"
                                  value={selectedTransitionConfig.hover}
                                  onChange={(nextValue) => {
                                    if (!selectedBlockId) return;
                                    const nextHover = nextValue as BlockHoverTransition;
                                    transitionHoverCacheRef.current[selectedBlockId] = nextHover;
                                    applyTransitionConfig((prev) => ({
                                      ...prev,
                                      hover: nextHover,
                                    }));
                                  }}
                                  options={ENABLED_TRANSITION_OPTIONS.map((option) => ({
                                    label: option.label,
                                    value: option.value,
                                  }))}
                                />
                                <InspectorInputSlider
                                  label="Transition duration (ms)"
                                  value={selectedTransitionConfig.duration}
                                  fallbackValue={
                                    selectedTransitionConfig.duration ??
                                    DEFAULT_BLOCK_TRANSITION_CONFIG.duration
                                  }
                                  min={0}
                                  max={5000}
                                  step={50}
                                  onChange={(next) => {
                                    const fallback =
                                      selectedTransitionConfig.duration ??
                                      DEFAULT_BLOCK_TRANSITION_CONFIG.duration;
                                    const resolved =
                                      next === undefined || Number.isNaN(next)
                                        ? fallback
                                        : Math.max(0, Math.round(next));
                                    applyTransitionConfig((prev) => ({
                                      ...prev,
                                      duration: resolved,
                                    }));
                                  }}
                                />
                              </div>
                            ) : null}
                          </InspectorSection>
                          <InspectorSection title="Visibility">
                            {DEVICE_VISIBILITY_CONTROLS.map(({ key, label }) => (
                              <InspectorInputToggle
                                key={key}
                                label={label}
                                checked={selectedVisibilityConfig[key]}
                                onChange={(checked) =>
                                  updateVisibilityConfig(selectedBlock.id, (config) => ({
                                    ...config,
                                    [key]: checked,
                                  }))
                                }
                              />
                            ))}
                          </InspectorSection>

                        </div>
                    </section>
                  </div>
                </div>
              </aside>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { SlideCfg } from "./SlidesManager";
