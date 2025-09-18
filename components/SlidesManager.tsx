import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowsUpDownIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { toast } from '@/components/ui/toast';
import { supabase } from '@/utils/supabaseClient';
import type { SlideRow } from '@/components/customer/home/SlidesContainer';

export type DeviceKind = 'mobile' | 'tablet' | 'desktop';

export const DEVICE_DIMENSIONS: Record<DeviceKind, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1280, height: 800 },
};

export type Frame = {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
};

export type ButtonBlockVariant = 'Primary' | 'Outline' | 'Ghost';
export type ButtonBlockSize = 'Small' | 'Medium' | 'Large';

export type ButtonBlockConfig = {
  label: string;
  href: string;
  variant: ButtonBlockVariant;
  size: ButtonBlockSize;
  fullWidth: boolean;
  radius: number;
  shadow: boolean;
  textColor: string;
  bgColor: string;
};

export const BUTTON_VARIANTS: ButtonBlockVariant[] = ['Primary', 'Outline', 'Ghost'];
export const BUTTON_SIZES: ButtonBlockSize[] = ['Small', 'Medium', 'Large'];

const BUTTON_FONT_SIZE_PX: Record<ButtonBlockSize, number> = {
  Small: 14,
  Medium: 16,
  Large: 18,
};

export const DEFAULT_BUTTON_CONFIG: ButtonBlockConfig = {
  label: 'Button',
  href: '/menu',
  variant: 'Primary',
  size: 'Medium',
  fullWidth: false,
  radius: 4,
  shadow: false,
  textColor: '#ffffff',
  bgColor: '#000000',
};

export type ImageBlockConfig = {
  url: string;
  fit: 'cover' | 'contain';
  focalX: number;
  focalY: number;
  radius: number;
  shadow: boolean;
  alt: string;
};

export const DEFAULT_IMAGE_CONFIG: ImageBlockConfig = {
  url: '',
  fit: 'cover',
  focalX: 0.5,
  focalY: 0.5,
  radius: 0,
  shadow: false,
  alt: '',
};

export type GalleryBlockItem = { url: string; alt?: string };

export type GalleryBlockConfig = {
  items: GalleryBlockItem[];
  layout: 'grid' | 'carousel';
  autoplay: boolean;
  interval: number;
  radius: number;
  shadow: boolean;
};

export const DEFAULT_GALLERY_CONFIG: GalleryBlockConfig = {
  items: [],
  layout: 'grid',
  autoplay: false,
  interval: 3000,
  radius: 0,
  shadow: false,
};

export type QuoteBlockConfig = {
  text: string;
  author: string;
  style: 'plain' | 'emphasis' | 'card';
  bgColor: string;
  bgOpacity: number;
  radius: number;
  padding: number;
  align: 'left' | 'center' | 'right';
};

export const DEFAULT_QUOTE_CONFIG: QuoteBlockConfig = {
  text: '',
  author: '',
  style: 'plain',
  bgColor: '#ffffff',
  bgOpacity: 1,
  radius: 0,
  padding: 0,
  align: 'left',
};

export type SlideBlock = {
  id: string;
  kind: 'heading' | 'subheading' | 'text' | 'button' | 'image' | 'quote' | 'gallery' | 'spacer';
  text?: string;
  content?: string;
  href?: string;
  src?: string;
  alt?: string;
  items?: { src: string; alt?: string }[];
  frames: Partial<Record<DeviceKind, Frame>>;
  color?: string;
  align?: 'left' | 'center' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fontFamily?: 'default' | 'serif' | 'sans' | 'mono';
  fontWeight?: number;
  fontSize?: number;
  lineHeight?: number;
  lineHeightUnit?: 'em' | 'px';
  letterSpacing?: number;
  textColor?: string;
  textShadow?: { x: number; y: number; blur: number; color: string } | null;
  bgStyle?: 'none' | 'solid' | 'glass';
  bgColor?: string;
  bgOpacity?: number;
  radius?: number;
  padding?: number;
  buttonVariant?: 'primary' | 'secondary';
  config?:
    | (Partial<ButtonBlockConfig> &
        Partial<ImageBlockConfig> &
        Partial<GalleryBlockConfig> &
        Partial<QuoteBlockConfig> &
        Record<string, any>)
    | null;
  fit?: 'cover' | 'contain';
  author?: string;
  height?: number;
  locked?: boolean;
};

export type SlideBackground = {
  type: 'none' | 'color' | 'image' | 'video';
  color?: string;
  opacity?: number;
  url?: string;
  fit?: 'cover' | 'contain';
  focal?: { x: number; y: number };
  overlay?: { color: string; opacity: number };
  blur?: number;
  poster?: string;
  loop?: boolean;
  mute?: boolean;
  autoplay?: boolean;
};

export type SlideCfg = {
  background?: SlideBackground;
  blocks: SlideBlock[];
};

export type SlidesManagerChangeOptions = {
  commit?: boolean;
};

