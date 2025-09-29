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
import {
  DEFAULT_TEXT_FONT_FAMILY,
  FONT_FAMILY_SELECT_OPTIONS,
  resolveBlockFontFamily,
  getFontStackForFamily,
  useGoogleFontLoader,
  type SlideBlockFontFamily,
} from '@/lib/slideFonts';

const TEXTUAL_BLOCK_KIND_NAMES = new Set([
  'heading',
  'subheading',
  'text',
  'quote',
  'button',
] as const);

export const DEFAULT_TEXT_PLACEHOLDER = 'Edit me';

const DEFAULT_TEXT_SHADOW = {
  x: 0,
  y: 2,
  blur: 4,
  color: 'rgba(0, 0, 0, 0.3)',
};

const DEFAULT_BLOCK_BACKGROUND_COLOR = '#ffffff';
const DEFAULT_BLOCK_GRADIENT_FROM = 'rgba(15, 23, 42, 0.45)';
const DEFAULT_BLOCK_GRADIENT_TO = 'rgba(15, 23, 42, 0.05)';

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

const ALIGNMENT_TOLERANCE_PX = 8;

const GUIDE_PRIORITY: Record<AlignmentGuideType, number> = {
  'canvas-center': 0,
  'block-center': 1,
  'block-edge': 2,
};

type AlignmentGuideType = 'canvas-center' | 'block-center' | 'block-edge';

type AlignmentGuide = {
  orientation: 'vertical' | 'horizontal';
  position: number;
  type: AlignmentGuideType;
};

type AlignmentSnapMeta = {
  blockId: string;
  containerWidth: number;
  containerHeight: number;
};

type AlignmentSnapResult = {
  frame: Frame;
  guides: AlignmentGuide[];
};

const TEXT_SIZING_DEVICE_ORDER: DeviceKind[] = ['mobile', 'tablet', 'desktop'];

type TextSizingDimensions = { width?: number; height?: number };

export type TextSizingSnapshot = {
  autoWidth?: boolean;
  autoHeight?: boolean;
  width?: number;
  height?: number;
  devices?: Partial<Record<DeviceKind, TextSizingDimensions>>;
};

const asRecord = (value: unknown): Record<string, any> | undefined =>
  value && typeof value === 'object' ? (value as Record<string, any>) : undefined;

const clampPercentValue = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(0, value));
};

const cloneConfigRecord = (
  config: SlideBlock['config'] | Record<string, any> | undefined | null,
): Record<string, any> => {
  const record = asRecord(config);
  return record ? { ...record } : {};
};

export const readTextSizingConfig = (source: unknown): TextSizingSnapshot => {
  const root = asRecord(source);
  if (!root) return {};
  const sizingRoot = asRecord(root.textSizing) ?? root;
  const autoWidth = typeof sizingRoot.autoWidth === 'boolean' ? sizingRoot.autoWidth : undefined;
  const width = clampPercentValue(sizingRoot.width);
  const height = clampPercentValue(sizingRoot.height);
  const autoHeight = typeof sizingRoot.autoHeight === 'boolean' ? sizingRoot.autoHeight : undefined;
  const devicesRaw = asRecord(sizingRoot.devices);
  const devices: Partial<Record<DeviceKind, TextSizingDimensions>> = {};
  if (devicesRaw) {
    TEXT_SIZING_DEVICE_ORDER.forEach((device) => {
      const entry = asRecord(devicesRaw[device]);
      if (!entry) return;
      const deviceWidth = clampPercentValue(entry.width);
      const deviceHeight = clampPercentValue(entry.height);
      if (deviceWidth !== undefined || deviceHeight !== undefined) {
        devices[device] = {
          width: deviceWidth,
          height: deviceHeight,
        };
      }
    });
  }
  const snapshot: TextSizingSnapshot = {};
  if (autoWidth !== undefined) snapshot.autoWidth = autoWidth;
  if (typeof autoHeight === 'boolean') snapshot.autoHeight = autoHeight;
  if (width !== undefined) snapshot.width = width;
  if (height !== undefined) snapshot.height = height;
  if (Object.keys(devices).length > 0) snapshot.devices = devices;
  return snapshot;
};

export const pickTextSizingDimensions = (
  sizing: TextSizingSnapshot | undefined,
  device: DeviceKind,
): TextSizingDimensions | undefined => {
  if (!sizing) return undefined;
  const deviceEntry = sizing.devices?.[device];
  const width = deviceEntry?.width ?? sizing.width;
  const height = deviceEntry?.height ?? sizing.height;
  if (width === undefined && height === undefined) return undefined;
  return { width, height };
};

export const writeTextSizingToConfig = (
  config: SlideBlock['config'] | Record<string, any> | undefined,
  device: DeviceKind,
  frame: Frame,
): Record<string, any> => {
  const base = cloneConfigRecord(config);
  const existingSizing = asRecord(base.textSizing);
  const nextSizing: Record<string, any> = existingSizing ? { ...existingSizing } : {};
  const devicesRaw = asRecord(nextSizing.devices);
  const nextDevices: Record<string, any> = devicesRaw ? { ...devicesRaw } : {};
  const deviceSizing: Record<string, number> = {};
  const width = clampPercentValue(frame.w);
  const height = clampPercentValue(frame.h);
  if (width !== undefined) deviceSizing.width = width;
  if (height !== undefined) deviceSizing.height = height;
  nextDevices[device] = deviceSizing;
  nextSizing.devices = nextDevices;
  if (width !== undefined) nextSizing.width = width;
  if (height !== undefined) nextSizing.height = height;
  if (existingSizing) {
    if (typeof existingSizing.autoWidth === 'boolean') {
      nextSizing.autoWidth = existingSizing.autoWidth;
    }
    if (typeof (existingSizing as Record<string, any>).autoHeight === 'boolean') {
      nextSizing.autoHeight = (existingSizing as Record<string, any>).autoHeight;
    }
  }
  base.textSizing = nextSizing;
  return base;
};

