import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

const TEXTUAL_BLOCK_KIND_NAMES = new Set([
  'heading',
  'subheading',
  'text',
  'quote',
  'button',
] as const);

const isTextualKind = (kind: string): boolean => TEXTUAL_BLOCK_KIND_NAMES.has(kind as any);

export type DeviceKind = 'mobile' | 'tablet' | 'desktop';

type TextTag = 'h2' | 'h3' | 'p';

export type BlockVisibilityConfig = {
  mobile: boolean;
  tablet: boolean;
  desktop: boolean;
};

export const DEFAULT_BLOCK_VISIBILITY: BlockVisibilityConfig = {
  mobile: true,
  tablet: true,
  desktop: true,
};

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

const FONT_FAMILY_VALUE_LIST = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Montserrat',
  'Nunito',
  'Raleway',
  'Merriweather',
  'Playfair Display',
  'Source Sans Pro',
  'Ubuntu',
  'Oswald',
  'PT Sans',
  'Work Sans',
  'Quicksand',
  'Dancing Script',
  'Lobster',
  'Roboto Mono',
] as const;

type ModernFontFamily = (typeof FONT_FAMILY_VALUE_LIST)[number];

export type SlideBlockFontFamily =
  | 'default'
  | ModernFontFamily
  | 'sans'
  | 'serif'
  | 'mono';

export type FontFamilySelectOption = {
  value: SlideBlockFontFamily;
  label: string;
  stack?: string;
  previewStack: string;
  legacy?: boolean;
};

const FONT_FAMILY_STACKS: Record<ModernFontFamily, string> = {
  Inter: '"Inter", "Helvetica Neue", Arial, sans-serif',
  Roboto: '"Roboto", "Helvetica Neue", Arial, sans-serif',
  'Open Sans': '"Open Sans", "Helvetica Neue", Arial, sans-serif',
  Lato: '"Lato", "Helvetica Neue", Arial, sans-serif',
  Poppins: '"Poppins", "Helvetica Neue", Arial, sans-serif',
  Montserrat: '"Montserrat", "Helvetica Neue", Arial, sans-serif',
  Nunito: '"Nunito", "Helvetica Neue", Arial, sans-serif',
  Raleway: '"Raleway", "Helvetica Neue", Arial, sans-serif',
  Merriweather: '"Merriweather", Georgia, serif',
  'Playfair Display': '"Playfair Display", "Times New Roman", serif',
  'Source Sans Pro': '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif',
  Ubuntu: '"Ubuntu", "Helvetica Neue", Arial, sans-serif',
  Oswald: '"Oswald", "Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif',
  'PT Sans': '"PT Sans", "Helvetica Neue", Arial, sans-serif',
  'Work Sans': '"Work Sans", "Helvetica Neue", Arial, sans-serif',
  Quicksand: '"Quicksand", "Trebuchet MS", sans-serif',
  'Dancing Script': '"Dancing Script", "Comic Sans MS", cursive',
  Lobster: '"Lobster", "Brush Script MT", cursive',
  'Roboto Mono': '"Roboto Mono", "Courier New", monospace',
};

export const DEFAULT_TEXT_FONT_FAMILY: SlideBlockFontFamily = 'Inter';

export const FONT_FAMILY_SELECT_OPTIONS: FontFamilySelectOption[] = [
  {
    value: 'default',
    label: 'Theme default (Inter)',
    stack: undefined,
    previewStack: FONT_FAMILY_STACKS.Inter,
  },
  ...FONT_FAMILY_VALUE_LIST.map<FontFamilySelectOption>((value) => ({
    value,
    label: value,
    stack: FONT_FAMILY_STACKS[value],
    previewStack: FONT_FAMILY_STACKS[value],
  })),
  {
    value: 'sans',
    label: 'Legacy Sans Serif',
    stack: FONT_FAMILY_STACKS.Inter,
    previewStack: FONT_FAMILY_STACKS.Inter,
    legacy: true,
  },
  {
    value: 'serif',
    label: 'Legacy Serif',
    stack: 'Georgia, Cambria, "Times New Roman", serif',
    previewStack: 'Georgia, Cambria, "Times New Roman", serif',
    legacy: true,
  },
  {
    value: 'mono',
    label: 'Legacy Monospace',
    stack: FONT_FAMILY_STACKS['Roboto Mono'],
    previewStack: FONT_FAMILY_STACKS['Roboto Mono'],
    legacy: true,
  },
];

const normalizeFontKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const FONT_FAMILY_LOOKUP: Record<string, SlideBlockFontFamily> = (() => {
  const map: Record<string, SlideBlockFontFamily> = {};
  const register = (key: string, value: SlideBlockFontFamily) => {
    map[key] = value;
  };
  register('default', 'default');
  register('inherit', 'default');
  register('defaultinherit', 'default');
  register('sans', 'sans');
  register('sansserif', 'sans');
  register('legacysansserif', 'sans');
  register('serif', 'serif');
  register('legacyserif', 'serif');
  register('mono', 'mono');
  register('monospace', 'mono');
  register('legacymonospace', 'mono');
  FONT_FAMILY_VALUE_LIST.forEach((value) => {
    register(normalizeFontKey(value), value);
  });
  return map;
})();

export function normalizeFontFamily(
  value: unknown,
): SlideBlockFontFamily | undefined {
  if (typeof value !== 'string') return undefined;
  const normalizedKey = normalizeFontKey(value);
  if (!normalizedKey) return undefined;
  return FONT_FAMILY_LOOKUP[normalizedKey];
}

const BLOCK_SHADOW_VALUE: Record<BlockShadowPreset, string | undefined> = {
  none: undefined,
  sm: '0 1px 2px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
  md: '0 4px 6px rgba(15, 23, 42, 0.1), 0 2px 4px rgba(15, 23, 42, 0.06)',
  lg: '0 10px 15px rgba(15, 23, 42, 0.12), 0 4px 6px rgba(15, 23, 42, 0.05)',
};

export type BlockAnimationType =
  | 'none'
  | 'fade-in'
  | 'slide-in-left'
  | 'slide-in-right'
  | 'slide-in-up'
  | 'slide-in-down'
  | 'zoom-in';

export type BlockHoverTransition =
  | 'none'
  | 'grow'
  | 'shrink'
  | 'pulse'
  | 'shadow'
  | 'rotate';

export type BlockAnimationConfig = {
  type: BlockAnimationType;
  duration: number;
  delay: number;
};

export type BlockTransitionConfig = {
  hover: BlockHoverTransition;
  duration: number;
};

const BLOCK_ANIMATION_TYPES: BlockAnimationType[] = [
  'none',
  'fade-in',
  'slide-in-left',
  'slide-in-right',
  'slide-in-up',
  'slide-in-down',
  'zoom-in',
];

const BLOCK_TRANSITION_TYPES: BlockHoverTransition[] = [
  'none',
  'grow',
  'shrink',
  'pulse',
  'shadow',
  'rotate',
];

type BlockAnimationDefinition = {
  name: string;
  timingFunction: string;
};

const BLOCK_ANIMATION_DEFINITIONS: Record<Exclude<BlockAnimationType, 'none'>, BlockAnimationDefinition> = {
  'fade-in': { name: 'of-fade-in', timingFunction: 'ease-out' },
  'slide-in-left': { name: 'of-slide-in-left', timingFunction: 'ease-out' },
  'slide-in-right': { name: 'of-slide-in-right', timingFunction: 'ease-out' },
  'slide-in-up': { name: 'of-slide-in-up', timingFunction: 'ease-out' },
  'slide-in-down': { name: 'of-slide-in-down', timingFunction: 'ease-out' },
  'zoom-in': { name: 'of-zoom-in', timingFunction: 'ease-out' },
};

const BLOCK_TRANSITION_CLASS_MAP: Record<Exclude<BlockHoverTransition, 'none'>, string> = {
  grow: 'of-hover-grow',
  shrink: 'of-hover-shrink',
  pulse: 'of-hover-pulse',
  shadow: 'of-hover-shadow',
  rotate: 'of-hover-rotate',
};

export const DEFAULT_BLOCK_ANIMATION_CONFIG: BlockAnimationConfig = {
  type: 'none',
  duration: 300,
  delay: 0,
};

export const DEFAULT_BLOCK_TRANSITION_CONFIG: BlockTransitionConfig = {
  hover: 'none',
  duration: 200,
};

export const BLOCK_INTERACTION_GLOBAL_STYLES = `
@keyframes of-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes of-slide-in-left {
  from {
    opacity: 0;
    transform: translate3d(-32px, 0, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes of-slide-in-right {
  from {
    opacity: 0;
    transform: translate3d(32px, 0, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes of-slide-in-up {
  from {
    opacity: 0;
    transform: translate3d(0, 32px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes of-slide-in-down {
  from {
    opacity: 0;
    transform: translate3d(0, -32px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes of-zoom-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes of-hover-pulse-keyframes {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.05);
  }
}

.of-hover-grow {
  transition-property: transform, box-shadow;
  transition-duration: var(--of-transition-duration, 200ms);
  transition-timing-function: ease-out;
}

.of-hover-grow:hover {
  transform: scale(1.05);
}

.of-hover-shrink {
  transition-property: transform;
  transition-duration: var(--of-transition-duration, 200ms);
  transition-timing-function: ease-out;
}

.of-hover-shrink:hover {
  transform: scale(0.96);
}

.of-hover-pulse {
  transition: none;
}

.of-hover-pulse:hover {
  animation: of-hover-pulse-keyframes var(--of-transition-duration, 600ms) ease-in-out infinite alternate;
}

.of-hover-shadow {
  transition-property: box-shadow, transform;
  transition-duration: var(--of-transition-duration, 200ms);
  transition-timing-function: ease-out;
}

.of-hover-shadow:hover {
  box-shadow: 0 15px 35px rgba(15, 23, 42, 0.18);
  transform: translateY(-4px);
}

.of-hover-rotate {
  transition-property: transform;
  transition-duration: var(--of-transition-duration, 200ms);
  transition-timing-function: ease-out;
}

.of-hover-rotate:hover {
  transform: rotate(3deg);
}
`;

