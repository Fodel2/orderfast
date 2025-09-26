import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  resolveButtonConfig,
  resolveImageConfig,
  resolveGalleryConfig,
  resolveQuoteConfig,
  resolveBlockVisibility,
  resolveBlockAnimationConfig,
  resolveBlockTransitionConfig,
  DEFAULT_BLOCK_ANIMATION_CONFIG,
  DEFAULT_BLOCK_TRANSITION_CONFIG,
  FONT_FAMILY_SELECT_OPTIONS,
  DEFAULT_TEXT_FONT_FAMILY,
  DEFAULT_TEXT_PLACEHOLDER,
  normalizeFontFamily,
  readTextSizingConfig,
  pickTextSizingDimensions,
  writeTextSizingToConfig,
  updateConfigWithTextContent,
} from "./SlidesManager";
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
import { supabase } from "@/utils/supabaseClient";
import { STORAGE_BUCKET } from "@/lib/storage";
import { SlideRow } from "@/components/customer/home/SlidesContainer";
import { LockClosedIcon } from "@heroicons/react/24/solid";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

const ROUTE_OPTIONS = ["/menu", "/orders", "/more"];

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

const BLOCK_BACKGROUND_TYPE_OPTIONS: {
  value: NonNullable<BlockBackground["type"]>;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "color", label: "Color" },
  { value: "gradient", label: "Gradient" },
  { value: "image", label: "Image" },
];

const BLOCK_BACKGROUND_GRADIENT_DIRECTIONS: {
  value: BlockBackgroundGradientDirection;
  label: string;
}[] = [
  { value: "to-top", label: "To top" },
  { value: "to-bottom", label: "To bottom" },
  { value: "to-left", label: "To left" },
  { value: "to-right", label: "To right" },
];

const BLOCK_ANIMATION_OPTIONS: { value: BlockAnimationType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade-in", label: "Fade In" },
  { value: "slide-in-left", label: "Slide In Left" },
  { value: "slide-in-right", label: "Slide In Right" },
  { value: "slide-in-up", label: "Slide In Up" },
  { value: "slide-in-down", label: "Slide In Down" },
  { value: "zoom-in", label: "Zoom In" },
];

const BLOCK_TRANSITION_OPTIONS: { value: BlockHoverTransition; label: string }[] = [
  { value: "none", label: "None" },
  { value: "grow", label: "Grow" },
  { value: "shrink", label: "Shrink" },
  { value: "pulse", label: "Pulse" },
  { value: "shadow", label: "Shadow" },
  { value: "rotate", label: "Rotate" },
];

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
  blur: 6,
  color: "#000000",
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

const PREVIEW_PADDING_X = 16;
const PREVIEW_PADDING_Y = 16;

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

const INSPECTOR_TEXTAREA_CLASS = [
  INSPECTOR_INPUT_CLASS,
  "min-h-[84px]",
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

function normalizeBlockBackground(raw: any): BlockBackground {
  if (!raw) {
    return { type: "none" };
  }
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "none") {
      return { type: "none" };
    }
  }
  if (typeof raw !== "object") {
    return { type: "none" };
  }
  const typeValue =
    typeof raw.type === "string"
      ? raw.type.toLowerCase()
      : typeof raw.kind === "string"
        ? raw.kind.toLowerCase()
        : undefined;
  const type: BlockBackground["type"] =
    typeValue === "color" || typeValue === "gradient" || typeValue === "image" || typeValue === "none"
      ? (typeValue as BlockBackground["type"])
      : "none";

  if (type === "none") {
    return { type: "none" };
  }

  if (type === "color") {
    const color =
      typeof raw.color === "string"
        ? raw.color
        : typeof raw.value === "string"
          ? raw.value
          : DEFAULT_BLOCK_BACKGROUND_COLOR;
    return { type: "color", color };
  }

  if (type === "gradient") {
    const source =
      raw.gradient && typeof raw.gradient === "object" ? raw.gradient : raw;
    const from =
      typeof source.from === "string"
        ? source.from
        : typeof source.start === "string"
          ? source.start
          : typeof source.color1 === "string"
            ? source.color1
            : DEFAULT_BLOCK_GRADIENT_FROM;
    const to =
      typeof source.to === "string"
        ? source.to
        : typeof source.end === "string"
          ? source.end
          : typeof source.color2 === "string"
            ? source.color2
            : DEFAULT_BLOCK_GRADIENT_TO;
    const directionValue =
      typeof source.direction === "string"
        ? source.direction.replace(/\s+/g, "-").toLowerCase()
        : typeof raw.direction === "string"
          ? raw.direction.replace(/\s+/g, "-").toLowerCase()
          : undefined;
    const direction: BlockBackgroundGradientDirection =
      directionValue === "to-top" ||
      directionValue === "to-left" ||
      directionValue === "to-right" ||
      directionValue === "to-bottom"
        ? (directionValue as BlockBackgroundGradientDirection)
        : "to-bottom";
    return {
      type: "gradient",
      gradient: {
        from,
        to,
        direction,
      },
    };
  }

  const imageSource =
    raw.image && typeof raw.image === "object" ? raw.image : raw;
  const url =
    typeof imageSource.url === "string"
      ? imageSource.url
      : typeof imageSource.src === "string"
        ? imageSource.src
        : typeof raw.url === "string"
          ? raw.url
          : undefined;
  return {
    type: "image",
    image: { url },
  };
}