export const updateConfigWithTextContent = (
  block: SlideBlock,
  text: string,
): SlideBlock['config'] | undefined => {
  if (!isTextualKind(block.kind)) return block.config;
  const base = cloneConfigRecord(block.config);
  if (block.kind === 'button') {
    base.label = text;
  } else {
    base.text = text;
    base.content = text;
  }
  const sizingSource = asRecord(base.textSizing);
  const nextSizing: Record<string, any> = sizingSource ? { ...sizingSource } : {};
  if (nextSizing.autoWidth !== true) {
    nextSizing.autoWidth = true;
  }
  if (nextSizing.autoHeight !== true) {
    nextSizing.autoHeight = true;
  }
  if (Object.keys(nextSizing).length > 0) {
    base.textSizing = nextSizing;
  }
  return Object.keys(base).length > 0 ? base : undefined;
};

const sanitizeEditableText = (raw: string): string => {
  const normalized = raw.replace(/\u00A0/g, ' ').replace(/\r\n?/g, '\n');
  const trimmed = normalized.trim();
  return trimmed.length === 0 ? DEFAULT_TEXT_PLACEHOLDER : normalized;
};

const resolveDisplayText = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length === 0 ? DEFAULT_TEXT_PLACEHOLDER : value;
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

.of-interactive-box {
  position: relative;
}

.of-interactive-box .block-pointer-target {
  -webkit-user-drag: none;
}