type SlidesManagerProps = {
  initialCfg: SlideCfg;
  onChange: (cfg: SlideCfg, options?: SlidesManagerChangeOptions) => void;
  editable: boolean;
  selectedId?: string | null;
  onSelectBlock?: (id: string | null) => void;
  openInspector?: () => void;
  onCanvasClick?: () => void;
  activeDevice?: DeviceKind;
  editInPreview?: boolean;
  scale?: number;
  onManipulationChange?: (manipulating: boolean) => void;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const FONT_FAMILY_MAP: Record<'default' | 'serif' | 'sans' | 'mono', string | undefined> = {
  default: undefined,
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  sans: '"Inter", "Segoe UI", system-ui, sans-serif',
  mono: '"Roboto Mono", "Courier New", monospace',
};

const SIZE_TO_FONT_SIZE: Record<NonNullable<SlideBlock['size']>, number> = {
  sm: 18,
  md: 24,
  lg: 40,
  xl: 56,
};

const resolveLineHeightValue = (
  value?: number,
  unit?: SlideBlock['lineHeightUnit'],
): string | number | undefined => {
  if (typeof value !== 'number') return undefined;
  if (unit === 'px') return `${value}px`;
  if (unit === 'em') return `${value}em`;
  return value;
};

const hexToRgba = (hex: string, opacity: number) => {
  if (!hex) return undefined;
  const normalized = hex.trim();
  if (!normalized.startsWith('#')) {
    return normalized;
  }
  let value = normalized.slice(1);
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (value.length !== 6 && value.length !== 8) {
    return normalized;
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return normalized;
  }
  let alpha = typeof opacity === 'number' ? opacity : 1;
  if (value.length === 8) {
    const rawAlpha = parseInt(value.slice(6, 8), 16);
    if (!Number.isNaN(rawAlpha)) {
      alpha = rawAlpha / 255;
    }
  }
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
};

export function resolveButtonConfig(block: SlideBlock): ButtonBlockConfig {
  const raw = (block.config ?? {}) as Partial<ButtonBlockConfig>;
  const labelFromBlock =
    typeof block.text === 'string' && block.text.trim().length > 0
      ? block.text
      : DEFAULT_BUTTON_CONFIG.label;
  const rawLabel = typeof raw.label === 'string' ? raw.label.trim() : undefined;
  const label = rawLabel && rawLabel.length > 0 ? rawLabel : labelFromBlock;

  const hrefFromBlock =
    typeof block.href === 'string' && block.href.length > 0
      ? block.href
      : DEFAULT_BUTTON_CONFIG.href;
  const href =
    typeof raw.href === 'string'
      ? raw.href
      : hrefFromBlock;

  const legacyVariant: ButtonBlockVariant =
    block.buttonVariant === 'secondary' ? 'Outline' : DEFAULT_BUTTON_CONFIG.variant;
  const variant = (() => {
    const value = typeof raw.variant === 'string' ? raw.variant : undefined;
    if (!value) return legacyVariant;
    const match = BUTTON_VARIANTS.find((item) => item.toLowerCase() === value.toLowerCase());
    return match ?? legacyVariant;
  })();

  const size = (() => {
    const value = typeof raw.size === 'string' ? raw.size : undefined;
    if (!value) return DEFAULT_BUTTON_CONFIG.size;
    const match = BUTTON_SIZES.find((item) => item.toLowerCase() === value.toLowerCase());
    return match ?? DEFAULT_BUTTON_CONFIG.size;
  })();

  const fullWidth =
    typeof raw.fullWidth === 'boolean' ? raw.fullWidth : DEFAULT_BUTTON_CONFIG.fullWidth;

  const radiusSource =
    typeof raw.radius === 'number'
      ? raw.radius
      : typeof block.radius === 'number'
        ? block.radius
        : DEFAULT_BUTTON_CONFIG.radius;
  const radius = Number.isFinite(radiusSource) ? Math.max(0, radiusSource) : DEFAULT_BUTTON_CONFIG.radius;

  const shadow = typeof raw.shadow === 'boolean' ? raw.shadow : DEFAULT_BUTTON_CONFIG.shadow;

  const textColor = (() => {
    if (typeof raw.textColor === 'string' && raw.textColor.trim().length > 0) {
      return raw.textColor;
    }
    if (block.buttonVariant === 'secondary') return '#000000';
    if (typeof block.color === 'string' && block.color.trim().length > 0) return block.color;
    return DEFAULT_BUTTON_CONFIG.textColor;
  })();

  const bgColor = (() => {
    if (typeof raw.bgColor === 'string' && raw.bgColor.trim().length > 0) {
      return raw.bgColor;
    }
    if (block.buttonVariant === 'secondary') return '#ffffff';
    return DEFAULT_BUTTON_CONFIG.bgColor;
  })();

  return {
    label,
    href,
    variant,
    size,
    fullWidth,
    radius,
    shadow,
    textColor,
    bgColor,
  };
}

export function resolveImageConfig(block: SlideBlock): ImageBlockConfig {
  const raw = (block.config ?? {}) as Record<string, any>;
  const rawUrl = typeof raw.url === 'string' ? raw.url.trim() : '';
  const url =
    rawUrl.length > 0
      ? rawUrl
      : typeof block.src === 'string' && block.src.length > 0
        ? block.src
        : DEFAULT_IMAGE_CONFIG.url;
  const fitRaw =
    raw.fit === 'contain' || block.fit === 'contain' ? 'contain' : 'cover';
  const focal = raw.focal && typeof raw.focal === 'object' ? raw.focal : undefined;
  const focalXSource =
    typeof raw.focalX === 'number'
      ? raw.focalX
      : typeof focal?.x === 'number'
        ? focal.x
        : undefined;
  const focalYSource =
    typeof raw.focalY === 'number'
      ? raw.focalY
      : typeof focal?.y === 'number'
        ? focal.y
        : undefined;
  const radiusSource =
    typeof raw.radius === 'number'
      ? raw.radius
      : typeof block.radius === 'number'
        ? block.radius
        : undefined;
  const shadowSource =
    typeof raw.shadow === 'boolean'
      ? raw.shadow
      : typeof (raw as any).hasShadow === 'boolean'
        ? Boolean((raw as any).hasShadow)
        : DEFAULT_IMAGE_CONFIG.shadow;
  const altSource =
    typeof raw.alt === 'string'
      ? raw.alt
      : typeof block.alt === 'string'
        ? block.alt
        : DEFAULT_IMAGE_CONFIG.alt;

  const focalX = Number.isFinite(focalXSource)
    ? clamp(focalXSource as number, 0, 1)
    : DEFAULT_IMAGE_CONFIG.focalX;
  const focalY = Number.isFinite(focalYSource)
    ? clamp(focalYSource as number, 0, 1)
    : DEFAULT_IMAGE_CONFIG.focalY;
  const radius = Number.isFinite(radiusSource)
    ? Math.max(0, radiusSource as number)
    : DEFAULT_IMAGE_CONFIG.radius;

  return {
    url,
    fit: fitRaw,
    focalX,
    focalY,
    radius,
    shadow: Boolean(shadowSource),
    alt: altSource,
  };
}

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export function resolveGalleryConfig(block: SlideBlock): GalleryBlockConfig {
  const raw = (block.config ?? {}) as Record<string, any>;
  const rawItems = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray((raw as any).images)
      ? (raw as any).images
      : undefined;
  const fallbackItems = Array.isArray(block.items)
    ? block.items
    : Array.isArray((block as any).images)
      ? (block as any).images
      : undefined;
  const sourceItems = rawItems ?? fallbackItems ?? [];

  const items: GalleryBlockItem[] = sourceItems
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') {
        const url = item.trim();
        return url ? { url } : null;
      }
      if (typeof item === 'object') {
        const urlCandidate =
          typeof (item as any).url === 'string'
            ? (item as any).url
            : typeof (item as any).src === 'string'
              ? (item as any).src
              : typeof (item as any).image === 'string'
                ? (item as any).image
                : undefined;
        if (typeof urlCandidate === 'string') {
          const trimmed = urlCandidate.trim();
          if (trimmed.length > 0) {
            const alt =
              typeof (item as any).alt === 'string' && (item as any).alt.trim().length > 0
                ? (item as any).alt
                : undefined;
            return { url: trimmed, alt };
          }
        }
      }
      return null;
    })
    .filter((value): value is GalleryBlockItem => Boolean(value));

  const rawLayout =
    typeof raw.layout === 'string'
      ? raw.layout
      : typeof (raw as any).mode === 'string'
        ? (raw as any).mode
        : typeof (block as any).layout === 'string'
          ? (block as any).layout
          : undefined;
  const normalizedLayout = typeof rawLayout === 'string' ? rawLayout.trim().toLowerCase() : undefined;
  const layout: GalleryBlockConfig['layout'] =
    normalizedLayout === 'carousel' ? 'carousel' : 'grid';

  const autoplayRaw =
    parseBoolean(raw.autoplay) ??
    parseBoolean((raw as any).autoPlay) ??
    parseBoolean((block as any).autoplay);
  const intervalRaw =
    parseNumber(raw.interval) ??
    parseNumber((raw as any).delay) ??
    parseNumber((block as any).interval);
  const radiusRaw = parseNumber(raw.radius) ?? parseNumber(block.radius);
  const shadowRaw =
    parseBoolean(raw.shadow) ??
    parseBoolean((raw as any).hasShadow) ??
    parseBoolean((block as any).shadow);

  const intervalCandidate = intervalRaw && intervalRaw > 0 ? intervalRaw : undefined;
  const radiusCandidate = typeof radiusRaw === 'number' && radiusRaw >= 0 ? radiusRaw : undefined;

  return {
    items,
    layout,
    autoplay: layout === 'carousel' ? Boolean(autoplayRaw) : false,
    interval: intervalCandidate ? Math.round(intervalCandidate) : DEFAULT_GALLERY_CONFIG.interval,
    radius: radiusCandidate ?? DEFAULT_GALLERY_CONFIG.radius,
    shadow: Boolean(shadowRaw),
  };
}