const BLOCK_GRADIENT_DIRECTION_MAP: Record<BlockBackgroundGradientDirection, string> = {
  'to-top': 'to top',
  'to-bottom': 'to bottom',
  'to-left': 'to left',
  'to-right': 'to right',
};

function getBlockChromeStyle(block: SlideBlock): CSSProperties {
  const textual = isTextualKind(block.kind);
  const style: CSSProperties = {
    width: textual ? 'fit-content' : '100%',
    height: textual ? 'fit-content' : '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'transparent',
    display: textual ? 'inline-flex' : 'block',
  };

  if (textual) {
    style.alignItems = 'flex-start';
  }

  const shadowKey = (block.boxShadow ?? 'none') as BlockShadowPreset;
  const shadowValue = BLOCK_SHADOW_VALUE[shadowKey];
  if (shadowValue) {
    style.boxShadow = shadowValue;
  }

  const borderWidth =
    typeof block.borderWidth === 'number' && Number.isFinite(block.borderWidth)
      ? Math.max(0, block.borderWidth)
      : undefined;
  const borderColor =
    typeof block.borderColor === 'string' ? block.borderColor : undefined;

  if (borderWidth && borderWidth > 0) {
    style.borderWidth = borderWidth;
    style.borderStyle = 'solid';
    style.borderColor = borderColor ?? 'rgba(15, 23, 42, 0.12)';
  } else if (borderColor && borderColor !== 'transparent') {
    style.borderWidth = 1;
    style.borderStyle = 'solid';
    style.borderColor = borderColor;
  }

  const borderRadius =
    typeof block.borderRadius === 'number' && Number.isFinite(block.borderRadius)
      ? Math.max(0, block.borderRadius)
      : undefined;
  if (borderRadius !== undefined) {
    style.borderRadius = borderRadius;
  }

  const background = block.background;
  const backgroundType = background?.type ?? 'none';
  let shouldClip = false;

  if (backgroundType === 'color') {
    style.backgroundColor = background?.color ?? 'transparent';
    shouldClip = true;
  } else if (backgroundType === 'gradient') {
    const gradient = background?.gradient ?? {};
    const from =
      typeof gradient.from === 'string' ? gradient.from : 'rgba(15, 23, 42, 0.4)';
    const to =
      typeof gradient.to === 'string' ? gradient.to : 'rgba(15, 23, 42, 0.05)';
    const rawDirection =
      typeof gradient.direction === 'string'
        ? gradient.direction.replace(/\s+/g, '-').toLowerCase()
        : undefined;
    const directionKey =
      rawDirection === 'to-top' ||
      rawDirection === 'to-left' ||
      rawDirection === 'to-right' ||
      rawDirection === 'to-bottom'
        ? (rawDirection as BlockBackgroundGradientDirection)
        : 'to-bottom';
    const direction = BLOCK_GRADIENT_DIRECTION_MAP[directionKey];
    style.backgroundImage = `linear-gradient(${direction}, ${from}, ${to})`;
    shouldClip = true;
  } else if (backgroundType === 'image') {
    const url = background?.image?.url;
    if (url) {
      style.backgroundImage = `url(${url})`;
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';
      style.backgroundRepeat = 'no-repeat';
      shouldClip = true;
    }
  }

  if (shouldClip && borderRadius !== undefined && borderRadius > 0) {
    style.overflow = 'hidden';
  }

  return style;
}

type BlockChromeProps = { block: SlideBlock; children: ReactNode };

const BlockChrome = React.forwardRef<HTMLDivElement, BlockChromeProps>(({ block, children }, ref) => {
  const baseStyle = getBlockChromeStyle(block);
  const interaction = getBlockInteractionPresentation(block);
  const style = { ...baseStyle, ...(interaction.style || {}) } as CSSProperties;
  const textual = isTextualKind(block.kind);
  const className = ['relative'];
  if (textual) {
    className.push('inline-flex', 'max-w-full');
  } else {
    className.push('h-full', 'w-full');
  }
  if (interaction.classNames && interaction.classNames.length > 0) {
    className.push(...interaction.classNames);
  }
  return (
    <div ref={ref} className={className.join(' ')} style={style}>
      {children}
    </div>
  );
});