.of-interactive-box[data-block-dragging='true'] .block-pointer-target {
  pointer-events: none;
}
`;

const BLOCK_GRADIENT_DIRECTION_MAP: Record<BlockBackgroundGradientDirection, string> = {
  'to-top': 'to top',
  'to-bottom': 'to bottom',
  'to-left': 'to left',
  'to-right': 'to right',
};

const clampBackgroundOpacity = (value?: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 100;
  }
  if (value <= 1) {
    return Math.round(Math.min(1, Math.max(0, value)) * 100);
  }
  return Math.round(Math.min(100, Math.max(0, value)));
};

const clampBackgroundRadius = (value?: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, value);
};

type BlockBackgroundPresentation = {
  style: CSSProperties;
  radius: number;
};

const getBlockBackgroundPresentation = (
  background?: BlockBackground | null,
): BlockBackgroundPresentation | null => {
  if (!background || background.type === 'none') {
    return null;
  }

  const radius = clampBackgroundRadius(background.radius);
  const opacity = clampBackgroundOpacity(background.opacity) / 100;
  const overlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    borderRadius: radius,
    opacity,
    zIndex: -1,
  };

  if (background.type === 'color') {
    const color =
      typeof background.color === 'string' && background.color.trim().length > 0
        ? background.color
        : DEFAULT_BLOCK_BACKGROUND_COLOR;
    overlayStyle.backgroundColor = color;
    return { style: overlayStyle, radius };
  }

  if (background.type === 'gradient') {
    const from =
      typeof background.color === 'string' && background.color.trim().length > 0
        ? background.color
        : DEFAULT_BLOCK_GRADIENT_FROM;
    const to =
      typeof background.color2 === 'string' && background.color2.trim().length > 0
        ? background.color2
        : DEFAULT_BLOCK_GRADIENT_TO;
    const directionKey =
      background.direction && BLOCK_GRADIENT_DIRECTION_MAP[background.direction]
        ? background.direction
        : 'to-bottom';
    const direction = BLOCK_GRADIENT_DIRECTION_MAP[directionKey];
    overlayStyle.backgroundImage = `linear-gradient(${direction}, ${from}, ${to})`;
    return { style: overlayStyle, radius };
  }

  if (background.type === 'image') {
    const url = typeof background.url === 'string' && background.url.trim().length > 0 ? background.url : undefined;
    if (!url) {
      return null;
    }
    overlayStyle.backgroundImage = `url(${url})`;
    overlayStyle.backgroundSize = 'cover';
    overlayStyle.backgroundPosition = 'center';
    overlayStyle.backgroundRepeat = 'no-repeat';
    return { style: overlayStyle, radius };
  }

  return null;
};

function getBlockChromeStyle(
  block: SlideBlock,
  backgroundPresentation?: BlockBackgroundPresentation | null,
): CSSProperties {
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
  const backgroundRadius = backgroundPresentation ? backgroundPresentation.radius : undefined;
  const resolvedRadius =
    borderRadius !== undefined || backgroundRadius !== undefined
      ? Math.max(borderRadius ?? 0, backgroundRadius ?? 0)
      : undefined;

  if (resolvedRadius !== undefined && resolvedRadius > 0) {
    style.borderRadius = resolvedRadius;
  } else if (borderRadius !== undefined) {
    style.borderRadius = borderRadius;
  }

  return style;
}

type BlockChromeProps = { block: SlideBlock; children: ReactNode };

const BlockChrome = React.forwardRef<HTMLDivElement, BlockChromeProps>(({ block, children }, ref) => {
  const backgroundPresentation = getBlockBackgroundPresentation(block.background);
  const baseStyle = getBlockChromeStyle(block, backgroundPresentation);
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
      {backgroundPresentation && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={backgroundPresentation.style}
        />
      )}
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
  autoHeightEnabled: boolean;
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
  autoHeightEnabled,
  minSizePct,
  onFrameChange,
  children,
}: BlockChromeWithAutoSizeProps) => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(frame);
  const rafRef = useRef<number | null>(null);
  frameRef.current = frame;

  const scheduleMeasurement = useCallback(() => {
    if (!isTextualKind(block.kind)) return;
    const node = elementRef.current;
    if (!node) return;
    const container = node.parentElement as HTMLElement | null;
    if (!container) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const currentFrame = frameRef.current;
      const containerStyle = container.style;
      const nodeStyle = node.style;
      const previous = {
        containerWidth: containerStyle.width,
        containerHeight: containerStyle.height,
        containerMinWidth: containerStyle.minWidth,
        containerMinHeight: containerStyle.minHeight,
        nodeWidth: nodeStyle.width,
        nodeHeight: nodeStyle.height,
        nodeMaxWidth: nodeStyle.maxWidth,
        nodeMaxHeight: nodeStyle.maxHeight,
      };

      containerStyle.height = 'auto';
      containerStyle.minHeight = '0';
      nodeStyle.height = 'auto';
      nodeStyle.maxHeight = 'none';

      if (autoWidthEnabled) {
        containerStyle.width = 'auto';
        containerStyle.minWidth = '0';
        nodeStyle.width = 'max-content';
        nodeStyle.maxWidth = 'none';
      } else {
        const widthPx = Math.max(0, (currentFrame.w / 100) * deviceSize.width);
        containerStyle.width = `${widthPx}px`;
        containerStyle.minWidth = '0';
        nodeStyle.width = '100%';
        nodeStyle.maxWidth = '100%';
      }

      const measuredWidth = autoWidthEnabled ? node.scrollWidth : Math.max(container.offsetWidth, node.scrollWidth);
      const measuredHeight = node.scrollHeight;

      containerStyle.width = previous.containerWidth;
      containerStyle.height = previous.containerHeight;
      containerStyle.minWidth = previous.containerMinWidth;
      containerStyle.minHeight = previous.containerMinHeight;
      nodeStyle.width = previous.nodeWidth;
      nodeStyle.height = previous.nodeHeight;
      nodeStyle.maxWidth = previous.nodeMaxWidth;
      nodeStyle.maxHeight = previous.nodeMaxHeight;

      if (!Number.isFinite(measuredWidth) || !Number.isFinite(measuredHeight)) {
        return;
      }

      const widthPct = clamp((measuredWidth / deviceSize.width) * 100, 0, 100);
      const heightPct = clamp((measuredHeight / deviceSize.height) * 100, 0, 100);

      const nextFrame: Frame = { ...currentFrame };
      const targetWidth = autoWidthEnabled
        ? Math.max(widthPct, minSizePct.width)
        : clamp(Math.max(currentFrame.w, minSizePct.width), minSizePct.width, 100);
      const requiredHeight = Math.max(heightPct, minSizePct.height);
      const targetHeight = autoHeightEnabled
        ? requiredHeight
        : Math.max(requiredHeight, currentFrame.h);

      let changed = false;
      if (Math.abs(nextFrame.w - targetWidth) > 0.1) {
        nextFrame.w = targetWidth;
        changed = true;
      }
      if (Math.abs(nextFrame.h - targetHeight) > 0.1) {
        nextFrame.h = targetHeight;
        changed = true;
      }

      if (changed) {
        frameRef.current = nextFrame;
        onFrameChange(blockId, nextFrame, { commit: false });
      }
    });
  }, [autoHeightEnabled, autoWidthEnabled, block.kind, blockId, deviceSize.height, deviceSize.width, minSizePct.height, minSizePct.width, onFrameChange]);

  useLayoutEffect(() => {
    if (!isTextualKind(block.kind)) return;
    scheduleMeasurement();
  }, [block, frame, scheduleMeasurement]);

  useLayoutEffect(() => {
    if (!isTextualKind(block.kind)) return;
    const node = elementRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => scheduleMeasurement());
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [block.kind, scheduleMeasurement]);

  const wrapperClassName = ['block-wrapper'];
  if (isTextualKind(block.kind)) {
    wrapperClassName.push('inline-flex', 'max-w-full');
  } else {
    wrapperClassName.push('flex', 'h-full', 'w-full');
  }

  return (
    <BlockChrome ref={isTextualKind(block.kind) ? elementRef : undefined} block={block}>
      <div className={wrapperClassName.join(' ')}>{children}</div>
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

export type BlockAspectRatio = 'original' | 'square' | '4:3' | '16:9';

export type ImageBlockConfig = {
  url: string;
  fit: 'cover' | 'contain';
  focalX: number;
  focalY: number;
  radius: number;
  shadow: boolean;
  alt: string;
  aspectRatio: BlockAspectRatio;
};

export const DEFAULT_IMAGE_CONFIG: ImageBlockConfig = {
  url: '',
  fit: 'cover',
  focalX: 0.5,
  focalY: 0.5,
  radius: 0,
  shadow: false,
  alt: '',
  aspectRatio: 'original',
};

export type GalleryBlockItem = { url: string; alt?: string };

export type GalleryBlockConfig = {
  items: GalleryBlockItem[];
  layout: 'grid' | 'carousel';
  autoplay: boolean;
  interval: number;
  radius: number;
  shadow: boolean;
  aspectRatio: BlockAspectRatio;
};

export const DEFAULT_GALLERY_CONFIG: GalleryBlockConfig = {
  items: [],
  layout: 'grid',
  autoplay: false,
  interval: 3000,
  radius: 0,
  shadow: false,
  aspectRatio: 'original',
};

const ASPECT_RATIO_ALIASES: Record<string, BlockAspectRatio> = {
  original: 'original',
  auto: 'original',
  natural: 'original',
  none: 'original',
  square: 'square',
  '1:1': 'square',
  '1x1': 'square',
  '4:3': '4:3',
  '4x3': '4:3',
  '16:9': '16:9',
  '16x9': '16:9',
};

export function parseBlockAspectRatio(value: unknown): BlockAspectRatio | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return ASPECT_RATIO_ALIASES[normalized];
}

export function normalizeBlockAspectRatio(
  value: unknown,
  fallback: BlockAspectRatio,
): BlockAspectRatio {
  return parseBlockAspectRatio(value) ?? fallback;
}

export function getAspectRatioValue(aspectRatio: BlockAspectRatio): string | undefined {
  switch (aspectRatio) {
    case 'square':
      return '1 / 1';
    case '4:3':
      return '4 / 3';
    case '16:9':
      return '16 / 9';
    default:
      return undefined;
  }
}

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
  text: DEFAULT_TEXT_PLACEHOLDER,
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
  color2?: string;
  direction?: BlockBackgroundGradientDirection;
  url?: string;
  radius?: number;
  opacity?: number;
};

export type SlideBlock = {
  id: string;
  kind: 'heading' | 'subheading' | 'text' | 'button' | 'image' | 'quote' | 'gallery' | 'spacer';
  text?: string;
  content?: string;
  href?: string;
  src?: string;
  alt?: string;
  aspectRatio?: BlockAspectRatio;
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
  shadowX?: number;
  shadowY?: number;
  shadowBlur?: number;
  shadowColor?: string;
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
        { background?: BlockBackground } &
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
  onSelectBlock?: (id: string | null, options?: { openInspector?: boolean }) => void;
  openInspector?: () => void;
  onCanvasClick?: () => void;
  activeDevice?: DeviceKind;
  editInPreview?: boolean;
  scale?: number;
  onManipulationChange?: (manipulating: boolean) => void;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const getBlockFontFamily = (block: SlideBlock): SlideBlockFontFamily =>
  resolveBlockFontFamily(block);

const getResolvedFontStack = (
  family: SlideBlockFontFamily,
): string | undefined => getFontStackForFamily(family);

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

const resolveTextShadowStyle = (block: SlideBlock): string | undefined => {
  if (!block.textShadow) return undefined;
  const x =
    typeof block.textShadow.x === 'number'
      ? block.textShadow.x
      : typeof block.shadowX === 'number'
        ? block.shadowX
        : DEFAULT_TEXT_SHADOW.x;
  const y =
    typeof block.textShadow.y === 'number'
      ? block.textShadow.y
      : typeof block.shadowY === 'number'
        ? block.shadowY
        : DEFAULT_TEXT_SHADOW.y;
  const blur =
    typeof block.textShadow.blur === 'number'
      ? block.textShadow.blur
      : typeof block.shadowBlur === 'number'
        ? block.shadowBlur
        : DEFAULT_TEXT_SHADOW.blur;
  const color =
    typeof block.textShadow.color === 'string' && block.textShadow.color.trim().length > 0
      ? block.textShadow.color
      : typeof block.shadowColor === 'string' && block.shadowColor.trim().length > 0
        ? block.shadowColor
        : DEFAULT_TEXT_SHADOW.color;
  return `${x}px ${y}px ${blur}px ${color}`;
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
  const sizing = readTextSizingConfig(block.config);
  return typeof sizing.autoWidth === 'boolean' ? sizing.autoWidth : true;
}

function isAutoHeightEnabled(block: SlideBlock): boolean {
  if (!block || typeof block !== 'object') return true;
  const sizing = readTextSizingConfig(block.config);
  return typeof sizing.autoHeight === 'boolean' ? sizing.autoHeight : true;
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
  const aspectRatioSource =
    parseBlockAspectRatio(raw.aspectRatio) ??
    parseBlockAspectRatio((raw as any).ratio) ??
    parseBlockAspectRatio(block.aspectRatio);

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
    aspectRatio: aspectRatioSource ?? DEFAULT_IMAGE_CONFIG.aspectRatio,
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
  const aspectRatioSource =
    parseBlockAspectRatio(raw.aspectRatio) ??
    parseBlockAspectRatio((raw as any).ratio) ??
    parseBlockAspectRatio((block as any).aspectRatio);

  const intervalCandidate = intervalRaw && intervalRaw > 0 ? intervalRaw : undefined;
  const radiusCandidate = typeof radiusRaw === 'number' && radiusRaw >= 0 ? radiusRaw : undefined;

  return {
    items,
    layout,
    autoplay: layout === 'carousel' ? Boolean(autoplayRaw) : false,
    interval: intervalCandidate ? Math.round(intervalCandidate) : DEFAULT_GALLERY_CONFIG.interval,
    radius: radiusCandidate ?? DEFAULT_GALLERY_CONFIG.radius,
    shadow: Boolean(shadowRaw),
    aspectRatio: aspectRatioSource ?? DEFAULT_GALLERY_CONFIG.aspectRatio,
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
  const sizing = isTextualKind(block.kind) ? readTextSizingConfig(block.config) : undefined;
  const pickForDevice = (frame: Frame): Frame => {
    const sanitized: Frame = {
      x: clamp(typeof frame.x === 'number' ? frame.x : fallback.x, 0, 100),
      y: clamp(typeof frame.y === 'number' ? frame.y : fallback.y, 0, 100),
      w: clamp(typeof frame.w === 'number' ? frame.w : fallback.w, 0, 100),
      h: clamp(typeof frame.h === 'number' ? frame.h : fallback.h, 0, 100),
      r: typeof frame.r === 'number' && Number.isFinite(frame.r) ? frame.r : 0,
    };
    if (isTextualKind(block.kind) && sizing) {
      const dims = pickTextSizingDimensions(sizing, device);
      if (dims?.width !== undefined) {
        sanitized.w = clamp(dims.width, 0, 100);
      }
      if (dims?.height !== undefined) {
        sanitized.h = clamp(dims.height, 0, 100);
      }
    }
    return sanitized;
  };

  if (block.frames?.[device]) return pickForDevice(block.frames[device]!);
  const existing = Object.values(block.frames || {})[0];
  return existing ? pickForDevice(existing) : pickForDevice(fallback);
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

  const fontsInUse = useMemo(() => {
    const set = new Set<SlideBlockFontFamily>();
    (cfg.blocks ?? []).forEach((block) => {
      set.add(getBlockFontFamily(block));
    });
    return Array.from(set);
  }, [cfg]);

  useGoogleFontLoader(fontsInUse);

  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);

  const visibleBlockFrames = useMemo(
    () =>
      (cfg.blocks ?? [])
        .map((block) => {
          const visibility = resolveBlockVisibility(block);
          if (!visibility[activeDevice]) {
            return null;
          }
          return {
            id: block.id,
            frame: ensureFrame(block, activeDevice),
          };
        })
        .filter(Boolean) as { id: string; frame: Frame }[],
    [cfg, activeDevice],
  );

  const resolveDragSnap = useCallback(
    (frame: Frame, meta: AlignmentSnapMeta): AlignmentSnapResult | null => {
      const { blockId, containerWidth, containerHeight } = meta;
      if (containerWidth <= 0 || containerHeight <= 0) {
        return null;
      }

      const toleranceX = containerWidth ? (ALIGNMENT_TOLERANCE_PX / containerWidth) * 100 : 0;
      const toleranceY = containerHeight ? (ALIGNMENT_TOLERANCE_PX / containerHeight) * 100 : 0;

      const verticalGuides: AlignmentGuide[] = [
        { orientation: 'vertical', position: 50, type: 'canvas-center' },
      ];
      const horizontalGuides: AlignmentGuide[] = [
        { orientation: 'horizontal', position: 50, type: 'canvas-center' },
      ];

      visibleBlockFrames.forEach(({ id, frame: other }) => {
        if (id === blockId) {
          return;
        }
        verticalGuides.push(
          { orientation: 'vertical', position: other.x, type: 'block-edge' },
          { orientation: 'vertical', position: other.x + other.w, type: 'block-edge' },
          { orientation: 'vertical', position: other.x + other.w / 2, type: 'block-center' },
        );
        horizontalGuides.push(
          { orientation: 'horizontal', position: other.y, type: 'block-edge' },
          { orientation: 'horizontal', position: other.y + other.h, type: 'block-edge' },
          { orientation: 'horizontal', position: other.y + other.h / 2, type: 'block-center' },
        );
      });

      let snappedX = frame.x;
      let snappedY = frame.y;
      let verticalGuide: AlignmentGuide | null = null;
      let horizontalGuide: AlignmentGuide | null = null;
      let bestVerticalDelta = Number.POSITIVE_INFINITY;
      let bestVerticalPriority = Number.POSITIVE_INFINITY;
      let bestHorizontalDelta = Number.POSITIVE_INFINITY;
      let bestHorizontalPriority = Number.POSITIVE_INFINITY;
      const EPSILON = 0.0001;

      const tryVertical = (delta: number, value: number, guide: AlignmentGuide) => {
        if (delta > toleranceX) return;
        const priority = GUIDE_PRIORITY[guide.type];
        if (
          verticalGuide === null ||
          delta < bestVerticalDelta - EPSILON ||
          (Math.abs(delta - bestVerticalDelta) <= EPSILON && priority < bestVerticalPriority)
        ) {
          bestVerticalDelta = delta;
          bestVerticalPriority = priority;
          snappedX = clamp(value, 0, Math.max(0, 100 - frame.w));
          verticalGuide = guide;
        }
      };

      verticalGuides.forEach((guide) => {
        const leftDelta = Math.abs(frame.x - guide.position);
        tryVertical(leftDelta, guide.position, guide);
        const rightDelta = Math.abs(frame.x + frame.w - guide.position);
        tryVertical(rightDelta, guide.position - frame.w, guide);
        const centerDelta = Math.abs(frame.x + frame.w / 2 - guide.position);
        tryVertical(centerDelta, guide.position - frame.w / 2, guide);
      });

      const tryHorizontal = (delta: number, value: number, guide: AlignmentGuide) => {
        if (delta > toleranceY) return;
        const priority = GUIDE_PRIORITY[guide.type];
        if (
          horizontalGuide === null ||
          delta < bestHorizontalDelta - EPSILON ||
          (Math.abs(delta - bestHorizontalDelta) <= EPSILON && priority < bestHorizontalPriority)
        ) {
          bestHorizontalDelta = delta;
          bestHorizontalPriority = priority;
          snappedY = clamp(value, 0, Math.max(0, 100 - frame.h));
          horizontalGuide = guide;
        }
      };

      horizontalGuides.forEach((guide) => {
        const topDelta = Math.abs(frame.y - guide.position);
        tryHorizontal(topDelta, guide.position, guide);
        const bottomDelta = Math.abs(frame.y + frame.h - guide.position);
        tryHorizontal(bottomDelta, guide.position - frame.h, guide);
        const centerDelta = Math.abs(frame.y + frame.h / 2 - guide.position);
        tryHorizontal(centerDelta, guide.position - frame.h / 2, guide);
      });

      if (!verticalGuide && !horizontalGuide) {
        return null;
      }

      const guides: AlignmentGuide[] = [];
      if (verticalGuide) {
        guides.push({ ...verticalGuide });
      }
      if (horizontalGuide) {
        guides.push({ ...horizontalGuide });
      }

      return {
        frame: {
          ...frame,
          x: clamp(snappedX, 0, Math.max(0, 100 - frame.w)),
          y: clamp(snappedY, 0, Math.max(0, 100 - frame.h)),
        },
        guides,
      };
    },
    [visibleBlockFrames],
  );

  const handleGuidesChange = useCallback((guides: AlignmentGuide[]) => {
    setActiveGuides((prev) => {
      if (
        prev.length === guides.length &&
        prev.every((guide, index) => {
          const next = guides[index];
          return (
            next &&
            next.orientation === guide.orientation &&
            next.type === guide.type &&
            Math.abs(next.position - guide.position) < 0.001
          );
        })
      ) {
        return prev;
      }
      return guides;
    });
  }, []);

  useEffect(() => {
    if (!editable || !editInPreview) {
      setActiveGuides([]);
    }
  }, [editable, editInPreview]);

  useEffect(() => {
    if (!editable) return;
    const updates = cfg.blocks.filter((block) => {
      if (!isTextualKind(block.kind)) return false;
      const content = block.content ?? block.text ?? '';
      return content.trim().length === 0;
    });
    if (updates.length === 0) return;
    const next: SlideCfg = {
      ...cfg,
      blocks: cfg.blocks.map((block) => {
        if (!updates.some((candidate) => candidate.id === block.id)) return block;
        const fallbackText = DEFAULT_TEXT_PLACEHOLDER;
        return {
          ...block,
          text: fallbackText,
          content: fallbackText,
          config: updateConfigWithTextContent(block, fallbackText),
        };
      }),
    };
    onChange(next, { commit: false });
  }, [cfg, editable, onChange]);

  const handleFrameChange = useCallback(
    (blockId: string, frame: Frame, options?: SlidesManagerChangeOptions) => {
      const sanitized: Frame = {
        x: clamp(typeof frame.x === 'number' ? frame.x : 0, 0, 100),
        y: clamp(typeof frame.y === 'number' ? frame.y : 0, 0, 100),
        w: clamp(typeof frame.w === 'number' ? frame.w : 0, 0, 100),
        h: clamp(typeof frame.h === 'number' ? frame.h : 0, 0, 100),
        r: typeof frame.r === 'number' && Number.isFinite(frame.r) ? frame.r : 0,
      };
      const next: SlideCfg = {
        ...cfg,
        blocks: cfg.blocks.map((b) =>
          b.id === blockId
            ? {
                ...b,
                frames: {
                  ...b.frames,
                  [activeDevice]: sanitized,
                },
                config: isTextualKind(b.kind)
                  ? writeTextSizingToConfig(b.config, activeDevice, sanitized)
                  : b.config,
              }
            : b,
        ),
      };
      onChange(next, options);
    },
    [activeDevice, cfg, onChange],
  );

  const setBlockAutoSizingFlag = useCallback(
    (blockId: string, key: 'autoWidth' | 'autoHeight', nextValue: boolean) => {
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
        previousSizing && typeof previousSizing[key] === 'boolean'
          ? Boolean(previousSizing[key])
          : undefined;
      if (currentValue === nextValue) return;
      const baseConfig = rawConfig ? { ...rawConfig } : {};
      const nextSizing = { ...(previousSizing ?? {}) };
      nextSizing[key] = nextValue;
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

  const setBlockAutoWidth = useCallback(
    (blockId: string, nextValue: boolean) => setBlockAutoSizingFlag(blockId, 'autoWidth', nextValue),
    [setBlockAutoSizingFlag],
  );

  const setBlockAutoHeight = useCallback(
    (blockId: string, nextValue: boolean) => setBlockAutoSizingFlag(blockId, 'autoHeight', nextValue),
    [setBlockAutoSizingFlag],
  );

  const handleInlineText = (blockId: string, text: string) => {
    const normalizedText = sanitizeEditableText(text);
    const target = cfg.blocks.find((b) => b.id === blockId);
    const currentValue = target
      ? resolveDisplayText(target.content ?? target.text ?? '')
      : DEFAULT_TEXT_PLACEHOLDER;
    if (currentValue === normalizedText) return;
    const next: SlideCfg = {
      ...cfg,
      blocks: cfg.blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              text: normalizedText,
              content: normalizedText,
              config: updateConfigWithTextContent(b, normalizedText),
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

  const disableChildPointerEvents = Boolean(editable && editInPreview);

  const renderBlockContent = (block: SlideBlock): ReactNode => {
    switch (block.kind) {
      case 'heading':
      case 'subheading':
      case 'text': {
        const Tag = block.kind === 'heading' ? 'h2' : block.kind === 'subheading' ? 'h3' : 'p';
        const align = block.align ?? 'left';
        const fallbackWeight = block.kind === 'heading' ? 700 : block.kind === 'subheading' ? 600 : 400;
        const fontFamilyKey = getBlockFontFamily(block);
        const resolvedFontFamily = getResolvedFontStack(fontFamilyKey);
        const fontSizePx =
          typeof block.fontSize === 'number'
            ? block.fontSize
            : block.size
              ? SIZE_TO_FONT_SIZE[block.size]
              : undefined;
        const lineHeightValue = resolveLineHeightValue(block.lineHeight, block.lineHeightUnit);
        const letterSpacingValue =
          typeof block.letterSpacing === 'number' ? `${block.letterSpacing}px` : undefined;
        const textShadowValue = resolveTextShadowStyle(block);
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
        const resolvedFontFamily = getResolvedFontStack(fontFamilyKey);
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
        const aspectRatioValue = getAspectRatioValue(image.aspectRatio);
        const wrapperClasses = ['flex', 'h-full', 'w-full', 'items-center', 'justify-center', 'overflow-hidden'];
        if (image.shadow) wrapperClasses.push('shadow-lg');
        const wrapperStyle: CSSProperties = {
          borderRadius: image.radius,
        };
        if (aspectRatioValue) {
          wrapperStyle.aspectRatio = aspectRatioValue;
          wrapperStyle.height = 'auto';
        }
        if (!imageUrl) {
          return (
            <div
              className={[...wrapperClasses, 'bg-neutral-200'].join(' ')}
              style={wrapperStyle}
            />
          );
        }
        const imageStyle: CSSProperties = {
          objectFit: image.fit,
          objectPosition: `${image.focalX * 100}% ${image.focalY * 100}%`,
          borderRadius: image.radius,
          width: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
        };
        if (aspectRatioValue) {
          imageStyle.aspectRatio = aspectRatioValue;
          imageStyle.height = 'auto';
        } else {
          imageStyle.height = '100%';
        }
        const imageClassNames = ['block-pointer-target', 'select-none'];
        const preventDrag = (event: React.DragEvent<HTMLImageElement>) => {
          event.preventDefault();
        };

        return (
          <div className={wrapperClasses.join(' ')} style={wrapperStyle}>
            <img
              src={imageUrl}
              alt={image.alt || ''}
              style={imageStyle}
              className={imageClassNames.join(' ')}
              draggable={false}
              onDragStart={preventDrag}
            />
          </div>
        );
      }
      case 'quote': {
        const quote = resolveQuoteConfig(block);
        const defaultTextColor = quote.style === 'plain' ? '#ffffff' : '#111111';
        const textColor = block.textColor ?? block.color ?? defaultTextColor;
        const fontFamilyKey = getBlockFontFamily(block);
        const resolvedFontFamily = getResolvedFontStack(fontFamilyKey);
        const fallbackWeight = block.fontWeight ?? (quote.style === 'emphasis' ? 600 : 400);
        const fontSizePx =
          typeof block.fontSize === 'number'
            ? block.fontSize
            : quote.style === 'emphasis'
              ? 24
              : 16;
        const lineHeightValue = resolveLineHeightValue(block.lineHeight, block.lineHeightUnit);
        const textShadowValue = resolveTextShadowStyle(block);
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
        if (textShadowValue) {
          textStyle.textShadow = textShadowValue;
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
        if (textShadowValue) {
          authorStyle.textShadow = textShadowValue;
        }
        const trimmedAuthor = quote.author.trim();
        const showReviewRating = quote.useReview && Boolean(quote.reviewId);
        const ratingClasses = ['text-base', 'opacity-90'];
        ratingClasses.push(trimmedAuthor.length > 0 ? 'mt-1' : 'mt-3');
        const ratingStyle: CSSProperties = {};
        if (resolvedFontFamily) {
          ratingStyle.fontFamily = resolvedFontFamily;
        }
        if (textShadowValue) {
          ratingStyle.textShadow = textShadowValue;
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
        return <GalleryBlockPreview block={block} disablePointerGuards={disableChildPointerEvents} />;
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
              {activeGuides.length > 0 ? (
                <div className="pointer-events-none absolute inset-0" style={{ zIndex: 30 }}>
                  {activeGuides.map((guide, index) => {
                    const color = guide.type === 'canvas-center' ? '#64748b' : '#38bdf8';
                    const key = `guide-${guide.orientation}-${guide.type}-${index}`;
                    if (guide.orientation === 'vertical') {
                      return (
                        <div
                          key={key}
                          className="absolute"
                          style={{
                            left: `${guide.position}%`,
                            top: 0,
                            bottom: 0,
                            width: '1px',
                            transform: 'translateX(-0.5px)',
                            backgroundColor: color,
                          }}
                        />
                      );
                    }
                    return (
                      <div
                        key={key}
                        className="absolute"
                        style={{
                          top: `${guide.position}%`,
                          left: 0,
                          right: 0,
                          height: '1px',
                          transform: 'translateY(-0.5px)',
                          backgroundColor: color,
                        }}
                      />
                    );
                  })}
                </div>
              ) : null}
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
                const autoHeightEnabled = textual ? isAutoHeightEnabled(block) : false;
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
                    }}
                    onDoubleActivate={() => {
                      onSelectBlock?.(block.id, { openInspector: true });
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
                        ? ({ horizontal, vertical }) => {
                            if (horizontal && autoWidthEnabled) {
                              setBlockAutoWidth(block.id, false);
                            }
                            if (vertical && autoHeightEnabled) {
                              setBlockAutoHeight(block.id, false);
                            }
                          }
                        : undefined
                    }
                    resolveDragSnap={resolveDragSnap}
                    onDragGuidesChange={handleGuidesChange}
                  >
                    <BlockChromeWithAutoSize
                      block={block}
                      blockId={block.id}
                      frame={frame}
                      deviceSize={deviceSize}
                      autoWidthEnabled={textual ? autoWidthEnabled : false}
                      autoHeightEnabled={textual ? autoHeightEnabled : false}
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
  const displayValue = resolveDisplayText(value);

  useLayoutEffect(() => {
    const node = elementRef.current;
    if (!node) return;
    const current = node.textContent ?? '';
    if (isEditing) {
      if (current.length === 0 && displayValue.length > 0) {
        node.textContent = displayValue;
      }
      return;
    }
    if (current !== displayValue) {
      node.textContent = displayValue;
    }
  }, [displayValue, isEditing]);

  const commitIfChanged = (nextValue: string) => {
    const sanitized = sanitizeEditableText(nextValue);
    if (sanitized === resolveDisplayText(value)) return;
    onCommit(sanitized);
  };

  const handleBlur = (event: React.FocusEvent<HTMLElement>) => {
    setIsEditing(false);
    commitIfChanged(event.currentTarget.innerText ?? '');
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
      if (event.shiftKey) {
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
        return;
      }
      event.preventDefault();
      commitIfChanged(event.currentTarget.innerText ?? '');
      (event.currentTarget as HTMLElement).blur();
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

  props.children = editable ? (isEditing ? undefined : displayValue) : displayValue;

  return React.createElement(tag, props);
}

function GalleryBlockPreview({
  block,
  disablePointerGuards,
}: {
  block: SlideBlock;
  disablePointerGuards?: boolean;
}) {
  const config = useMemo(() => resolveGalleryConfig(block), [block]);
  const items = config.items;
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const aspectRatioValue = getAspectRatioValue(config.aspectRatio);
  const handleImageDragStart = useCallback((event: React.DragEvent<HTMLImageElement>) => {
    event.preventDefault();
  }, []);

  const pointerGuardProps: React.ImgHTMLAttributes<HTMLImageElement> = disablePointerGuards
    ? {
        className: 'block-pointer-target select-none',
        draggable: false,
        onDragStart: handleImageDragStart,
      }
    : {};

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
              className="flex h-full w-full flex-none snap-center items-center justify-center"
              style={{ minWidth: '100%' }}
            >
              <div
                className="flex h-full w-full items-center justify-center overflow-hidden"
                style={
                  aspectRatioValue
                    ? { aspectRatio: aspectRatioValue, height: 'auto', width: '100%' }
                    : undefined
                }
              >
                <img
                  src={item.url}
                  alt={item.alt || ''}
                  style={{
                    objectFit: 'cover',
                    width: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    height: aspectRatioValue ? 'auto' : '100%',
                    aspectRatio: aspectRatioValue,
                  }}
                  {...pointerGuardProps}
                />
              </div>
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
          gridAutoRows: aspectRatioValue ? 'auto' : '1fr',
        }}
      >
        {items.map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className="relative flex h-full w-full items-center justify-center overflow-hidden"
            style={
              aspectRatioValue
                ? { aspectRatio: aspectRatioValue, height: 'auto', width: '100%' }
                : undefined
            }
          >
            <img
              src={item.url}
              alt={item.alt || ''}
              style={{
                objectFit: 'cover',
                width: '100%',
                maxWidth: '100%',
                maxHeight: '100%',
                height: aspectRatioValue ? 'auto' : '100%',
                aspectRatio: aspectRatioValue,
              }}
              {...pointerGuardProps}
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
  onDoubleActivate?: () => void;
  onChange: (frame: Frame, options?: SlidesManagerChangeOptions) => void;
  children: ReactNode;
  scale: number;
  locked?: boolean;
  onManipulationChange?: (manipulating: boolean) => void;
  minWidthPct?: number;
  minHeightPct?: number;
  onResizeStart?: (details: { horizontal: boolean; vertical: boolean }) => void;
  resolveDragSnap?: (frame: Frame, meta: AlignmentSnapMeta) => AlignmentSnapResult | null;
  onDragGuidesChange?: (guides: AlignmentGuide[]) => void;
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
  id,
  frame,
  containerRef,
  selected,
  editable,
  onSelect,
  onTap,
  onDoubleActivate,
  onChange,
  children,
  scale,
  locked = false,
  onManipulationChange,
  minWidthPct,
  minHeightPct,
  onResizeStart,
  resolveDragSnap,
  onDragGuidesChange,
}: InteractiveBoxProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const pointerState = useRef<PointerState | null>(null);
  const [dragging, setDragging] = useState(false);

  const getContainerRect = () => containerRef.current?.getBoundingClientRect();

  const handlePointerDown = (type: PointerState['type'], corner?: string) => (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect();
    if (locked) {
      onDragGuidesChange?.([]);
      return;
    }
    const rect = getContainerRect();
    if (!rect) return;
    onDragGuidesChange?.([]);
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
    if (type !== 'move') {
      setDragging(false);
    }
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
    if (ps.locked) {
      onDragGuidesChange?.([]);
      return;
    }
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
      if (ps.type === 'move') {
        setDragging(true);
      }
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
      let next: Frame = {
        ...ps.startFrame,
        x: clamp(ps.startFrame.x + dx, 0, 100 - ps.startFrame.w),
        y: clamp(ps.startFrame.y + dy, 0, 100 - ps.startFrame.h),
      };
      if (resolveDragSnap) {
        const snap = resolveDragSnap(next, {
          blockId: id,
          containerWidth: width,
          containerHeight: height,
        });
        if (snap) {
          next = snap.frame;
          onDragGuidesChange?.(snap.guides);
        } else {
          onDragGuidesChange?.([]);
        }
      } else {
        onDragGuidesChange?.([]);
      }
      onChange(next, { commit: false });
    } else if (ps.type === 'resize') {
      onDragGuidesChange?.([]);
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
      onDragGuidesChange?.([]);
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
    onDragGuidesChange?.([]);
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
    setDragging(false);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!editable) return;
    const ps = pointerState.current;
    if (!ps) return;
    pointerState.current = null;
    localRef.current?.releasePointerCapture?.(e.pointerId);
    onDragGuidesChange?.([]);
    if (ps.hasManipulated) {
      onManipulationChange?.(false);
    }
    setDragging(false);
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
      className="of-interactive-box"
      data-block-dragging={dragging ? 'true' : 'false'}
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
      onDoubleClick={(e) => {
        if (!editable) return;
        e.stopPropagation();
        onSelect();
        onDoubleActivate?.();
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