export function resolveQuoteConfig(block: SlideBlock): QuoteBlockConfig {
  const raw = (block.config ?? {}) as Partial<QuoteBlockConfig>;

  const textSource =
    typeof raw.text === 'string'
      ? raw.text
      : typeof block.text === 'string'
        ? block.text
        : DEFAULT_QUOTE_CONFIG.text;

  const authorSource =
    typeof raw.author === 'string'
      ? raw.author
      : typeof block.author === 'string'
        ? block.author
        : DEFAULT_QUOTE_CONFIG.author;

  const styleCandidate =
    typeof raw.style === 'string'
      ? raw.style.toLowerCase()
      : undefined;
  const style: QuoteBlockConfig['style'] =
    styleCandidate === 'emphasis' || styleCandidate === 'card'
      ? styleCandidate
      : 'plain';

  const bgColorSource =
    typeof raw.bgColor === 'string' && raw.bgColor.trim().length > 0
      ? raw.bgColor.trim()
      : typeof block.bgColor === 'string' && block.bgColor.trim().length > 0
        ? block.bgColor.trim()
        : DEFAULT_QUOTE_CONFIG.bgColor;

  const bgOpacitySource =
    parseNumber(raw.bgOpacity) ??
    parseNumber(block.bgOpacity) ??
    DEFAULT_QUOTE_CONFIG.bgOpacity;

  const radiusSource =
    parseNumber(raw.radius) ??
    parseNumber(block.radius) ??
    DEFAULT_QUOTE_CONFIG.radius;

  const paddingSource =
    parseNumber(raw.padding) ??
    parseNumber(block.padding) ??
    DEFAULT_QUOTE_CONFIG.padding;

  const alignCandidate =
    typeof raw.align === 'string'
      ? raw.align
      : typeof block.align === 'string'
        ? block.align
        : DEFAULT_QUOTE_CONFIG.align;
  const alignNormalized =
    typeof alignCandidate === 'string'
      ? alignCandidate.toLowerCase()
      : DEFAULT_QUOTE_CONFIG.align;
  const align: QuoteBlockConfig['align'] =
    alignNormalized === 'center' || alignNormalized === 'right'
      ? (alignNormalized as QuoteBlockConfig['align'])
      : 'left';

  return {
    text: textSource,
    author: authorSource,
    style,
    bgColor: bgColorSource,
    bgOpacity: clamp(bgOpacitySource, 0, 1),
    radius: Math.max(0, radiusSource),
    padding: Math.max(0, paddingSource),
    align,
  };
}

function ensureFrame(block: SlideBlock, device: DeviceKind): Frame {
  const fallback: Frame = { x: 10, y: 10, w: 40, h: 20, r: 0 };
  if (block.frames?.[device]) return block.frames[device]!;
  const existing = Object.values(block.frames || {})[0];
  return existing ? existing : fallback;
}