BlockChrome.displayName = 'BlockChrome';

type BlockChromeWithAutoSizeProps = {
  block: SlideBlock;
  blockId: string;
  frame: Frame;
  deviceSize: { width: number; height: number };
  autoWidthEnabled: boolean;
  minSizePct: { width: number; height: number };
  onFrameChange: (
    blockId: string,
    frame: Frame,
    options?: SlidesManagerChangeOptions,
  ) => void;
  children: ReactNode;
};

const BlockChromeWithAutoSize = ({
  block,
  blockId,
  frame,
  deviceSize,
  autoWidthEnabled,
  minSizePct,
  onFrameChange,
  children,
}: BlockChromeWithAutoSizeProps) => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useLayoutEffect(() => {
    if (!isTextualKind(block.kind)) return;
    const node = elementRef.current;
    if (!node) return;
    let raf = 0;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const borderBox = entry.borderBoxSize;
      let width = entry.contentRect.width;
      let height = entry.contentRect.height;
      if (borderBox) {
        const box = Array.isArray(borderBox) ? borderBox[0] : borderBox;
        if (box) {
          if (typeof box.inlineSize === 'number') width = box.inlineSize;
          if (typeof box.blockSize === 'number') height = box.blockSize;
        }
      }
      const widthPct = clamp((width / deviceSize.width) * 100, 0, 100);
      const heightPct = clamp((height / deviceSize.height) * 100, 0, 100);
      const currentFrame = frameRef.current;
      const targetHeight = Math.max(heightPct, minSizePct.height);
      const targetWidth = Math.max(widthPct, minSizePct.width);
      const nextFrame: Frame = { ...currentFrame };
      let changed = false;
      if (Math.abs(currentFrame.h - targetHeight) > 0.2) {
        nextFrame.h = targetHeight;
        changed = true;
      }
      if (autoWidthEnabled && Math.abs(currentFrame.w - targetWidth) > 0.2) {
        nextFrame.w = targetWidth;
        changed = true;
      }
      if (changed) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          frameRef.current = nextFrame;
          onFrameChange(blockId, nextFrame, { commit: false });
        });
      }
    });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [autoWidthEnabled, block.kind, blockId, deviceSize.height, deviceSize.width, minSizePct.height, minSizePct.width, onFrameChange]);

  return (
    <BlockChrome ref={isTextualKind(block.kind) ? elementRef : undefined} block={block}>
      {children}
    </BlockChrome>
  );
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
  useReview: boolean;
  reviewId: string | null;
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
  useReview: false,
  reviewId: null,
};

export type BlockShadowPreset = 'none' | 'sm' | 'md' | 'lg';

export type BlockBackgroundGradientDirection =
  | 'to-top'
  | 'to-bottom'
  | 'to-left'
  | 'to-right';