function cloneBlockBackground(background?: BlockBackground | null): BlockBackground {
  if (!background || typeof background !== "object") {
    return { type: "none" };
  }
  return {
    type: background.type ?? "none",
    color: background.color,
    gradient: background.gradient
      ? {
          from: background.gradient.from,
          to: background.gradient.to,
          direction: background.gradient.direction,
        }
      : undefined,
    image: background.image
      ? {
          url: background.image.url,
        }
      : undefined,
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
    const imageConfig = resolveImageConfig(block);
    block.config = { ...imageConfig };
    block.src = imageConfig.url;
    block.fit = imageConfig.fit;
    block.radius = imageConfig.radius;
    block.alt = imageConfig.alt;
    workingConfig = extractConfig(block.config);
  }
  if (kind === "gallery") {
    const galleryConfig = resolveGalleryConfig(block);
    block.items = galleryConfig.items.map((item) => ({ src: item.url, alt: item.alt }));
    block.config = { ...(block.config ?? {}), ...galleryConfig };
    block.radius = galleryConfig.radius;
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
  if (kind === "gallery") {
    block.config = { ...DEFAULT_GALLERY_CONFIG };
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
      if (raw.textShadow && typeof raw.textShadow === "object") {
        const shadow = raw.textShadow;
        const x = typeof shadow.x === "number" ? shadow.x : DEFAULT_TEXT_SHADOW.x;
        const y = typeof shadow.y === "number" ? shadow.y : DEFAULT_TEXT_SHADOW.y;
        const blur =
          typeof shadow.blur === "number" ? shadow.blur : DEFAULT_TEXT_SHADOW.blur;
        const color =
          typeof shadow.color === "string"
            ? shadow.color
            : DEFAULT_TEXT_SHADOW.color;
        block.textShadow = { x, y, blur, color };
      } else if (raw.textShadow === null || raw.textShadow === false) {
        block.textShadow = null;
      } else if (block.textShadow === undefined) {
        block.textShadow = null;
      }
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
  block.background = normalizeBlockBackground(backgroundSource);

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
  const [customPages, setCustomPages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showGalleryAddOptions, setShowGalleryAddOptions] = useState(false);
  const [galleryUrlInput, setGalleryUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const pastRef = useRef<SlideCfg[]>([]);
  const futureRef = useRef<SlideCfg[]>([]);
  const [, forceHistoryTick] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const blockImageInputRef = useRef<HTMLInputElement | null>(null);
  const blockBackgroundImageInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const videoPosterInputRef = useRef<HTMLInputElement | null>(null);
  const isManipulatingRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const reviewOptions = DEFAULT_REVIEW_OPTIONS;

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
    if (!restaurantId) return;
    supabase
      .from("custom_pages")
      .select("slug")
      .eq("restaurant_id", restaurantId)
      .order("slug")
      .then(({ data }) => {
        if (data) setCustomPages(data.map((row) => `/p/${row.slug}`));
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
    handleSelectBlock(id);
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
    const match = FONT_FAMILY_SELECT_OPTIONS.find(
      (option) => option.value === normalized,
    );
    return match ? match.value : DEFAULT_TEXT_FONT_FAMILY;
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
          };
          const previous = extractConfig(b.config);
          const candidate = { ...previous, ...sanitized };
          return {
            ...b,
            src: sanitized.url,
            fit: sanitized.fit,
            radius: sanitized.radius,
            alt: sanitized.alt,
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
                  const alt =
                    typeof item.alt === "string" && item.alt.trim().length > 0
                      ? item.alt
                      : undefined;
                  const normalized: GalleryBlockItem = alt ? { url, alt } : { url };
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
          const radiusCandidate =
            Number.isFinite(radiusRaw) && radiusRaw >= 0
              ? radiusRaw
              : DEFAULT_GALLERY_CONFIG.radius;
          const sanitized: GalleryBlockConfig = {
            items: sanitizedItems,
            layout: next.layout === "carousel" ? "carousel" : "grid",
            autoplay:
              next.layout === "carousel" ? Boolean(next.autoplay) : false,
            interval: Math.max(200, intervalCandidate),
            radius: radiusCandidate,
            shadow: Boolean(next.shadow),
          };
          const previous = extractConfig(b.config);
          const candidate = { ...previous, ...sanitized };
          return {
            ...b,
            config: mergeInteractionConfig({ ...b, config: candidate }, candidate),
            items: sanitized.items.map((item) => ({
              src: item.url,
              alt: item.alt,
            })),
            radius: sanitized.radius,
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

  const updateFrameField = (id: string, field: keyof Frame, value: number) => {
    updateCfg((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => {
        if (b.id !== id) return b;
        const existing = ensureFrame(b, activeDevice);
        const nextFrame: Frame = {
          ...existing,
          [field]: field === "r" ? value : clampPct(value),
        };
        const updatedFrames = {
          ...b.frames,
          [activeDevice]: nextFrame,
        };
        if (!isTextualBlock(b.kind)) {
          return {
            ...b,
            frames: updatedFrames,
          };
        }
        const previous = extractConfig(b.config);
        const nextConfig = writeTextSizingToConfig(previous, activeDevice, nextFrame);
        return {
          ...b,
          frames: updatedFrames,
          config: mergeInteractionConfig({ ...b, frames: updatedFrames, config: nextConfig }, nextConfig),
        };
      }),
    }));
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
      setInspectorOpen(false);
    } else if (selectedIdRef.current) {
      setInspectorOpen(true);
    }
  }, []);

  const handleSelectBlock = useCallback((id: string | null) => {
    setSelectedId(id);
    selectedIdRef.current = id;
    if (!id) {
      setInspectorOpen(false);
      return;
    }
    if (!isManipulatingRef.current) {
      setInspectorOpen(true);
    }
  }, []);

  const openInspectorForSelection = useCallback(() => {
    if (isManipulatingRef.current) return;
    if (!selectedIdRef.current) return;
    setInspectorOpen(true);
  }, []);

  const handleCanvasClick = useCallback(() => {
    handleSelectBlock(null);
  }, [handleSelectBlock]);

  const handleLayerSelect = useCallback(
    (id: string) => {
      handleSelectBlock(id);
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
      handleSelectBlock(newId);
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
  const scale = useMemo(() => {
    if (availableWidth <= 0 || availableHeight <= 0) return 1;
    const widthScale = availableWidth / deviceWidth;
    const heightScale = availableHeight / deviceHeight;
    const computed = Math.min(widthScale, heightScale, 1);
    if (!Number.isFinite(computed) || computed <= 0) return 1;
    return computed;
  }, [availableWidth, availableHeight, deviceHeight, deviceWidth]);

  const selectedBlock = useMemo(
    () => cfg.blocks.find((b) => b.id === selectedId) || null,
    [cfg.blocks, selectedId],
  );

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

  const selectedGalleryConfig = useMemo(
    () =>
      selectedBlock?.kind === "gallery"
        ? resolveGalleryConfig(selectedBlock)
        : null,
    [selectedBlock],
  );

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
    setShowGalleryAddOptions(false);
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

  const frame = selectedBlock ? ensureFrame(selectedBlock, activeDevice) : null;

  const linkOptions = useMemo(
    () => [...ROUTE_OPTIONS, ...customPages, "custom"],
    [customPages],
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
                          "spacer",
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
            <div className="flex flex-1 flex-col overflow-hidden">
              <main className="flex flex-1 overflow-hidden bg-neutral-50">
                <div
                  ref={previewContainerRef}
                  className="flex h-full w-full min-h-0 overflow-hidden"
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
                        scale={scale}
                        onManipulationChange={handleManipulationChange}
                      />
                    )}
                  </div>
                </div>
              </main>
              {inspectorOpen && selectedBlock && (
                <div className="border-t bg-white">
                  <div className="max-h-[60vh] overflow-y-auto">
                    <div className="sticky top-0 z-10 border-b bg-white px-4 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                          Inspector
                        </span>
                        <span className="text-xs text-neutral-500">
                          Selected: {selectionLabel}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-neutral-900">
                            {selectionLabel}
                          </span>
                          {selectedBlock.locked && (
                            <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                              Locked
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
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
                    <div className={INSPECTOR_CONTENT_CLASS}>
                      <section>
                        <div className="mt-2 space-y-3 text-sm">
                          {(selectedBlock.kind === "heading" ||
                            selectedBlock.kind === "text") && (
                            <>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Content
                                </span>
                                <textarea
                                  rows={4}
                                  value={
                                    selectedBlock.content ?? selectedBlock.text ?? ""
                                  }
                                  onChange={(e) =>
                                    patchBlock(selectedBlock.id, {
                                      content: e.target.value,
                                      text: e.target.value,
                                    })
                                  }
                                  className={INSPECTOR_TEXTAREA_CLASS}
                                />
                              </label>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Font family
                                  </span>
                                  {(() => {
                                    const value = resolveFontFamilyValue(
                                      selectedBlock.fontFamily,
                                    );
                                    const option = FONT_FAMILY_SELECT_OPTIONS.find(
                                      (item) => item.value === value,
                                    );
                                    return (
                                      <InputSelect
                                        value={value}
                                        onChange={(e) =>
                                          handleFontFamilyChange(
                                            selectedBlock.id,
                                            e.target.value,
                                          )
                                        }
                                        style={{
                                          fontFamily: option?.previewStack,
                                        }}
                                      >
                                        {FONT_FAMILY_SELECT_OPTIONS.map((opt) => (
                                          <option
                                            key={opt.value}
                                            value={opt.value}
                                            style={{ fontFamily: opt.previewStack }}
                                          >
                                            {opt.label}
                                          </option>
                                        ))}
                                      </InputSelect>
                                    );
                                  })()}
                                </label>
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Font weight
                                  </span>
                                  <InputSelect
                                    value={String(
                                      selectedBlock.fontWeight ??
                                        (selectedBlock.kind === "heading" ? 700 : 400),
                                    )}
                                    onChange={(e) => {
                                      const parsed = Number(e.target.value);
                                      patchBlock(selectedBlock.id, {
                                        fontWeight: Number.isNaN(parsed)
                                          ? selectedBlock.fontWeight
                                          : parsed,
                                      });
                                    }}
                                    options={FONT_WEIGHT_OPTIONS}
                                  />
                                </label>
                              </div>
                              <div className="space-y-3">
                                <InspectorSliderControl
                                  label="Font size (px)"
                                  value={selectedBlock.fontSize}
                                  fallbackValue={
                                    selectedBlock.fontSize ??
                                    (selectedBlock.size
                                      ? SIZE_TO_FONT_SIZE_PX[selectedBlock.size]
                                      : TEXT_KIND_FONT_DEFAULT[selectedBlock.kind] ?? 16) ?? 16
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
                                <InspectorSliderControl
                                  label="Line height"
                                  value={selectedBlock.lineHeight}
                                  fallbackValue={
                                    selectedBlock.lineHeight ?? 1.2
                                  }
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
                              </div>
                              <InspectorSliderControl
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
                                  patchBlock(selectedBlock.id, {
                                    letterSpacing: next,
                                  });
                                }}
                              />
                              <div>
                                <span className="text-xs font-medium text-neutral-500">
                                  Text color
                                </span>
                                <InspectorColorInput
                                  value={
                                    selectedBlock.textColor ??
                                    selectedBlock.color ??
                                    "#000000"
                                  }
                                  onChange={(nextColor) =>
                                    patchBlock(selectedBlock.id, {
                                      textColor: nextColor,
                                      color: nextColor,
                                    })
                                  }
                                  allowAlpha
                                />
                              </div>
                              <div>
                                <label className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                                  <InputCheckbox
                                    
                                    checked={Boolean(selectedBlock.textShadow)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        patchBlock(selectedBlock.id, {
                                          textShadow:
                                            selectedBlock.textShadow ?? {
                                              ...DEFAULT_TEXT_SHADOW,
                                            },
                                        });
                                      } else {
                                        patchBlock(selectedBlock.id, {
                                          textShadow: null,
                                        });
                                      }
                                    }}
                                  />
                                  Text shadow
                                </label>
                                {selectedBlock.textShadow && (
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    {([
                                      ["x", "X"],
                                      ["y", "Y"],
                                    ] as const).map(([key, label]) => (
                                      <label key={key} className="block text-xs">
                                        <span className="font-medium text-neutral-500">
                                          {label}
                                        </span>
                                        <InputNumber
                                          
                                          value={selectedBlock.textShadow?.[key] ?? DEFAULT_TEXT_SHADOW[key]}
                                          onChange={(e) => {
                                            const value = Number(e.target.value);
                                            const current =
                                              selectedBlock.textShadow ?? {
                                                ...DEFAULT_TEXT_SHADOW,
                                              };
                                            patchBlock(selectedBlock.id, {
                                              textShadow: {
                                                ...current,
                                                [key]: Number.isNaN(value)
                                                  ? current[key]
                                                  : value,
                                              },
                                            });
                                          }}
                                          className={INSPECTOR_INPUT_CLASS}
                                        />
                                      </label>
                                    ))}
                                    <div className="col-span-2">
                                      <InspectorSliderControl
                                        label="Blur"
                                        value={selectedBlock.textShadow?.blur}
                                        fallbackValue={DEFAULT_TEXT_SHADOW.blur}
                                        min={0}
                                        max={20}
                                        step={1}
                                        onChange={(next) => {
                                          const current =
                                            selectedBlock.textShadow ?? {
                                              ...DEFAULT_TEXT_SHADOW,
                                            };
                                          const resolved =
                                            next === undefined || Number.isNaN(next)
                                              ? current.blur
                                              : Math.max(0, Math.round(next));
                                          patchBlock(selectedBlock.id, {
                                            textShadow: {
                                              ...current,
                                              blur: resolved,
                                            },
                                          });
                                        }}
                                      />
                                    </div>
                                    <label className="col-span-2 block text-xs">
                                      <span className="font-medium text-neutral-500">
                                        Color
                                      </span>
                                      <InspectorColorInput
                                        value={
                                          selectedBlock.textShadow?.color ??
                                          DEFAULT_TEXT_SHADOW.color
                                        }
                                        onChange={(nextColor) => {
                                          const current =
                                            selectedBlock.textShadow ?? {
                                              ...DEFAULT_TEXT_SHADOW,
                                            };
                                          patchBlock(selectedBlock.id, {
                                            textShadow: {
                                              ...current,
                                              color: nextColor,
                                            },
                                          });
                                        }}
                                        allowAlpha
                                      />
                                    </label>
                                  </div>
                                )}
                              </div>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Background style
                                </span>
                                <InputSelect
                                  value={selectedBlock.bgStyle ?? "none"}
                                  onChange={(e) => {
                                    const value = e.target.value as SlideBlock["bgStyle"];
                                    if (value === "none") {
                                      patchBlock(selectedBlock.id, {
                                        bgStyle: "none",
                                      });
                                      return;
                                    }
                                    patchBlock(selectedBlock.id, {
                                      bgStyle: value,
                                      bgColor:
                                        selectedBlock.bgColor ?? "#000000",
                                      bgOpacity:
                                        selectedBlock.bgOpacity ??
                                        (value === "glass" ? 0.5 : 1),
                                      radius: selectedBlock.radius ?? 0,
                                      padding: selectedBlock.padding ?? 0,
                                    });
                                  }}
                                  options={BACKGROUND_STYLE_OPTIONS}
                                />
                              </label>
                              {selectedBlock.bgStyle &&
                                selectedBlock.bgStyle !== "none" && (
                                  <div className="space-y-3">
                                    <div>
                                      <span className="text-xs font-medium text-neutral-500">
                                        Background color
                                      </span>
                                      <InspectorColorInput
                                        value={selectedBlock.bgColor ?? "#000000"}
                                        onChange={(nextColor) =>
                                          patchBlock(selectedBlock.id, {
                                            bgColor: nextColor,
                                          })
                                        }
                                      />
                                    </div>
                                    <InspectorSliderControl
                                      label="Opacity"
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
                                    <InspectorSliderControl
                                      label="Corner radius (px)"
                                      value={selectedBlock.radius}
                                      fallbackValue={selectedBlock.radius ?? 0}
                                      min={0}
                                      max={50}
                                      step={1}
                                      onChange={(next) => {
                                        const resolved = next === undefined ? 0 : Math.round(next);
                                        patchBlock(selectedBlock.id, {
                                          radius: resolved,
                                        });
                                      }}
                                    />
                                    <InspectorSliderControl
                                      label="Padding (px)"
                                      value={selectedBlock.padding}
                                      fallbackValue={selectedBlock.padding ?? 0}
                                      min={0}
                                      max={100}
                                      step={1}
                                      onChange={(next) => {
                                        const resolved = next === undefined ? 0 : Math.round(next);
                                        patchBlock(selectedBlock.id, {
                                          padding: resolved,
                                        });
                                      }}
                                    />
                                  </div>
                                )}
                              <div>
                                <span className="text-xs font-medium text-neutral-500">
                                  Alignment
                                </span>
                                <div className="mt-1 flex gap-1.5">
                                  {TEXT_ALIGNMENT_OPTIONS.map((option) => {
                                    const currentAlign = selectedBlock.align ?? "left";
                                    const isActive = currentAlign === option.value;
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                          patchBlock(selectedBlock.id, {
                                            align: option.value,
                                          })
                                        }
                                        className={`flex-1 rounded border px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                                          isActive
                                            ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                                            : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                                        }`}
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                          {selectedBlock.kind === "subheading" && (
                            <>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Text
                                </span>
                                <textarea
                                  rows={3}
                                  value={selectedBlock.text ?? ""}
                                  onChange={(e) =>
                                    patchBlock(selectedBlock.id, {
                                      text: e.target.value,
                                      content: e.target.value,
                                    })
                                  }
                                  className={INSPECTOR_TEXTAREA_CLASS}
                                />
                              </label>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Font family
                                  </span>
                                  {(() => {
                                    const value = resolveFontFamilyValue(
                                      selectedBlock.fontFamily,
                                    );
                                    const option = FONT_FAMILY_SELECT_OPTIONS.find(
                                      (item) => item.value === value,
                                    );
                                    return (
                                      <InputSelect
                                        value={value}
                                        onChange={(e) =>
                                          handleFontFamilyChange(
                                            selectedBlock.id,
                                            e.target.value,
                                          )
                                        }
                                        style={{
                                          fontFamily: option?.previewStack,
                                        }}
                                      >
                                        {FONT_FAMILY_SELECT_OPTIONS.map((opt) => (
                                          <option
                                            key={opt.value}
                                            value={opt.value}
                                            style={{ fontFamily: opt.previewStack }}
                                          >
                                            {opt.label}
                                          </option>
                                        ))}
                                      </InputSelect>
                                    );
                                  })()}
                                </label>
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Font weight
                                  </span>
                                  <InputSelect
                                    value={String(selectedBlock.fontWeight ?? 600)}
                                    onChange={(e) => {
                                      const parsed = Number(e.target.value);
                                      patchBlock(selectedBlock.id, {
                                        fontWeight: Number.isNaN(parsed)
                                          ? selectedBlock.fontWeight
                                          : parsed,
                                      });
                                    }}
                                    options={FONT_WEIGHT_OPTIONS}
                                  />
                                </label>
                              </div>
                              <div className="space-y-3">
                                <InspectorSliderControl
                                  label="Font size (px)"
                                  value={selectedBlock.fontSize}
                                  fallbackValue={
                                    selectedBlock.fontSize ??
                                    (selectedBlock.size
                                      ? SIZE_TO_FONT_SIZE_PX[selectedBlock.size]
                                      : SIZE_TO_FONT_SIZE_PX.md) ?? 16
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
                                <InspectorSliderControl
                                  label="Line height"
                                  value={selectedBlock.lineHeight}
                                  fallbackValue={
                                    selectedBlock.lineHeight ?? 1.2
                                  }
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
                              </div>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Color
                                </span>
                                <InspectorColorInput
                                  value={selectedBlock.color || "#ffffff"}
                                  onChange={(nextColor) =>
                                    patchBlock(selectedBlock.id, {
                                      color: nextColor,
                                      textColor: nextColor,
                                    })
                                  }
                                  allowAlpha
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Size
                                </span>
                                <InputSelect
                                  value={selectedBlock.size || "md"}
                                  onChange={(e) =>
                                    patchBlock(selectedBlock.id, {
                                      size: e.target.value as any,
                                    })
                                  }
                                  options={TEXT_SIZES}
                                />
                              </label>
                              <div>
                                <span className="text-xs font-medium text-neutral-500">
                                  Alignment
                                </span>
                                <div className="mt-1 flex gap-1.5">
                                  {TEXT_ALIGNMENT_OPTIONS.map((option) => {
                                    const currentAlign = selectedBlock.align ?? "left";
                                    const isActive = currentAlign === option.value;
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                          patchBlock(selectedBlock.id, {
                                            align: option.value,
                                          })
                                        }
                                        className={`flex-1 rounded border px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                                          isActive
                                            ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                                            : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                                        }`}
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                          {selectedBlock.kind === "button" && selectedButtonConfig && (
                            <div className="space-y-4">
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Label
                                </span>
                                <InputText
                                  type="text"
                                  value={selectedButtonConfig.label}
                                  onChange={(e) =>
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      label: e.target.value,
                                    }))
                                  }
                                  className={INSPECTOR_INPUT_CLASS}
                                />
                              </label>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Font family
                                  </span>
                                  {(() => {
                                    const value = resolveFontFamilyValue(
                                      selectedBlock.fontFamily,
                                    );
                                    const option = FONT_FAMILY_SELECT_OPTIONS.find(
                                      (item) => item.value === value,
                                    );
                                    return (
                                      <InputSelect
                                        value={value}
                                        onChange={(e) =>
                                          handleFontFamilyChange(
                                            selectedBlock.id,
                                            e.target.value,
                                          )
                                        }
                                        style={{
                                          fontFamily: option?.previewStack,
                                        }}
                                      >
                                        {FONT_FAMILY_SELECT_OPTIONS.map((opt) => (
                                          <option
                                            key={opt.value}
                                            value={opt.value}
                                            style={{ fontFamily: opt.previewStack }}
                                          >
                                            {opt.label}
                                          </option>
                                        ))}
                                      </InputSelect>
                                    );
                                  })()}
                                </label>
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Font weight
                                  </span>
                                  <InputSelect
                                    value={String(selectedBlock.fontWeight ?? 600)}
                                    onChange={(e) => {
                                      const parsed = Number(e.target.value);
                                      patchBlock(selectedBlock.id, {
                                        fontWeight: Number.isNaN(parsed)
                                          ? selectedBlock.fontWeight
                                          : parsed,
                                      });
                                    }}
                                    options={FONT_WEIGHT_OPTIONS}
                                  />
                                </label>
                              </div>
                              <div className="space-y-3">
                                <InspectorSliderControl
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
                                <InspectorSliderControl
                                  label="Line height"
                                  value={selectedBlock.lineHeight}
                                  fallbackValue={
                                    selectedBlock.lineHeight ?? 1.2
                                  }
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
                              </div>
                              <div>
                                <span className="text-xs font-medium text-neutral-500">
                                  Alignment
                                </span>
                                <div className="mt-1 flex gap-1.5">
                                  {TEXT_ALIGNMENT_OPTIONS.map((option) => {
                                    const currentAlign = selectedBlock.align ?? "left";
                                    const isActive = currentAlign === option.value;
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                          patchBlock(selectedBlock.id, {
                                            align: option.value,
                                          })
                                        }
                                        className={`flex-1 rounded border px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                                          isActive
                                            ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                                            : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                                        }`}
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-neutral-500">
                                  Link
                                </span>
                                <div className="mt-1 space-y-2">
                                  <InputSelect
                                    value={
                                      linkOptions.includes(selectedButtonConfig.href)
                                        ? selectedButtonConfig.href
                                        : "custom"
                                    }
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === "custom") {
                                        updateButtonConfig(selectedBlock.id, (config) => ({
                                          ...config,
                                          href:
                                            config.href && !linkOptions.includes(config.href)
                                              ? config.href
                                              : "",
                                        }));
                                        return;
                                      }
                                      updateButtonConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        href: value,
                                      }));
                                    }}
                                    options={linkOptions.map((opt) => ({
                                      value: opt,
                                      label: opt === "custom" ? "Custom URL" : opt,
                                    }))}
                                  />
                                  <InputText
                                    type="text"
                                    value={selectedButtonConfig.href}
                                    onChange={(e) =>
                                      updateButtonConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        href: e.target.value,
                                      }))
                                    }
                                    className={INSPECTOR_INPUT_CLASS}
                                    placeholder="https://"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Variant
                                  </span>
                                  <InputSelect
                                    value={selectedButtonConfig.variant}
                                    onChange={(e) =>
                                      updateButtonConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        variant: e.target.value as ButtonBlockVariant,
                                      }))
                                    }
                                    options={BUTTON_VARIANTS.map((variant) => ({
                                      value: variant,
                                      label: variant,
                                    }))}
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Size
                                  </span>
                                  <InputSelect
                                    value={selectedButtonConfig.size}
                                    onChange={(e) =>
                                      updateButtonConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        size: e.target.value as ButtonBlockSize,
                                      }))
                                    }
                                    options={BUTTON_SIZES.map((size) => ({
                                      value: size,
                                      label: size,
                                    }))}
                                  />
                                </label>
                              </div>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                                  <InputCheckbox
                                    
                                    checked={selectedButtonConfig.fullWidth}
                                    onChange={(e) =>
                                      updateButtonConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        fullWidth: e.target.checked,
                                      }))
                                    }
                                  />
                                  Full width
                                </label>
                                <label className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                                  <InputCheckbox
                                    
                                    checked={selectedButtonConfig.shadow}
                                    onChange={(e) =>
                                      updateButtonConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        shadow: e.target.checked,
                                      }))
                                    }
                                  />
                                  Shadow
                                </label>
                              </div>
                              <InspectorSliderControl
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
                              <div>
                                <span className="text-xs font-medium text-neutral-500">
                                  Text color
                                </span>
                                <InspectorColorInput
                                  value={selectedButtonConfig.textColor}
                                  onChange={(nextColor) =>
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      textColor: nextColor,
                                    }))
                                  }
                                  allowAlpha
                                />
                              </div>
                              <div>
                                <span className="text-xs font-medium text-neutral-500">
                                  Background color
                                </span>
                                <InspectorColorInput
                                  value={selectedButtonConfig.bgColor}
                                  onChange={(nextColor) =>
                                    updateButtonConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      bgColor: nextColor,
                                    }))
                                  }
                                  allowAlpha
                                />
                              </div>
                            </div>
                          )}
                          {selectedBlock.kind === "image" &&
                            selectedImageConfig && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Preview
                                  </span>
                                  {selectedImageConfig.url ? (
                                    <img
                                      src={selectedImageConfig.url}
                                      alt={selectedImageConfig.alt || ""}
                                      className={`h-28 w-full rounded ${selectedImageConfig.shadow ? "shadow-lg" : ""}`}
                                      style={{
                                        objectFit: selectedImageConfig.fit,
                                        objectPosition: `${selectedImageConfig.focalX * 100}% ${selectedImageConfig.focalY * 100}%`,
                                        borderRadius: selectedImageConfig.radius,
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className={`flex h-28 w-full items-center justify-center rounded bg-neutral-200 text-xs text-neutral-500 ${selectedImageConfig.shadow ? "shadow-lg" : ""}`}
                                      style={{ borderRadius: selectedImageConfig.radius }}
                                    >
                                      No image selected
                                    </div>
                                  )}
                                </div>
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Image URL
                                  </span>
                                  <InputText
                                    type="text"
                                    value={selectedImageConfig.url}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      updateImageConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        url: value,
                                      }));
                                    }}
                                    className={INSPECTOR_INPUT_CLASS}
                                    placeholder="https://example.com/image.jpg"
                                  />
                                </label>
                                <input
                                  ref={blockImageInputRef}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleUpload(file, (url) => {
                                        updateImageConfig(selectedBlock.id, (config) => ({
                                          ...config,
                                          url,
                                        }));
                                      });
                                      e.target.value = "";
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    blockImageInputRef.current?.click()
                                  }
                                  className="rounded border px-3 py-1 text-xs"
                                >
                                  {selectedImageConfig.url
                                    ? "Replace image"
                                    : "Upload image"}
                                </button>
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Object fit
                                  </span>
                                  <InputSelect
                                    value={selectedImageConfig.fit}
                                    onChange={(e) =>
                                      updateImageConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        fit: e.target.value as "cover" | "contain",
                                      }))
                                    }
                                    options={[
                                      { value: "cover", label: "Cover" },
                                      { value: "contain", label: "Contain" },
                                    ]}
                                  />
                                </label>
                                <div>
                                  <span className="text-xs font-medium text-neutral-500">
                                    Focal point
                                  </span>
                                  <div className="mt-2 space-y-2">
                                    <label className="block text-xs text-neutral-500">
                                      <div className="flex items-center justify-between">
                                        <span>X axis</span>
                                        <span>{selectedImageConfig.focalX.toFixed(2)}</span>
                                      </div>
                                      <InputSlider
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={selectedImageConfig.focalX}
                                        fallbackValue={DEFAULT_IMAGE_CONFIG.focalX}
                                        onValueChange={(next) => {
                                          const value =
                                            typeof next === "number"
                                              ? next
                                              : DEFAULT_IMAGE_CONFIG.focalX;
                                          updateImageConfig(selectedBlock.id, (config) => ({
                                            ...config,
                                            focalX: value,
                                          }));
                                        }}
                                        containerClassName="mt-1"
                                        className="w-full"
                                        numberInputClassName="w-24 shrink-0 text-right text-xs"
                                      />
                                    </label>
                                    <label className="block text-xs text-neutral-500">
                                      <div className="flex items-center justify-between">
                                        <span>Y axis</span>
                                        <span>{selectedImageConfig.focalY.toFixed(2)}</span>
                                      </div>
                                      <InputSlider
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={selectedImageConfig.focalY}
                                        fallbackValue={DEFAULT_IMAGE_CONFIG.focalY}
                                        onValueChange={(next) => {
                                          const value =
                                            typeof next === "number"
                                              ? next
                                              : DEFAULT_IMAGE_CONFIG.focalY;
                                          updateImageConfig(selectedBlock.id, (config) => ({
                                            ...config,
                                            focalY: value,
                                          }));
                                        }}
                                        containerClassName="mt-1"
                                        className="w-full"
                                        numberInputClassName="w-24 shrink-0 text-right text-xs"
                                      />
                                    </label>
                                  </div>
                                </div>
                                <InspectorSliderControl
                                  label="Corner radius (px)"
                                  value={selectedImageConfig.radius}
                                  fallbackValue={
                                    selectedImageConfig.radius ?? DEFAULT_IMAGE_CONFIG.radius
                                  }
                                  min={0}
                                  max={50}
                                  step={1}
                                  onChange={(next) => {
                                    updateImageConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      radius:
                                        next === undefined || Number.isNaN(next)
                                          ? config.radius
                                          : Math.max(0, Math.round(next)),
                                    }));
                                  }}
                                />
                                <label className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                                  <InputCheckbox
                                    
                                    checked={selectedImageConfig.shadow}
                                    onChange={(e) =>
                                      updateImageConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        shadow: e.target.checked,
                                      }))
                                    }
                                  />
                                  Shadow
                                </label>
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Alt text
                                  </span>
                                  <InputText
                                    type="text"
                                    value={selectedImageConfig.alt}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      updateImageConfig(selectedBlock.id, (config) => ({
                                        ...config,
                                        alt: value,
                                      }));
                                    }}
                                    className={INSPECTOR_INPUT_CLASS}
                                    placeholder="Describe the image"
                                  />
                                </label>
                              </div>
                            )}
                          {selectedBlock.kind === "gallery" &&
                            selectedGalleryConfig && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                    Gallery images ({selectedGalleryConfig.items.length})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowGalleryAddOptions((prev) => !prev)
                                    }
                                    className="rounded border px-3 py-1 text-xs font-medium"
                                  >
                                    + Add image
                                  </button>
                                </div>
                                {uploading && (
                                  <div className="text-[11px] text-neutral-500">
                                    Uploading…
                                  </div>
                                )}
                                {showGalleryAddOptions && (
                                  <div className="space-y-3 rounded border px-3 py-3 text-xs">
                                    <button
                                      type="button"
                                      className="w-full rounded border px-3 py-2 text-xs font-medium"
                                      onClick={() => {
                                        galleryInputRef.current?.click();
                                      }}
                                    >
                                      Upload from device
                                    </button>
                                    <div className="space-y-1">
                                      <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                                        Image URL
                                      </span>
                                      <div className="flex gap-2">
                                        <InputText
                                          type="text"
                                          value={galleryUrlInput}
                                          onChange={(e) =>
                                            setGalleryUrlInput(e.target.value)
                                          }
                                          className={`${INSPECTOR_INPUT_CLASS} flex-1`}
                                          placeholder="https://example.com/image.jpg"
                                        />
                                        <button
                                          type="button"
                                          className="rounded border px-3 py-1 text-xs font-medium"
                                          disabled={!galleryUrlInput.trim()}
                                          onClick={() => {
                                            const url = galleryUrlInput.trim();
                                            if (!url) return;
                                            updateGalleryConfig(
                                              selectedBlock.id,
                                              (config) => ({
                                                ...config,
                                                items: [
                                                  ...config.items,
                                                  { url },
                                                ],
                                              }),
                                            );
                                            setGalleryUrlInput("");
                                          }}
                                        >
                                          Add
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <input
                                  ref={galleryInputRef}
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={async (e) => {
                                    const files = Array.from(
                                      e.target.files || [],
                                    );
                                    if (!files.length) return;
                                    const uploaded: string[] = [];
                                    for (const file of files) {
                                      // eslint-disable-next-line no-await-in-loop
                                      await handleUpload(file, (url) => {
                                        if (url) uploaded.push(url);
                                      });
                                    }
                                    if (uploaded.length) {
                                      updateGalleryConfig(
                                        selectedBlock.id,
                                        (config) => ({
                                          ...config,
                                          items: [
                                            ...config.items,
                                            ...uploaded.map((url) => ({ url })),
                                          ],
                                        }),
                                      );
                                    }
                                    e.target.value = "";
                                  }}
                                />
                                <div className="space-y-2">
                                  {selectedGalleryConfig.items.length === 0 ? (
                                    <div className="flex h-24 items-center justify-center rounded border border-dashed text-xs text-neutral-500">
                                      No images yet
                                    </div>
                                  ) : (
                                    selectedGalleryConfig.items.map(
                                      (item, index) => (
                                        <div
                                          key={`${item.url}-${index}`}
                                          className="flex items-center gap-3 rounded border px-2 py-2 text-xs"
                                        >
                                          <img
                                            src={item.url}
                                            alt={item.alt || ""}
                                            className="h-12 w-12 rounded object-cover"
                                          />
                                          <div className="ml-auto flex items-center gap-1">
                                            <button
                                              type="button"
                                              className="rounded border px-2 py-1"
                                              disabled={index === 0}
                                              onClick={() =>
                                                updateGalleryConfig(
                                                  selectedBlock.id,
                                                  (config) => {
                                                    const items = [...config.items];
                                                    const [moved] = items.splice(index, 1);
                                                    items.splice(index - 1, 0, moved);
                                                    return { ...config, items };
                                                  },
                                                )
                                              }
                                            >
                                              Up
                                            </button>
                                            <button
                                              type="button"
                                              className="rounded border px-2 py-1"
                                              disabled={
                                                index ===
                                                selectedGalleryConfig.items.length - 1
                                              }
                                              onClick={() =>
                                                updateGalleryConfig(
                                                  selectedBlock.id,
                                                  (config) => {
                                                    const items = [...config.items];
                                                    const [moved] = items.splice(index, 1);
                                                    items.splice(index + 1, 0, moved);
                                                    return { ...config, items };
                                                  },
                                                )
                                              }
                                            >
                                              Down
                                            </button>
                                            <button
                                              type="button"
                                              className="rounded border px-2 py-1 text-red-600"
                                              onClick={() =>
                                                updateGalleryConfig(
                                                  selectedBlock.id,
                                                  (config) => ({
                                                    ...config,
                                                    items: config.items.filter(
                                                      (_, i) => i !== index,
                                                    ),
                                                  }),
                                                )
                                              }
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        </div>
                                      ),
                                    )
                                  )}
                                </div>
                                <div className="space-y-3">
                                  <label className="block">
                                    <span className="text-xs font-medium text-neutral-500">
                                      Layout
                                    </span>
                                    <InputSelect
                                      value={selectedGalleryConfig.layout}
                                      onChange={(e) =>
                                        updateGalleryConfig(
                                          selectedBlock.id,
                                          (config) => ({
                                            ...config,
                                            layout: e.target.value as GalleryBlockConfig["layout"],
                                          }),
                                        )
                                      }
                                      options={[
                                        { value: "grid", label: "Grid" },
                                        { value: "carousel", label: "Carousel" },
                                      ]}
                                    />
                                  </label>
                                  {selectedGalleryConfig.layout === "carousel" && (
                                    <div className="space-y-2 rounded border px-3 py-2 text-xs">
                                      <InputToggle
                                        label="Autoplay"
                                        checked={selectedGalleryConfig.autoplay}
                                        onChange={(checked) =>
                                          updateGalleryConfig(
                                            selectedBlock.id,
                                            (config) => ({
                                              ...config,
                                              autoplay: checked,
                                            }),
                                          )
                                        }
                                        labelClassName="flex items-center justify-between text-xs text-neutral-500"
                                      />
                                      <label className="block">
                                        <span className="text-xs font-medium text-neutral-500">
                                          Interval (ms)
                                        </span>
                                        <InputNumber
                                          
                                          min={200}
                                          step={100}
                                          value={selectedGalleryConfig.interval}
                                          onChange={(e) => {
                                            const value = Number(e.target.value);
                                            updateGalleryConfig(
                                              selectedBlock.id,
                                              (config) => ({
                                                ...config,
                                                interval: Number.isNaN(value)
                                                  ? config.interval
                                                  : value,
                                              }),
                                            );
                                          }}
                                          className={INSPECTOR_INPUT_CLASS}
                                          disabled={!selectedGalleryConfig.autoplay}
                                        />
                                      </label>
                                    </div>
                                  )}
                                  <InspectorSliderControl
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
                                  <InputToggle
                                    label="Shadow"
                                    checked={selectedGalleryConfig.shadow}
                                    onChange={(checked) =>
                                      updateGalleryConfig(
                                        selectedBlock.id,
                                        (config) => ({
                                          ...config,
                                          shadow: checked,
                                        }),
                                      )
                                    }
                                    labelClassName="flex items-center justify-between text-xs text-neutral-500"
                                  />
                                </div>
                              </div>
                            )}
                          {selectedBlock.kind === "quote" && selectedQuoteConfig && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <InputToggle
                                  label="Use customer review"
                                  checked={selectedQuoteConfig.useReview}
                                  onChange={(checked) =>
                                    updateQuoteConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      useReview: checked,
                                      reviewId: checked ? config.reviewId : null,
                                    }))
                                  }
                                  labelClassName="flex items-center justify-between text-xs text-neutral-500"
                                />
                                {selectedQuoteConfig.useReview && (
                                  reviewOptions.length > 0 ? (
                                    <label className="block">
                                      <span className="text-xs font-medium text-neutral-500">
                                        Select review
                                      </span>
                                      <InputSelect
                                        value={selectedQuoteConfig.reviewId ?? ""}
                                        onChange={(e) => {
                                          const nextId = e.target.value;
                                          const review = reviewOptions.find(
                                            (option) => option.id === nextId,
                                          );
                                          updateQuoteConfig(selectedBlock.id, (config) => ({
                                            ...config,
                                            useReview: true,
                                            reviewId: nextId.length > 0 ? nextId : null,
                                            text: review ? review.text : config.text,
                                            author: review ? review.author : config.author,
                                          }));
                                        }}
                                      >
                                        <option value="">Choose a review…</option>
                                        {reviewOptions.map((option) => (
                                          <option key={option.id} value={option.id}>
                                            {formatReviewOptionLabel(option)}
                                          </option>
                                        ))}
                                      </InputSelect>
                                    </label>
                                  ) : (
                                    <p className="text-xs text-neutral-500">
                                      No reviews available.
                                    </p>
                                  )
                                )}
                              </div>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Quote text
                                </span>
                                <textarea
                                  rows={4}
                                  value={selectedQuoteConfig.text}
                                  onChange={(e) =>
                                    updateQuoteConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      text: e.target.value,
                                    }))
                                  }
                                  className={INSPECTOR_TEXTAREA_CLASS}
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Author (optional)
                                </span>
                                <InputText
                                  type="text"
                                  value={selectedQuoteConfig.author}
                                  onChange={(e) =>
                                    updateQuoteConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      author: e.target.value,
                                    }))
                                  }
                                  className={INSPECTOR_INPUT_CLASS}
                                />
                              </label>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Font family
                                  </span>
                                  {(() => {
                                    const value = resolveFontFamilyValue(
                                      selectedBlock.fontFamily,
                                    );
                                    const option = FONT_FAMILY_SELECT_OPTIONS.find(
                                      (item) => item.value === value,
                                    );
                                    return (
                                      <InputSelect
                                        value={value}
                                        onChange={(e) =>
                                          handleFontFamilyChange(
                                            selectedBlock.id,
                                            e.target.value,
                                          )
                                        }
                                        style={{
                                          fontFamily: option?.previewStack,
                                        }}
                                      >
                                        {FONT_FAMILY_SELECT_OPTIONS.map((opt) => (
                                          <option
                                            key={opt.value}
                                            value={opt.value}
                                            style={{ fontFamily: opt.previewStack }}
                                          >
                                            {opt.label}
                                          </option>
                                        ))}
                                      </InputSelect>
                                    );
                                  })()}
                                </label>
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Font weight
                                  </span>
                                  <InputSelect
                                    value={String(
                                      selectedBlock.fontWeight ??
                                        (selectedQuoteConfig.style === "emphasis" ? 600 : 400),
                                    )}
                                    onChange={(e) => {
                                      const parsed = Number(e.target.value);
                                      patchBlock(selectedBlock.id, {
                                        fontWeight: Number.isNaN(parsed)
                                          ? selectedBlock.fontWeight
                                          : parsed,
                                      });
                                    }}
                                    options={FONT_WEIGHT_OPTIONS}
                                  />
                                </label>
                              </div>
                              <div className="space-y-3">
                                <InspectorSliderControl
                                  label="Font size (px)"
                                  value={selectedBlock.fontSize}
                                  fallbackValue={
                                    selectedBlock.fontSize ??
                                    (selectedQuoteConfig.style === "emphasis" ? 24 : 16)
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
                                <InspectorSliderControl
                                  label="Line height"
                                  value={selectedBlock.lineHeight}
                                  fallbackValue={
                                    selectedBlock.lineHeight ?? 1.2
                                  }
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
                              </div>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Style
                                </span>
                                <InputSelect
                                  value={selectedQuoteConfig.style}
                                  onChange={(e) =>
                                    updateQuoteConfig(selectedBlock.id, (config) => ({
                                      ...config,
                                      style: e.target.value as QuoteBlockConfig["style"],
                                    }))
                                  }
                                  options={QUOTE_STYLE_OPTIONS}
                                />
                              </label>
                              {(selectedQuoteConfig.style === "emphasis" ||
                                selectedQuoteConfig.style === "card") && (
                                <div className="space-y-3 rounded border px-3 py-3">
                                  <label className="block text-xs font-medium text-neutral-500">
                                    Background color
                                    <InspectorColorInput
                                      value={selectedQuoteConfig.bgColor}
                                      onChange={(nextColor) =>
                                        updateQuoteConfig(selectedBlock.id, (config) => ({
                                          ...config,
                                          bgColor: nextColor,
                                        }))
                                      }
                                    />
                                  </label>
                                  <InspectorSliderControl
                                    label="Background opacity"
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
                                  <InspectorSliderControl
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
                                  <InspectorSliderControl
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
                                </div>
                              )}
                              <div>
                                <span className="text-xs font-medium text-neutral-500">
                                  Alignment
                                </span>
                                <div className="mt-1 flex gap-1.5">
                                  {TEXT_ALIGNMENT_OPTIONS.map((option) => {
                                    const currentAlign = selectedQuoteConfig.align;
                                    const isActive = currentAlign === option.value;
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                          updateQuoteConfig(selectedBlock.id, (config) => ({
                                            ...config,
                                            align: option.value,
                                          }))
                                        }
                                        className={`flex-1 rounded border px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                                          isActive
                                            ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                                            : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                                        }`}
                                      >
                                        {option.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="rounded border px-3 py-3 space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              Visibility
                            </h4>
                            {DEVICE_VISIBILITY_CONTROLS.map(({ key, label }) => (
                              <InputToggle
                                key={key}
                                label={label}
                                checked={selectedVisibilityConfig[key]}
                                onChange={(checked) =>
                                  updateVisibilityConfig(selectedBlock.id, (config) => ({
                                    ...config,
                                    [key]: checked,
                                  }))
                                }
                                labelClassName="flex items-center justify-between text-xs text-neutral-500"
                              />
                            ))}
                          </div>
                          <div className="rounded border px-3 py-3 space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              Appearance
                            </h4>
                            <div>
                              <span className="text-xs font-medium text-neutral-500">Shadow</span>
                              <div className="mt-1 flex gap-1.5">
                                {BLOCK_SHADOW_OPTIONS.map((option) => {
                                  const currentShadow = selectedBlock.boxShadow ?? "none";
                                  const isActive = currentShadow === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() =>
                                        patchBlock(selectedBlock.id, { boxShadow: option.value })
                                      }
                                      className={`flex-1 rounded border px-2.5 py-1.5 text-xs font-medium transition ${
                                        isActive
                                          ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                                          : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <label className="block sm:col-span-2">
                                <span className="text-xs font-medium text-neutral-500">
                                  Border color
                                </span>
                                <InspectorColorInput
                                  value={selectedBlock.borderColor ?? "transparent"}
                                  onChange={(nextColor) => {
                                    const normalized = nextColor?.trim();
                                    patchBlock(selectedBlock.id, {
                                      borderColor:
                                        normalized && normalized.length > 0
                                          ? normalized
                                          : undefined,
                                    });
                                  }}
                                  allowAlpha
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Border width (px)
                                </span>
                                <InputNumber
                                  
                                  min={0}
                                  value={
                                    selectedBlock.borderWidth !== undefined
                                      ? selectedBlock.borderWidth
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === "") {
                                      patchBlock(selectedBlock.id, { borderWidth: undefined });
                                      return;
                                    }
                                    const parsed = Number(value);
                                    patchBlock(selectedBlock.id, {
                                      borderWidth: Number.isNaN(parsed)
                                        ? selectedBlock.borderWidth
                                        : Math.max(0, parsed),
                                    });
                                  }}
                                  className={INSPECTOR_INPUT_CLASS}
                                />
                              </label>
                              <InspectorSliderControl
                                label="Border radius (px)"
                                value={selectedBlock.borderRadius}
                                fallbackValue={selectedBlock.borderRadius ?? 0}
                                min={0}
                                max={50}
                                step={1}
                                onChange={(next) => {
                                  if (next === undefined) {
                                    patchBlock(selectedBlock.id, { borderRadius: undefined });
                                    return;
                                  }
                                  const resolved = Math.max(0, Math.round(next));
                                  patchBlock(selectedBlock.id, {
                                    borderRadius: resolved,
                                  });
                                }}
                              />
                            </div>
                            <div className="space-y-3">
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Background type
                                </span>
                                <InputSelect
                                  value={selectedBlock.background?.type ?? "none"}
                                  onChange={(e) => {
                                    const nextType = e.target.value as BlockBackground["type"];
                                    const current = cloneBlockBackground(selectedBlock.background);
                                    if (nextType === "none") {
                                      patchBlock(selectedBlock.id, { background: { type: "none" } });
                                      return;
                                    }
                                    if (nextType === "color") {
                                      patchBlock(selectedBlock.id, {
                                        background: {
                                          ...current,
                                          type: "color",
                                          color:
                                            current.color ?? DEFAULT_BLOCK_BACKGROUND_COLOR,
                                        },
                                      });
                                      return;
                                    }
                                    if (nextType === "gradient") {
                                      patchBlock(selectedBlock.id, {
                                        background: {
                                          ...current,
                                          type: "gradient",
                                          gradient: {
                                            from:
                                              current.gradient?.from ??
                                              DEFAULT_BLOCK_GRADIENT_FROM,
                                            to:
                                              current.gradient?.to ??
                                              DEFAULT_BLOCK_GRADIENT_TO,
                                            direction:
                                              current.gradient?.direction ?? "to-bottom",
                                          },
                                        },
                                      });
                                      return;
                                    }
                                    patchBlock(selectedBlock.id, {
                                      background: {
                                        ...current,
                                        type: "image",
                                        image: { url: current.image?.url ?? "" },
                                      },
                                    });
                                  }}
                                  options={BLOCK_BACKGROUND_TYPE_OPTIONS}
                                />
                              </label>
                              {selectedBlock.background?.type === "color" && (
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Background color
                                  </span>
                                  <InspectorColorInput
                                    value={
                                      selectedBlock.background?.color ??
                                      DEFAULT_BLOCK_BACKGROUND_COLOR
                                    }
                                    onChange={(nextColor) => {
                                      const base = cloneBlockBackground(selectedBlock.background);
                                      const normalized = nextColor?.trim();
                                      base.type = "color";
                                      base.color =
                                        normalized && normalized.length > 0
                                          ? normalized
                                          : DEFAULT_BLOCK_BACKGROUND_COLOR;
                                      patchBlock(selectedBlock.id, { background: base });
                                    }}
                                    allowAlpha
                                  />
                                </label>
                              )}
                              {selectedBlock.background?.type === "gradient" && (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                  <label className="block">
                                    <span className="text-xs font-medium text-neutral-500">
                                      From
                                    </span>
                                    <InspectorColorInput
                                      value={
                                        selectedBlock.background?.gradient?.from ??
                                        DEFAULT_BLOCK_GRADIENT_FROM
                                      }
                                      onChange={(nextColor) => {
                                        const base = cloneBlockBackground(selectedBlock.background);
                                        const normalized = nextColor?.trim();
                                        base.type = "gradient";
                                        base.gradient = {
                                          from:
                                            normalized && normalized.length > 0
                                              ? normalized
                                              : DEFAULT_BLOCK_GRADIENT_FROM,
                                          to:
                                            base.gradient?.to ??
                                            selectedBlock.background?.gradient?.to ??
                                            DEFAULT_BLOCK_GRADIENT_TO,
                                          direction:
                                            base.gradient?.direction ??
                                            selectedBlock.background?.gradient?.direction ??
                                            "to-bottom",
                                        };
                                        patchBlock(selectedBlock.id, { background: base });
                                      }}
                                      allowAlpha
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs font-medium text-neutral-500">
                                      To
                                    </span>
                                    <InspectorColorInput
                                      value={
                                        selectedBlock.background?.gradient?.to ??
                                        DEFAULT_BLOCK_GRADIENT_TO
                                      }
                                      onChange={(nextColor) => {
                                        const base = cloneBlockBackground(selectedBlock.background);
                                        const normalized = nextColor?.trim();
                                        base.type = "gradient";
                                        base.gradient = {
                                          from:
                                            base.gradient?.from ??
                                            selectedBlock.background?.gradient?.from ??
                                            DEFAULT_BLOCK_GRADIENT_FROM,
                                          to:
                                            normalized && normalized.length > 0
                                              ? normalized
                                              : DEFAULT_BLOCK_GRADIENT_TO,
                                          direction:
                                            base.gradient?.direction ??
                                            selectedBlock.background?.gradient?.direction ??
                                            "to-bottom",
                                        };
                                        patchBlock(selectedBlock.id, { background: base });
                                      }}
                                      allowAlpha
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs font-medium text-neutral-500">
                                      Direction
                                    </span>
                                    <InputSelect
                                      value={
                                        selectedBlock.background?.gradient?.direction ??
                                        "to-bottom"
                                      }
                                      onChange={(e) => {
                                        const value = e.target
                                          .value as BlockBackgroundGradientDirection;
                                        const base = cloneBlockBackground(selectedBlock.background);
                                        base.type = "gradient";
                                        base.gradient = {
                                          from:
                                            base.gradient?.from ??
                                            selectedBlock.background?.gradient?.from ??
                                            DEFAULT_BLOCK_GRADIENT_FROM,
                                          to:
                                            base.gradient?.to ??
                                            selectedBlock.background?.gradient?.to ??
                                            DEFAULT_BLOCK_GRADIENT_TO,
                                          direction: value,
                                        };
                                        patchBlock(selectedBlock.id, { background: base });
                                      }}
                                      options={BLOCK_BACKGROUND_GRADIENT_DIRECTIONS}
                                    />
                                  </label>
                                </div>
                              )}
                              {selectedBlock.background?.type === "image" && (
                                <div className="space-y-2">
                                  <input
                                    ref={blockBackgroundImageInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      await handleUpload(file, (url) => {
                                        const base = cloneBlockBackground(selectedBlock.background);
                                        base.type = "image";
                                        base.image = { url };
                                        patchBlock(selectedBlock.id, { background: base });
                                      });
                                      e.target.value = "";
                                    }}
                                  />
                                  <label className="block">
                                    <span className="text-xs font-medium text-neutral-500">
                                      Image URL
                                    </span>
                                    <InputText
                                      type="text"
                                      value={selectedBlock.background?.image?.url ?? ""}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        const base = cloneBlockBackground(selectedBlock.background);
                                        base.type = "image";
                                        base.image = { url: value };
                                        patchBlock(selectedBlock.id, { background: base });
                                      }}
                                      className={INSPECTOR_INPUT_CLASS}
                                      placeholder="https://example.com/image.jpg"
                                    />
                                  </label>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        blockBackgroundImageInputRef.current?.click()
                                      }
                                      className="rounded border px-3 py-1 text-xs font-medium"
                                    >
                                      {selectedBlock.background?.image?.url
                                        ? "Replace image"
                                        : "Upload image"}
                                    </button>
                                    {uploading && (
                                      <span className="text-[11px] text-neutral-500">
                                        Uploading…
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="rounded border px-3 py-3 space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              Animations
                            </h4>
                            <label className="block">
                              <span className="text-xs font-medium text-neutral-500">
                                Entry animation
                              </span>
                              <InputSelect
                                value={selectedAnimationConfig.type}
                                onChange={(event) =>
                                  applyAnimationConfig((prev) => ({
                                    ...prev,
                                    type: event.target.value as BlockAnimationType,
                                  }))
                                }
                                options={BLOCK_ANIMATION_OPTIONS}
                              />
                            </label>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Duration (ms)
                                </span>
                                <InputNumber
                                  
                                  min={0}
                                  value={selectedAnimationConfig.duration}
                                  onChange={(event) => {
                                    const parsed = Number(event.target.value);
                                    applyAnimationConfig((prev) => ({
                                      ...prev,
                                      duration: Number.isNaN(parsed) ? prev.duration : parsed,
                                    }));
                                  }}
                                  className={INSPECTOR_INPUT_CLASS}
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Delay (ms)
                                </span>
                                <InputNumber
                                  
                                  min={0}
                                  value={selectedAnimationConfig.delay}
                                  onChange={(event) => {
                                    const parsed = Number(event.target.value);
                                    applyAnimationConfig((prev) => ({
                                      ...prev,
                                      delay: Number.isNaN(parsed) ? prev.delay : parsed,
                                    }));
                                  }}
                                  className={INSPECTOR_INPUT_CLASS}
                                />
                              </label>
                            </div>
                          </div>
                          <div className="rounded border px-3 py-3 space-y-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              Transitions
                            </h4>
                            <label className="block">
                              <span className="text-xs font-medium text-neutral-500">
                                Hover effect
                              </span>
                              <InputSelect
                                value={selectedTransitionConfig.hover}
                                onChange={(event) =>
                                  applyTransitionConfig((prev) => ({
                                    ...prev,
                                    hover: event.target.value as BlockHoverTransition,
                                  }))
                                }
                                options={BLOCK_TRANSITION_OPTIONS}
                              />
                            </label>
                            <label className="block">
                              <span className="text-xs font-medium text-neutral-500">
                                Transition duration (ms)
                              </span>
                              <InputNumber
                                
                                min={0}
                                value={selectedTransitionConfig.duration}
                                onChange={(event) => {
                                  const parsed = Number(event.target.value);
                                  applyTransitionConfig((prev) => ({
                                    ...prev,
                                    duration: Number.isNaN(parsed) ? prev.duration : parsed,
                                  }));
                                }}
                                className={INSPECTOR_INPUT_CLASS}
                              />
                            </label>
                          </div>
                          <div className="rounded border px-3 py-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              Frame ({activeDevice})
                            </h4>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              {frame && (
                                <>
                                  <label className="flex flex-col gap-1">
                                    <span>X%</span>
                                    <InputNumber
                                      
                                      value={frame.x}
                                      onChange={(e) =>
                                        updateFrameField(
                                          selectedBlock.id,
                                          "x",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="rounded border px-2 py-1"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span>Y%</span>
                                    <InputNumber
                                      
                                      value={frame.y}
                                      onChange={(e) =>
                                        updateFrameField(
                                          selectedBlock.id,
                                          "y",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="rounded border px-2 py-1"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span>Width%</span>
                                    <InputNumber
                                      
                                      value={frame.w}
                                      onChange={(e) =>
                                        updateFrameField(
                                          selectedBlock.id,
                                          "w",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="rounded border px-2 py-1"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span>Height%</span>
                                    <InputNumber
                                      
                                      value={frame.h}
                                      onChange={(e) =>
                                        updateFrameField(
                                          selectedBlock.id,
                                          "h",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="rounded border px-2 py-1"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span>Rotation°</span>
                                    <InputNumber
                                      
                                      value={frame.r}
                                      onChange={(e) =>
                                        updateFrameField(
                                          selectedBlock.id,
                                          "r",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="rounded border px-2 py-1"
                                    />
                                  </label>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                    </section>
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { SlideCfg } from "./SlidesManager";