export default function SlidesManager({
  initialCfg,
  onChange,
  editable,
  selectedId,
  onSelectBlock,
  openInspector,
  onCanvasClick,
  activeDevice = 'desktop',
  editInPreview = true,
  scale = 1,
  onManipulationChange,
}: SlidesManagerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const cfg = useMemo(() => initialCfg, [initialCfg]);
  const deviceSize = DEVICE_DIMENSIONS[activeDevice] ?? DEVICE_DIMENSIONS.desktop;

  const handleFrameChange = (blockId: string, frame: Frame, options?: SlidesManagerChangeOptions) => {
    const next: SlideCfg = {
      ...cfg,
      blocks: cfg.blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              frames: {
                ...b.frames,
                [activeDevice]: { ...frame },
              },
            }
          : b
      ),
    };
    onChange(next, options);
  };

  const handleInlineText = (blockId: string, text: string) => {
    const next: SlideCfg = {
      ...cfg,
      blocks: cfg.blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              text,
              content: text,
            }
          : b,
      ),
    };
    onChange(next, { commit: true });
  };

  const renderBlockContent = (block: SlideBlock): ReactNode => {
    switch (block.kind) {
      case 'heading':
      case 'subheading':
      case 'text': {
        const Tag = block.kind === 'heading' ? 'h2' : block.kind === 'subheading' ? 'h3' : 'p';
        const align = block.align ?? 'left';
        const fallbackWeight = block.kind === 'heading' ? 700 : block.kind === 'subheading' ? 600 : 400;
        const fontFamilyKey = block.fontFamily ?? 'default';
        const resolvedFontFamily = FONT_FAMILY_MAP[fontFamilyKey];
        const fontSizePx =
          typeof block.fontSize === 'number'
            ? block.fontSize
            : block.size
              ? SIZE_TO_FONT_SIZE[block.size]
              : undefined;
        const lineHeightValue = resolveLineHeightValue(block.lineHeight, block.lineHeightUnit);
        const letterSpacingValue =
          typeof block.letterSpacing === 'number' ? `${block.letterSpacing}px` : undefined;
        const textShadowValue = block.textShadow
          ? `${block.textShadow.x ?? 0}px ${block.textShadow.y ?? 0}px ${block.textShadow.blur ?? 0}px ${
              block.textShadow.color ?? '#000000'
            }`
          : undefined;
        const textColor = block.textColor ?? block.color ?? '#ffffff';
        const style: CSSProperties = {
          color: textColor,
          textAlign: align,
          fontWeight: block.fontWeight ?? fallbackWeight,
          fontSize: fontSizePx ? `${fontSizePx}px` : undefined,
          lineHeight: lineHeightValue,
          letterSpacing: letterSpacingValue,
          textShadow: textShadowValue,
        };
        if (resolvedFontFamily) {
          style.fontFamily = resolvedFontFamily;
        }
        const editableProps =
          editable && editInPreview
            ? {
                contentEditable: true,
                suppressContentEditableWarning: true,
                onBlur: (e: React.FocusEvent<HTMLElement>) =>
                  handleInlineText(block.id, e.currentTarget.textContent || ''),
              }
            : {};
        const content = block.content ?? block.text ?? '';
        const textElement = (
          <Tag
            {...editableProps}
            style={style}
            className="leading-tight"
          >
            {content}
          </Tag>
        );
        if (
          (block.kind === 'heading' || block.kind === 'text') &&
          block.bgStyle &&
          block.bgStyle !== 'none'
        ) {
          const resolvedOpacity = block.bgOpacity ?? (block.bgStyle === 'glass' ? 0.5 : 1);
          const backgroundColor =
            hexToRgba(block.bgColor ?? '#000000', resolvedOpacity) ??
            hexToRgba('#000000', resolvedOpacity);
          const backgroundStyle: CSSProperties = {
            display: 'inline-block',
            borderRadius: block.radius ?? 0,
            padding: block.padding ?? 0,
            backgroundColor,
          };
          if (block.bgStyle === 'glass') {
            backgroundStyle.backdropFilter = 'blur(8px)';
          }
          return (
            <div style={{ width: '100%', textAlign: align }}>
              <div style={backgroundStyle}>{textElement}</div>
            </div>
          );
        }
        return textElement;
      }
      case 'button': {
        const button = resolveButtonConfig(block);
        const sizeClassMap: Record<ButtonBlockSize, string> = {
          Small: 'px-3 py-2 text-sm',
          Medium: 'px-5 py-3 text-base',
          Large: 'px-6 py-3.5 text-lg',
        };
        const sizeClasses = sizeClassMap[button.size] ?? sizeClassMap.Medium;
        const variantClasses =
          button.variant === 'Primary'
            ? 'btn-primary'
            : button.variant === 'Outline'
              ? 'btn-outline bg-transparent border'
              : 'btn-ghost bg-transparent';
        const shadowClass = button.shadow ? 'shadow-lg' : 'shadow-none';
        const classes = [
          'inline-flex items-center justify-center font-semibold no-underline transition duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          sizeClasses,
          button.fullWidth ? 'w-full' : undefined,
          variantClasses,
          shadowClass,
        ]
          .filter(Boolean)
          .join(' ');
        const fontFamilyKey = block.fontFamily ?? 'default';
        const resolvedFontFamily = FONT_FAMILY_MAP[fontFamilyKey];
        const fontSizePx =
          typeof block.fontSize === 'number'
            ? block.fontSize
            : BUTTON_FONT_SIZE_PX[button.size] ?? BUTTON_FONT_SIZE_PX.Medium;
        const lineHeightValue = resolveLineHeightValue(block.lineHeight, block.lineHeightUnit);
        const align = block.align ?? 'left';
        const style: CSSProperties = {
          borderRadius: button.radius,
          color: button.textColor,
          backgroundColor: button.variant === 'Primary' ? button.bgColor : 'transparent',
          borderColor: button.variant === 'Outline' ? button.bgColor : 'transparent',
          borderWidth: button.variant === 'Outline' ? 1 : 0,
          borderStyle: 'solid',
          fontWeight: block.fontWeight ?? 600,
        };
        if (resolvedFontFamily) {
          style.fontFamily = resolvedFontFamily;
        }
        if (fontSizePx) {
          style.fontSize = `${fontSizePx}px`;
        }
        if (lineHeightValue !== undefined) {
          style.lineHeight = lineHeightValue;
        }
        if (button.fullWidth) {
          style.width = '100%';
        }
        const wrapperStyle: CSSProperties = { width: '100%', textAlign: align };
        return (
          <div style={wrapperStyle}>
            <a
              href={button.href || '#'}
              onClick={(e) => e.preventDefault()}
              className={classes}
              style={style}
            >
              {button.label || 'Button'}
            </a>
          </div>
        );
      }
      case 'image': {
        const image = resolveImageConfig(block);
        const imageUrl = image.url || block.src || '';
        if (!imageUrl) {
          const placeholderClasses = ['h-full w-full bg-neutral-200'];
          if (image.shadow) placeholderClasses.push('shadow-lg');
          return (
            <div
              className={placeholderClasses.join(' ')}
              style={{ borderRadius: image.radius }}
            />
          );
        }
        const classes = ['h-full w-full'];
        if (image.shadow) classes.push('shadow-lg');
        return (
          <img
            src={imageUrl}
            alt={image.alt || ''}
            className={classes.join(' ')}
            style={{
              objectFit: image.fit,
              objectPosition: `${image.focalX * 100}% ${image.focalY * 100}%`,
              borderRadius: image.radius,
            }}
          />
        );
      }
      case 'quote': {
        const quote = resolveQuoteConfig(block);
        const defaultTextColor = quote.style === 'plain' ? '#ffffff' : '#111111';
        const textColor = block.textColor ?? block.color ?? defaultTextColor;
        const fontFamilyKey = block.fontFamily ?? 'default';
        const resolvedFontFamily = FONT_FAMILY_MAP[fontFamilyKey];
        const fallbackWeight = block.fontWeight ?? (quote.style === 'emphasis' ? 600 : 400);
        const fontSizePx =
          typeof block.fontSize === 'number'
            ? block.fontSize
            : quote.style === 'emphasis'
              ? 24
              : 16;
        const lineHeightValue = resolveLineHeightValue(block.lineHeight, block.lineHeightUnit);
        const wrapperStyle: CSSProperties = {
          width: '100%',
          textAlign: quote.align,
        };
        const innerStyle: CSSProperties = {
          color: textColor,
          textAlign: quote.align,
        };
        if (resolvedFontFamily) {
          innerStyle.fontFamily = resolvedFontFamily;
        }
        const innerClasses = ['max-w-full'];
        if (quote.style === 'emphasis' || quote.style === 'card') {
          const backgroundColor = hexToRgba(quote.bgColor, quote.bgOpacity);
          if (backgroundColor) {
            innerStyle.backgroundColor = backgroundColor;
          }
          innerStyle.borderRadius = quote.radius;
          innerStyle.padding = quote.padding;
          innerStyle.display = 'inline-block';
        }
        if (quote.style === 'card') {
          innerClasses.push('shadow-lg');
        }
        const textClasses = ['whitespace-pre-line'];
        if (quote.style === 'emphasis') {
          textClasses.push('italic', 'text-2xl', 'font-semibold');
        } else {
          textClasses.push('italic');
        }
        const textStyle: CSSProperties = {
          fontWeight: fallbackWeight,
          lineHeight: lineHeightValue,
        };
        if (resolvedFontFamily) {
          textStyle.fontFamily = resolvedFontFamily;
        }
        if (fontSizePx) {
          textStyle.fontSize = `${fontSizePx}px`;
        }
        const authorClasses = ['mt-3', 'text-sm', 'opacity-80', 'whitespace-pre-line'];
        const authorStyle: CSSProperties = {};
        if (resolvedFontFamily) {
          authorStyle.fontFamily = resolvedFontFamily;
        }
        if (typeof block.fontWeight === 'number') {
          authorStyle.fontWeight = block.fontWeight;
        }
        if (lineHeightValue !== undefined) {
          authorStyle.lineHeight = lineHeightValue;
        }
        const trimmedAuthor = quote.author.trim();
        return (
          <div style={wrapperStyle}>
            <div className={innerClasses.join(' ')} style={innerStyle}>
              <p className={textClasses.join(' ')} style={textStyle}>“{quote.text}”</p>
              {trimmedAuthor.length > 0 ? (
                <p className={authorClasses.join(' ')} style={authorStyle}>— {trimmedAuthor}</p>
              ) : null}
            </div>
          </div>
        );
      }
      case 'gallery': {
        return <GalleryBlockPreview block={block} />;
      }
      case 'spacer':
        return <div className="w-full h-full" />;
      default:
        return null;
    }
  };

  const clampedScale = Math.min(Math.max(scale || 1, 0.05), 1);

  return (
    <div className="flex h-full w-full items-start justify-center overflow-hidden">
      <div
        className="relative"
        style={{
          width: deviceSize.width,
          height: deviceSize.height,
          transform: `scale(${clampedScale})`,
          transformOrigin: 'top center',
          margin: '0 auto',
        }}
      >
        <div
          ref={frameRef}
          className="relative overflow-hidden rounded-2xl bg-white shadow-xl"
          style={{ width: deviceSize.width, height: deviceSize.height }}
          onClick={() => {
            if (editable && editInPreview) {
              onSelectBlock?.(null);
              onCanvasClick?.();
            }
          }}
        >
          <SlideBackground cfg={cfg} />
          <div
            className="absolute inset-0"
            style={{ pointerEvents: editable && editInPreview ? 'auto' : 'none' }}
          >
            {cfg.blocks.map((block) => {
              const frame = ensureFrame(block, activeDevice);
              const locked = Boolean(block.locked);
              return (
                <InteractiveBox
                  key={block.id}
                  id={block.id}
                  frame={frame}
                  containerRef={frameRef}
                  selected={selectedId === block.id}
                  editable={editable && editInPreview}
                  onSelect={() => onSelectBlock?.(block.id)}
                  onTap={() => {
                    onSelectBlock?.(block.id);
                    openInspector?.();
                  }}
                  onChange={(nextFrame, opts) => handleFrameChange(block.id, nextFrame, opts)}
                  scale={clampedScale}
                  locked={locked}
                  onManipulationChange={onManipulationChange}
                >
                  {renderBlockContent(block)}
                </InteractiveBox>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function GalleryBlockPreview({ block }: { block: SlideBlock }) {
  const config = useMemo(() => resolveGalleryConfig(block), [block]);
  const items = config.items;
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [block.id, config.layout, items.length]);

  useEffect(() => {
    if (config.layout !== 'carousel') return;
    const container = scrollRef.current;
    if (!container) return;
    const width = container.clientWidth;
    container.scrollTo({ left: width * activeIndex, behavior: 'smooth' });
  }, [activeIndex, config.layout]);

  useEffect(() => {
    if (config.layout !== 'carousel') return;
    if (!config.autoplay) return;
    if (items.length <= 1) return;
    const interval = Math.max(200, Number.isFinite(config.interval) ? config.interval : DEFAULT_GALLERY_CONFIG.interval);
    const id = window.setInterval(() => {
      setActiveIndex((prev) => {
        const next = prev + 1;
        return next >= items.length ? 0 : next;
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [config.autoplay, config.interval, config.layout, items.length]);

  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(items.length > 0 ? Math.max(0, items.length - 1) : 0);
    }
  }, [activeIndex, items.length]);

  const wrapperClasses = ['h-full', 'w-full', 'overflow-hidden'];
  if (config.shadow) wrapperClasses.push('shadow-lg');
  const wrapperStyle: CSSProperties = { borderRadius: config.radius };

  if (items.length === 0) {
    return (
      <div className={wrapperClasses.join(' ')} style={wrapperStyle}>
        <div className="flex h-full items-center justify-center text-xs text-neutral-400">
          No images yet
        </div>
      </div>
    );
  }

  if (config.layout === 'carousel') {
    return (
      <div className={wrapperClasses.join(' ')} style={wrapperStyle}>
        <div
          ref={scrollRef}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto"
          style={{ scrollBehavior: 'smooth' }}
        >
          {items.map((item, index) => (
            <div
              key={`${item.url}-${index}`}
              className="flex h-full w-full flex-none snap-center"
              style={{ minWidth: '100%' }}
            >
              <img
                src={item.url}
                alt={item.alt || ''}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const columns = Math.min(items.length, 3) || 1;

  return (
    <div className={wrapperClasses.join(' ')} style={wrapperStyle}>
      <div
        className="grid h-full w-full gap-2"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridAutoRows: '1fr',
        }}
      >
        {items.map((item, index) => (
          <div key={`${item.url}-${index}`} className="relative h-full w-full overflow-hidden">
            <img
              src={item.url}
              alt={item.alt || ''}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

type InteractiveBoxProps = {
  id: string;
  frame: Frame;
  containerRef: React.RefObject<HTMLDivElement>;
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
  onTap: () => void;
  onChange: (frame: Frame, options?: SlidesManagerChangeOptions) => void;
  children: ReactNode;
  scale: number;
  locked?: boolean;
  onManipulationChange?: (manipulating: boolean) => void;
};

type PointerState = {
  type: 'move' | 'resize' | 'rotate';
  startX: number;
  startY: number;
  startTime: number;
  startFrame: Frame;
  corner?: string;
  scale: number;
  moved: boolean;
  hasManipulated: boolean;
  locked: boolean;
};

const TAP_MAX_MOVEMENT = 4;
const TAP_MAX_DURATION = 300;

function InteractiveBox({
  frame,
  containerRef,
  selected,
  editable,
  onSelect,
  onTap,
  onChange,
  children,
  scale,
  locked = false,
  onManipulationChange,
}: InteractiveBoxProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const pointerState = useRef<PointerState | null>(null);

  const getContainerRect = () => containerRef.current?.getBoundingClientRect();

  const handlePointerDown = (type: PointerState['type'], corner?: string) => (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    const rect = getContainerRect();
    if (!rect) return;
    if (locked && type !== 'move') {
      onSelect();
      return;
    }
    const state: PointerState = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      startFrame: { ...frame },
      corner,
      scale,
      moved: false,
      hasManipulated: false,
      locked,
    };
    if (type === 'rotate' && !locked) {
      state.hasManipulated = true;
      onManipulationChange?.(true);
    }
    pointerState.current = state;
    localRef.current?.setPointerCapture?.(e.pointerId);
    onSelect();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!editable) return;
    const ps = pointerState.current;
    if (!ps) return;
    const rect = getContainerRect();
    if (!rect) return;
    const deltaX = e.clientX - ps.startX;
    const deltaY = e.clientY - ps.startY;
    const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    if (distance > TAP_MAX_MOVEMENT) {
      ps.moved = true;
    }
    if (ps.locked) return;
    const effectiveScale = ps.scale || 1;
    const width = rect.width / effectiveScale;
    const height = rect.height / effectiveScale;
    const scaledX = deltaX / effectiveScale;
    const scaledY = deltaY / effectiveScale;
    const dx = (scaledX / width) * 100;
    const dy = (scaledY / height) * 100;

    if ((ps.type === 'move' || ps.type === 'resize') && !ps.hasManipulated && distance > TAP_MAX_MOVEMENT) {
      ps.hasManipulated = true;
      onManipulationChange?.(true);
    }

    if (ps.type === 'move') {
      const next: Frame = {
        ...ps.startFrame,
        x: clamp(ps.startFrame.x + dx, 0, 100 - ps.startFrame.w),
        y: clamp(ps.startFrame.y + dy, 0, 100 - ps.startFrame.h),
      };
      onChange(next, { commit: false });
    } else if (ps.type === 'resize') {
      const next: Frame = { ...ps.startFrame };
      const min = 5;
      if (ps.corner?.includes('e')) {
        next.w = clamp(ps.startFrame.w + dx, min, 100 - ps.startFrame.x);
      }
      if (ps.corner?.includes('s')) {
        next.h = clamp(ps.startFrame.h + dy, min, 100 - ps.startFrame.y);
      }
      if (ps.corner?.includes('w')) {
        const newX = clamp(ps.startFrame.x + dx, 0, ps.startFrame.x + ps.startFrame.w - min);
        const delta = ps.startFrame.x - newX;
        next.x = newX;
        next.w = clamp(ps.startFrame.w + delta, min, 100 - newX);
      }
      if (ps.corner?.includes('n')) {
        const newY = clamp(ps.startFrame.y + dy, 0, ps.startFrame.y + ps.startFrame.h - min);
        const delta = ps.startFrame.y - newY;
        next.y = newY;
        next.h = clamp(ps.startFrame.h + delta, min, 100 - newY);
      }
      onChange(next, { commit: false });
    } else if (ps.type === 'rotate') {
      const el = localRef.current;
      if (!el) return;
      if (!ps.hasManipulated) {
        ps.hasManipulated = true;
        onManipulationChange?.(true);
      }
      const box = el.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
      const deg = ((Math.round(angle) % 360) + 360) % 360;
      onChange({ ...ps.startFrame, r: deg }, { commit: false });
    }
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    if (!editable) return;
    const ps = pointerState.current;
    if (!ps) return;
    pointerState.current = null;
    localRef.current?.releasePointerCapture?.(e.pointerId);
    const duration = performance.now() - ps.startTime;
    const deltaX = e.clientX - ps.startX;
    const deltaY = e.clientY - ps.startY;
    const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    const isTap =
      ps.type === 'move' &&
      !ps.hasManipulated &&
      distance < TAP_MAX_MOVEMENT &&
      duration < TAP_MAX_DURATION;

    if (ps.hasManipulated && !ps.locked) {
      onChange(frame, { commit: true });
    } else if (isTap) {
      onTap();
    }

    if (ps.hasManipulated) {
      onManipulationChange?.(false);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!editable) return;
    const ps = pointerState.current;
    if (!ps) return;
    pointerState.current = null;
    localRef.current?.releasePointerCapture?.(e.pointerId);
    if (ps.hasManipulated) {
      onManipulationChange?.(false);
    }
  };

  const style: CSSProperties = {
    position: 'absolute',
    left: `${frame.x}%`,
    top: `${frame.y}%`,
    width: `${frame.w}%`,
    height: `${frame.h}%`,
    transform: `rotate(${frame.r ?? 0}deg)`,
    transformOrigin: 'top left',
    border: selected && editable ? '1px dashed rgba(56,189,248,0.8)' : undefined,
    borderRadius: 8,
    touchAction: 'none',
    cursor: editable && !locked ? 'move' : 'default',
  };

  return (
    <div
      ref={localRef}
      style={style}
      onPointerDown={handlePointerDown('move')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
      onClick={(e) => {
        if (!editable) return;
        e.stopPropagation();
        onSelect();
      }}
    >
      {children}
      {editable && selected && (
        <>
          <div
            onPointerDown={handlePointerDown('rotate')}
            className="absolute left-1/2 top-[-32px] h-5 w-5 -translate-x-1/2 rounded-full border border-sky-500 bg-white"
          />
          {[
            ['n', '50%', 0],
            ['s', '50%', 100],
            ['w', 0, '50%'],
            ['e', 100, '50%'],
            ['nw', 0, 0],
            ['ne', 100, 0],
            ['sw', 0, 100],
            ['se', 100, 100],
          ].map(([corner, left, top]) => (
            <div
              key={corner as string}
              onPointerDown={handlePointerDown('resize', corner as string)}
              className="absolute h-3 w-3 rounded-full border border-sky-500 bg-white"
              style={{
                left: typeof left === 'number' ? `${left}%` : left,
                top: typeof top === 'number' ? `${top}%` : top,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

function SlideBackground({ cfg }: { cfg: SlideCfg }) {
  const bg = cfg.background;
  if (!bg || bg.type === 'none') return null;
  if (bg.type === 'color') {
    const opacity = typeof bg.opacity === 'number' ? clamp(bg.opacity, 0, 1) : 1;
    return (
      <>
        <div
          className="absolute inset-0"
          style={{ background: bg.color || '#111', opacity, pointerEvents: 'none' }}
        />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{
              background: bg.overlay.color,
              opacity: bg.overlay.opacity,
              pointerEvents: 'none',
            }}
          />
        )}
      </>
    );
  }
  if (bg.type === 'image') {
    const focalX = clamp(bg.focal?.x ?? 0.5, 0, 1);
    const focalY = clamp(bg.focal?.y ?? 0.5, 0, 1);
    const blur = typeof bg.blur === 'number' ? clamp(bg.blur, 0, 12) : 0;
    return (
      <>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: bg.url ? `url(${bg.url})` : undefined,
            backgroundSize: bg.fit || 'cover',
            backgroundPosition: `${(focalX * 100).toFixed(2)}% ${(focalY * 100).toFixed(2)}%`,
            filter: blur ? `blur(${blur}px)` : undefined,
            pointerEvents: 'none',
          }}
        />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{
              background: bg.overlay.color,
              opacity: bg.overlay.opacity,
              pointerEvents: 'none',
            }}
          />
        )}
      </>
    );
  }
  if (bg.type === 'video' && bg.url) {
    const focalX = clamp(bg.focal?.x ?? 0.5, 0, 1);
    const focalY = clamp(bg.focal?.y ?? 0.5, 0, 1);
    const blur = typeof bg.blur === 'number' ? clamp(bg.blur, 0, 12) : 0;
    return (
      <>
        <video
          src={bg.url}
          poster={bg.poster}
          loop={bg.loop ?? true}
          muted={bg.mute ?? true}
          autoPlay={bg.autoplay ?? true}
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            objectFit: bg.fit || 'cover',
            objectPosition: `${(focalX * 100).toFixed(2)}% ${(focalY * 100).toFixed(2)}%`,
            filter: blur ? `blur(${blur}px)` : undefined,
          }}
        />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{
              background: bg.overlay.color,
              opacity: bg.overlay.opacity,
              pointerEvents: 'none',
            }}
          />
        )}
      </>
    );
  }
  return null;
}

export function SlidesDashboardList({
  restaurantId,
  onEdit,
  refreshKey,
}: {
  restaurantId: string;
  onEdit: (row: SlideRow) => void;
  refreshKey: number;
}) {
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  async function loadSlides() {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_slides')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true });
    if (error) {
      toast.error('Failed to load slides');
    } else {
      setSlides(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (restaurantId) loadSlides();
  }, [restaurantId, refreshKey]);

  function openCreate() {
    onEdit({ restaurant_id: restaurantId, type: 'menu_highlight' });
  }

  function openEdit(row: SlideRow) {
    onEdit(row);
  }

  async function handleDelete(row: SlideRow) {
    if (!confirm('Delete this slide?')) return;
    const prev = slides;
    setSlides(prev.filter((s) => s.id !== row.id));
    const { error } = await supabase
      .from('restaurant_slides')
      .delete()
      .eq('id', row.id)
      .eq('restaurant_id', restaurantId);
    if (error) {
      toast.error('Failed to delete');
      setSlides(prev);
    }
  }

  async function toggleActive(row: SlideRow) {
    const updated = slides.map((s) => (s.id === row.id ? { ...s, is_active: !row.is_active } : s));
    setSlides(updated);
    const { error } = await supabase
      .from('restaurant_slides')
      .update({ is_active: !row.is_active })
      .eq('id', row.id)
      .eq('restaurant_id', restaurantId);
    if (error) {
      toast.error('Failed to update');
      setSlides(slides);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const nonHero = slides.filter((s) => s.type !== 'hero');
    const oldIndex = nonHero.findIndex((s) => s.id === active.id);
    const newIndex = nonHero.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(nonHero, oldIndex, newIndex);
    setSlides((prev) => {
      const heroes = prev.filter((s) => s.type === 'hero');
      return [...heroes, ...reordered].sort((a, b) => a.sort_order - b.sort_order);
    });
    const responses = await Promise.all(
      reordered.map((s, i) =>
        supabase
          .from('restaurant_slides')
          .update({ sort_order: i })
          .eq('id', s.id!)
          .eq('restaurant_id', restaurantId)
      )
    );
    if (responses.some((r) => r.error)) {
      toast.error('Failed to reorder');
      loadSlides();
    } else {
      loadSlides();
    }
  }

  async function move(row: SlideRow, dir: 'up' | 'down') {
    const nonHero = slides
      .filter((s) => s.type !== 'hero')
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = nonHero.findIndex((s) => s.id === row.id);
    const swapIndex = dir === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= nonHero.length) return;
    const target = nonHero[swapIndex];
    const reordered = [...nonHero];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    setSlides((prev) => {
      const heroes = prev.filter((s) => s.type === 'hero');
      return [...heroes, ...reordered].sort((a, b) => a.sort_order - b.sort_order);
    });
    const [resA, resB] = await Promise.all([
      supabase
        .from('restaurant_slides')
        .update({ sort_order: swapIndex })
        .eq('id', row.id!)
        .eq('restaurant_id', restaurantId),
      supabase
        .from('restaurant_slides')
        .update({ sort_order: index })
        .eq('id', target.id!)
        .eq('restaurant_id', restaurantId),
    ]);
    if (resA.error || resB.error) {
      toast.error('Failed to reorder');
      loadSlides();
    } else {
      loadSlides();
    }
  }

  async function addStarter() {
    const { data: maxRow, error: maxErr } = await supabase
      .from('restaurant_slides')
      .select('sort_order')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) {
      toast.error('Failed');
      return;
    }
    const base = (maxRow?.sort_order ?? -1) + 1;
    const rows: SlideRow[] = [
      {
        restaurant_id: restaurantId,
        type: 'menu_highlight',
        title: 'Customer Favourites',
        subtitle: 'What locals love most',
        cta_label: 'Browse Menu',
        cta_href: '/menu',
        sort_order: base,
        is_active: true,
      },
      {
        restaurant_id: restaurantId,
        type: 'reviews',
        title: 'Loved by the community',
        subtitle: '4.8 ★ average',
        sort_order: base + 1,
        is_active: true,
      },
      {
        restaurant_id: restaurantId,
        type: 'location_hours',
        title: 'Find Us',
        subtitle: 'Open today',
        cta_label: 'Get Directions',
        cta_href: '/p/contact',
        sort_order: base + 2,
        is_active: true,
      },
    ];
    const { error } = await supabase.from('restaurant_slides').insert(rows);
    if (error) {
      toast.error('Failed to insert');
    } else {
      toast.success('Starter slides added');
      loadSlides();
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Slides (beta)</h3>
        <div className="flex gap-2">
          <button onClick={addStarter} className="px-3 py-2 rounded border">
            Add Starter Slides
          </button>
          <button onClick={openCreate} className="px-3 py-2 rounded bg-emerald-600 text-white">
            New Slide
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : slides.length === 0 ? (
        <div className="rounded border p-4 text-sm text-neutral-500">No slides yet.</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.id!)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y rounded border">
              {slides.map((s) => (
                <SortableRow
                  key={s.id}
                  row={s}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onToggle={toggleActive}
                  onMove={move}
                  index={slides
                    .filter((h) => h.type !== 'hero')
                    .findIndex((n) => n.id === s.id)}
                  lastIndex={slides.filter((h) => h.type !== 'hero').length - 1}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

type SortableRowProps = {
  row: SlideRow;
  onEdit: (r: SlideRow) => void;
  onDelete: (r: SlideRow) => void;
  onToggle: (r: SlideRow) => void;
  onMove: (r: SlideRow, dir: 'up' | 'down') => void;
  index: number;
  lastIndex: number;
};

function SortableRow({ row, onEdit, onDelete, onToggle, onMove, index, lastIndex }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: row.id!,
    disabled: row.type === 'hero',
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;
  const locked = row.type === 'hero';
  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-3 p-3">
      <span
        {...attributes}
        {...listeners}
        className={`cursor-grab ${locked ? 'opacity-50' : ''}`}
      >
        <ArrowsUpDownIcon className="h-5 w-5" />
      </span>
      <div className="flex flex-col">
        <button disabled={locked || index <= 0} onClick={() => onMove(row, 'up')}>
          <ChevronUpIcon className="h-4 w-4" />
        </button>
        <button disabled={locked || index === lastIndex} onClick={() => onMove(row, 'down')}>
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </div>
      <span className="text-xs px-2 py-1 rounded border">{row.type}</span>
      <div className="flex-1">{row.title}</div>
      {locked ? (
        <span className="px-2 py-1 text-xs border rounded">Locked</span>
      ) : (
        <label className="inline-flex items-center gap-1 text-sm">
          <input type="checkbox" checked={row.is_active ?? true} onChange={() => onToggle(row)} />
          Active
        </label>
      )}
      <button onClick={() => onEdit(row)} className="ml-2 px-3 py-1 rounded border" disabled={locked}>
        Edit
      </button>
      <button
        onClick={() => onDelete(row)}
        className="ml-2 px-3 py-1 rounded border text-red-600"
        disabled={locked}
      >
        Delete
      </button>
    </li>
  );
}