export type BlockBackground = {
  type: 'none' | 'color' | 'gradient' | 'image';
  color?: string;
  gradient?: {
    from?: string;
    to?: string;
    direction?: BlockBackgroundGradientDirection;
  };
  image?: {
    url?: string;
  };
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
  fontFamily?: SlideBlockFontFamily;
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
  boxShadow?: BlockShadowPreset;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  background?: BlockBackground;
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

const TEXT_BLOCK_KINDS: SlideBlock['kind'][] = [
  'heading',
  'subheading',
  'text',
  'quote',
  'button',
];

const isTextualBlock = (kind: SlideBlock['kind']): boolean =>
  TEXT_BLOCK_KINDS.includes(kind);

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

const FONT_FAMILY_BASE_MAP: Partial<
  Record<SlideBlockFontFamily, string | undefined>
> = {
  default: undefined,
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  sans: '"Inter", "Segoe UI", system-ui, sans-serif',
  mono: FONT_FAMILY_STACKS['Roboto Mono'],
};

FONT_FAMILY_SELECT_OPTIONS.forEach((option) => {
  if (option.stack !== undefined) {
    FONT_FAMILY_BASE_MAP[option.value] = option.stack;
  } else if (!(option.value in FONT_FAMILY_BASE_MAP)) {
    FONT_FAMILY_BASE_MAP[option.value] = undefined;
  }
});

const FONT_FAMILY_MAP = FONT_FAMILY_BASE_MAP as Record<
  SlideBlockFontFamily,
  string | undefined
>;

const getBlockFontFamily = (block: SlideBlock): SlideBlockFontFamily => {
  const normalizedFromBlock = normalizeFontFamily(block.fontFamily);
  if (normalizedFromBlock) return normalizedFromBlock;
  const configFont =
    block.config && typeof block.config === 'object'
      ? normalizeFontFamily((block.config as Record<string, any>).fontFamily)
      : undefined;
  return configFont ?? DEFAULT_TEXT_FONT_FAMILY;
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

export function resolveBlockAnimationConfig(block: SlideBlock): BlockAnimationConfig {
  const rawConfig =
    block.config && typeof block.config === 'object' ? ((block.config as Record<string, any>).animation as Record<string, any>) : undefined;
  const typeCandidate =
    typeof rawConfig?.type === 'string'
      ? rawConfig.type.trim().toLowerCase().replace(/\s+/g, '-')
      : undefined;
  const type = BLOCK_ANIMATION_TYPES.includes(typeCandidate as BlockAnimationType)
    ? (typeCandidate as BlockAnimationType)
    : DEFAULT_BLOCK_ANIMATION_CONFIG.type;
  const durationCandidate = parseNumber(rawConfig?.duration);
  const delayCandidate = parseNumber(rawConfig?.delay);
  return {
    type,
    duration:
      durationCandidate !== undefined && Number.isFinite(durationCandidate)
        ? Math.max(0, durationCandidate)
        : DEFAULT_BLOCK_ANIMATION_CONFIG.duration,
    delay:
      delayCandidate !== undefined && Number.isFinite(delayCandidate)
        ? Math.max(0, delayCandidate)
        : DEFAULT_BLOCK_ANIMATION_CONFIG.delay,
  };
}

export function resolveBlockTransitionConfig(block: SlideBlock): BlockTransitionConfig {
  const rawConfig =
    block.config && typeof block.config === 'object' ? ((block.config as Record<string, any>).transition as Record<string, any>) : undefined;
  const hoverCandidate =
    typeof rawConfig?.hover === 'string'
      ? rawConfig.hover.trim().toLowerCase()
      : undefined;
  const hover = BLOCK_TRANSITION_TYPES.includes(hoverCandidate as BlockHoverTransition)
    ? (hoverCandidate as BlockHoverTransition)
    : DEFAULT_BLOCK_TRANSITION_CONFIG.hover;
  const durationCandidate = parseNumber(rawConfig?.duration);
  return {
    hover,
    duration:
      durationCandidate !== undefined && Number.isFinite(durationCandidate)
        ? Math.max(0, durationCandidate)
        : DEFAULT_BLOCK_TRANSITION_CONFIG.duration,
  };
}

export function getBlockInteractionPresentation(
  block: SlideBlock,
): {
  classNames: string[];
  style: (CSSProperties & Record<string, string | number | undefined>) | CSSProperties;
} {
  const animation = resolveBlockAnimationConfig(block);
  const transition = resolveBlockTransitionConfig(block);
  const classes: string[] = [];
  const style: CSSProperties & Record<string, string | number | undefined> = {};

  if (animation.type !== 'none') {
    const definition = BLOCK_ANIMATION_DEFINITIONS[animation.type as Exclude<BlockAnimationType, 'none'>];
    if (definition) {
      style.animationName = definition.name;
      style.animationDuration = `${Math.max(0, animation.duration)}ms`;
      style.animationDelay = `${Math.max(0, animation.delay)}ms`;
      style.animationTimingFunction = definition.timingFunction;
      style.animationFillMode = 'both';
    }
  }

  if (transition.hover !== 'none') {
    const className = BLOCK_TRANSITION_CLASS_MAP[transition.hover as Exclude<BlockHoverTransition, 'none'>];
    if (className) {
      classes.push(className);
      style['--of-transition-duration'] = `${Math.max(0, transition.duration)}ms`;
    }
  }

  return { classNames: classes, style };
}

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

const BUTTON_HORIZONTAL_PADDING: Record<ButtonBlockSize, number> = {
  Small: 12,
  Medium: 20,
  Large: 24,
};

const BUTTON_VERTICAL_PADDING: Record<ButtonBlockSize, number> = {
  Small: 8,
  Medium: 12,
  Large: 14,
};

function resolveTextBlockFontSize(block: SlideBlock): number {
  if (typeof block.fontSize === 'number' && Number.isFinite(block.fontSize)) {
    return Math.max(block.fontSize, 1);
  }
  if (block.kind === 'button') {
    const button = resolveButtonConfig(block);
    const fontSize = BUTTON_FONT_SIZE_PX[button.size] ?? BUTTON_FONT_SIZE_PX.Medium;
    return Math.max(fontSize, 1);
  }
  if (block.size) {
    const mapped = SIZE_TO_FONT_SIZE[block.size];
    if (typeof mapped === 'number') {
      return Math.max(mapped, 1);
    }
  }
  switch (block.kind) {
    case 'heading':
      return 56;
    case 'subheading':
      return SIZE_TO_FONT_SIZE.md;
    case 'quote':
      return 18;
    default:
      return 16;
  }
}

function resolveLineHeightPx(block: SlideBlock, fontSize: number): number {
  if (typeof block.lineHeight === 'number' && Number.isFinite(block.lineHeight)) {
    if (block.lineHeightUnit === 'px') {
      return Math.max(block.lineHeight, fontSize * 0.75);
    }
    const multiplier = block.lineHeightUnit === 'em' ? block.lineHeight : block.lineHeight;
    return Math.max(multiplier * fontSize, fontSize * 0.75);
  }
  return fontSize * 1.1;
}

function getTextBlockMinSizePct(
  block: SlideBlock,
  deviceSize: { width: number; height: number },
): { width: number; height: number } {
  const fontSize = resolveTextBlockFontSize(block);
  const lineHeight = resolveLineHeightPx(block, fontSize);
  if (block.kind === 'button') {
    const button = resolveButtonConfig(block);
    const paddingX = BUTTON_HORIZONTAL_PADDING[button.size] ?? BUTTON_HORIZONTAL_PADDING.Medium;
    const paddingY = BUTTON_VERTICAL_PADDING[button.size] ?? BUTTON_VERTICAL_PADDING.Medium;
    const minWidthPx = Math.max(fontSize + paddingX * 2, 48);
    const minHeightPx = Math.max(lineHeight + paddingY * 2, fontSize + paddingY * 2);
    return {
      width: clamp((minWidthPx / deviceSize.width) * 100, 1, 100),
      height: clamp((minHeightPx / deviceSize.height) * 100, 1, 100),
    };
  }

  const uniformPadding =
    typeof block.padding === 'number' && Number.isFinite(block.padding)
      ? Math.max(block.padding, 0)
      : 0;
  const minWidthPx = Math.max(fontSize + uniformPadding * 2, 32);
  const minHeightPx = Math.max(lineHeight + uniformPadding * 2, fontSize * 0.9 + uniformPadding * 2);
  return {
    width: clamp((minWidthPx / deviceSize.width) * 100, 1, 100),
    height: clamp((minHeightPx / deviceSize.height) * 100, 1, 100),
  };
}

function isAutoWidthEnabled(block: SlideBlock): boolean {
  if (!block || typeof block !== 'object') return true;
  const rawConfig = block.config && typeof block.config === 'object' ? (block.config as Record<string, any>) : undefined;
  if (!rawConfig) return true;
  const sizing =
    rawConfig.textSizing && typeof rawConfig.textSizing === 'object'
      ? (rawConfig.textSizing as Record<string, any>)
      : undefined;
  if (!sizing) return true;
  const value = sizing.autoWidth;
  return typeof value === 'boolean' ? value : true;
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

const parseVisibilityBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 0) return false;
    if (value === 1) return true;
    if (Number.isFinite(value)) return value > 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }
  return undefined;
};

const normalizeVisibilityConfig = (raw: any): BlockVisibilityConfig => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const resolve = (key: keyof BlockVisibilityConfig) => {
    const value = (source as Record<string, any>)[key];
    const parsed = parseVisibilityBoolean(value);
    return parsed === undefined ? DEFAULT_BLOCK_VISIBILITY[key] : parsed;
  };
  return {
    mobile: resolve('mobile'),
    tablet: resolve('tablet'),
    desktop: resolve('desktop'),
  };
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

  const useReviewSource =
    parseBoolean((raw as any).useReview) ??
    parseBoolean((block as any).useReview) ??
    DEFAULT_QUOTE_CONFIG.useReview;

  const reviewIdRaw =
    typeof raw.reviewId === 'string'
      ? raw.reviewId
      : typeof (block as any).reviewId === 'string'
        ? (block as any).reviewId
        : null;
  const reviewIdNormalized = reviewIdRaw && reviewIdRaw.trim().length > 0 ? reviewIdRaw.trim() : null;

  return {
    text: textSource,
    author: authorSource,
    style,
    bgColor: bgColorSource,
    bgOpacity: clamp(bgOpacitySource, 0, 1),
    radius: Math.max(0, radiusSource),
    padding: Math.max(0, paddingSource),
    align,
    useReview: Boolean(useReviewSource),
    reviewId: reviewIdNormalized,
  };
}

export function resolveBlockVisibility(block: SlideBlock): BlockVisibilityConfig {
  if (!block || typeof block !== 'object') {
    return { ...DEFAULT_BLOCK_VISIBILITY };
  }
  const rawConfig =
    block.config && typeof block.config === 'object'
      ? (block.config as Record<string, any>).visibleOn
      : undefined;
  return normalizeVisibilityConfig(rawConfig);
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

  const handleFrameChange = useCallback(
    (blockId: string, frame: Frame, options?: SlidesManagerChangeOptions) => {
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
            : b,
        ),
      };
      onChange(next, options);
    },
    [activeDevice, cfg, onChange],
  );

  const setBlockAutoWidth = useCallback(
    (blockId: string, nextValue: boolean) => {
      const target = cfg.blocks.find((b) => b.id === blockId);
      if (!target) return;
      const rawConfig =
        target.config && typeof target.config === 'object'
          ? (target.config as Record<string, any>)
          : undefined;
      const previousSizing =
        rawConfig && typeof rawConfig.textSizing === 'object'
          ? (rawConfig.textSizing as Record<string, any>)
          : undefined;
      const currentValue =
        previousSizing && typeof previousSizing.autoWidth === 'boolean'
          ? previousSizing.autoWidth
          : undefined;
      if (currentValue === nextValue) return;
      const baseConfig = rawConfig ? { ...rawConfig } : {};
      const nextSizing = { ...(previousSizing ?? {}) };
      nextSizing.autoWidth = nextValue;
      const nextConfig = { ...baseConfig, textSizing: nextSizing };
      const next: SlideCfg = {
        ...cfg,
        blocks: cfg.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                config: nextConfig,
              }
            : b,
        ),
      };
      onChange(next, { commit: false });
    },
    [cfg, onChange],
  );

  const handleInlineText = (blockId: string, text: string) => {
    const target = cfg.blocks.find((b) => b.id === blockId);
    const currentValue = target ? target.content ?? target.text ?? '' : '';
    if (currentValue === text) return;
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

  const renderEditableText = (
    block: SlideBlock,
    Tag: TextTag,
    style: CSSProperties,
  ) => {
    const content = block.content ?? block.text ?? '';
    return (
      <EditableTextContent
        tag={Tag}
        value={content}
        style={style}
        className="leading-tight"
        editable={Boolean(editable && editInPreview)}
        onCommit={(next) => handleInlineText(block.id, next)}
      />
    );
  };

  const renderBlockContent = (block: SlideBlock): ReactNode => {
    switch (block.kind) {
      case 'heading':
      case 'subheading':
      case 'text': {
        const Tag = block.kind === 'heading' ? 'h2' : block.kind === 'subheading' ? 'h3' : 'p';
        const align = block.align ?? 'left';
        const fallbackWeight = block.kind === 'heading' ? 700 : block.kind === 'subheading' ? 600 : 400;
        const fontFamilyKey = getBlockFontFamily(block);
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
        const textElement = renderEditableText(block, Tag, style);
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
        const fontFamilyKey = getBlockFontFamily(block);
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
        const fontFamilyKey = getBlockFontFamily(block);
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
        const showReviewRating = quote.useReview && Boolean(quote.reviewId);
        const ratingClasses = ['text-base', 'opacity-90'];
        ratingClasses.push(trimmedAuthor.length > 0 ? 'mt-1' : 'mt-3');
        const ratingStyle: CSSProperties = {};
        if (resolvedFontFamily) {
          ratingStyle.fontFamily = resolvedFontFamily;
        }
        return (
          <div style={wrapperStyle}>
            <div className={innerClasses.join(' ')} style={innerStyle}>
              <p className={textClasses.join(' ')} style={textStyle}>“{quote.text}”</p>
              {trimmedAuthor.length > 0 ? (
                <p className={authorClasses.join(' ')} style={authorStyle}>— {trimmedAuthor}</p>
              ) : null}
              {showReviewRating ? (
                <p className={ratingClasses.join(' ')} style={ratingStyle} aria-label="Five star review">
                  {'⭐️⭐️⭐️⭐️⭐️'}
                </p>
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
    <>
      <style jsx global>{BLOCK_INTERACTION_GLOBAL_STYLES}</style>
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
                const visibility = resolveBlockVisibility(block);
                if (!visibility[activeDevice]) {
                  return null;
                }
                const frame = ensureFrame(block, activeDevice);
                const locked = Boolean(block.locked);
                const textual = isTextualKind(block.kind);
                const minSizePct = textual ? getTextBlockMinSizePct(block, deviceSize) : undefined;
                const effectiveMinSize = minSizePct ?? { width: 5, height: 5 };
                const autoWidthEnabled = textual ? isAutoWidthEnabled(block) : false;
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
                    minWidthPct={textual ? effectiveMinSize.width : undefined}
                    minHeightPct={textual ? effectiveMinSize.height : undefined}
                    onResizeStart={
                      textual
                        ? ({ horizontal }) => {
                            if (horizontal && autoWidthEnabled) {
                              setBlockAutoWidth(block.id, false);
                            }
                          }
                        : undefined
                    }
                  >
                    <BlockChromeWithAutoSize
                      block={block}
                      blockId={block.id}
                      frame={frame}
                      deviceSize={deviceSize}
                      autoWidthEnabled={textual ? autoWidthEnabled : false}
                      minSizePct={effectiveMinSize}
                      onFrameChange={handleFrameChange}
                    >
                      {renderBlockContent(block)}
                    </BlockChromeWithAutoSize>
                  </InteractiveBox>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

type EditableTextContentProps = {
  tag: TextTag;
  value: string;
  style: CSSProperties;
  className?: string;
  editable: boolean;
  onCommit: (text: string) => void;
};

function EditableTextContent({
  tag,
  value,
  style,
  className,
  editable,
  onCommit,
}: EditableTextContentProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useLayoutEffect(() => {
    if (!elementRef.current) return;
    if (isEditing) return;
    const current = elementRef.current.textContent ?? '';
    if (current !== value) {
      elementRef.current.textContent = value;
    }
  }, [isEditing, value]);

  const commitIfChanged = (nextValue: string) => {
    if (nextValue === value) return;
    onCommit(nextValue);
  };

  const handleBlur = (event: React.FocusEvent<HTMLElement>) => {
    setIsEditing(false);
    const text = (event.currentTarget.innerText ?? '')
      .replace(/\u00A0/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    commitIfChanged(text);
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      (event.currentTarget as HTMLElement).blur();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection) return;
      selection.deleteFromDocument();
      if (selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const textNode = document.createTextNode('\n');
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLElement>) => {
    if (!editable) return;
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    const selection = window.getSelection();
    if (!selection) return;
    selection.deleteFromDocument();
    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const combinedClassName = ['whitespace-pre-wrap', 'focus:outline-none'];
  if (className) combinedClassName.push(className);

  const baseStyle: CSSProperties = {
    ...style,
    whiteSpace: 'pre-wrap',
  };

  const props: Record<string, any> = {
    ref: (node: HTMLElement | null) => {
      elementRef.current = node;
    },
    className: combinedClassName.join(' '),
    style: baseStyle,
  };

  if (editable) {
    props.contentEditable = true;
    props.suppressContentEditableWarning = true;
    props.spellCheck = true;
    props['aria-multiline'] = true;
    props.onBlur = handleBlur;
    props.onFocus = handleFocus;
    props.onKeyDown = handleKeyDown;
    props.onPaste = handlePaste;
  }

  props.children = editable ? (isEditing ? undefined : value) : value;

  return React.createElement(tag, props);
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
  minWidthPct?: number;
  minHeightPct?: number;
  onResizeStart?: (details: { horizontal: boolean; vertical: boolean }) => void;
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
  minWidthPct,
  minHeightPct,
  onResizeStart,
}: InteractiveBoxProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const pointerState = useRef<PointerState | null>(null);

  const getContainerRect = () => containerRef.current?.getBoundingClientRect();

  const handlePointerDown = (type: PointerState['type'], corner?: string) => (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect();
    if (locked) {
      return;
    }
    const rect = getContainerRect();
    if (!rect) return;
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
    if (type === 'resize' && !locked) {
      const horizontal = Boolean(corner && (corner.includes('e') || corner.includes('w')));
      const vertical = Boolean(corner && (corner.includes('n') || corner.includes('s')));
      onResizeStart?.({ horizontal, vertical });
    }
    pointerState.current = state;
    localRef.current?.setPointerCapture?.(e.pointerId);
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

    const minWidth = clamp(
      typeof minWidthPct === 'number' && Number.isFinite(minWidthPct) ? Math.max(minWidthPct, 0.5) : 5,
      0.5,
      100,
    );
    const minHeight = clamp(
      typeof minHeightPct === 'number' && Number.isFinite(minHeightPct) ? Math.max(minHeightPct, 0.5) : 5,
      0.5,
      100,
    );

    if (ps.type === 'move') {
      const next: Frame = {
        ...ps.startFrame,
        x: clamp(ps.startFrame.x + dx, 0, 100 - ps.startFrame.w),
        y: clamp(ps.startFrame.y + dy, 0, 100 - ps.startFrame.h),
      };
      onChange(next, { commit: false });
    } else if (ps.type === 'resize') {
      const next: Frame = { ...ps.startFrame };
      if (ps.corner?.includes('e')) {
        next.w = clamp(ps.startFrame.w + dx, minWidth, 100 - ps.startFrame.x);
      }
      if (ps.corner?.includes('s')) {
        next.h = clamp(ps.startFrame.h + dy, minHeight, 100 - ps.startFrame.y);
      }
      if (ps.corner?.includes('w')) {
        const newX = clamp(ps.startFrame.x + dx, 0, ps.startFrame.x + ps.startFrame.w - minWidth);
        const delta = ps.startFrame.x - newX;
        next.x = newX;
        next.w = clamp(ps.startFrame.w + delta, minWidth, 100 - newX);
      }
      if (ps.corner?.includes('n')) {
        const newY = clamp(ps.startFrame.y + dy, 0, ps.startFrame.y + ps.startFrame.h - minHeight);
        const delta = ps.startFrame.y - newY;
        next.y = newY;
        next.h = clamp(ps.startFrame.h + delta, minHeight, 100 - newY);
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
      {editable && selected && !locked && (
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

