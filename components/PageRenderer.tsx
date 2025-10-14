import React, { useEffect, useState } from 'react';

import { getFontStackFromId } from '@/lib/fonts';
import { tokens } from '@/src/ui/tokens';

export type DeviceKind = 'mobile' | 'tablet' | 'desktop';

export type TextTypographySettings = {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  opacity?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  uppercase?: boolean;
};

export type TextBackgroundSettings = {
  mode?: 'none' | 'color' | 'gradient' | 'image';
  color?: string;
  gradient?: {
    angle?: number;
    start?: string;
    end?: string;
  } | null;
  imageUrl?: string | null;
  imageFit?: 'cover' | 'contain';
  imagePosition?: 'left' | 'center' | 'right';
  focalX?: number;
  focalY?: number;
  imageOpacity?: number;
  blur?: number;
};

export type TextSpacingSettings = {
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
};

export type TextOverlaySettings = {
  color?: string;
  opacity?: number;
};

export type TextAnimationType =
  | 'none'
  | 'fade-in'
  | 'slide-in-left'
  | 'slide-in-right'
  | 'slide-in-up'
  | 'slide-in-down'
  | 'zoom-in';

export type TextAnimationSettings = {
  enabled?: boolean;
  type?: TextAnimationType;
  duration?: number;
  delay?: number;
};

export type TextBlock = {
  id: string;
  type: 'text';
  text: string;
  align?: 'left' | 'center' | 'right';
  typography?: TextTypographySettings;
  background?: TextBackgroundSettings;
  spacing?: TextSpacingSettings;
  overlay?: TextOverlaySettings;
  animation?: TextAnimationSettings;
};

export type ImageBlock = {
  id: string;
  type: 'image';
  src: string;
  alt?: string;
  width?: number;
  radius?: 'none' | 'lg' | '2xl';
};

export type ButtonBlock = {
  id: string;
  type: 'button';
  label: string;
  href?: string;
  target?: '_self' | '_blank';
  style?: 'primary' | 'outline';
  align?: 'left' | 'center' | 'right';
};

export type DividerBlock = { id: string; type: 'divider' };

export type SpacerBlock = { id: string; type: 'spacer'; height?: number };

export type TwoColumnColumn = {
  text?: TextBlock;
  image?: ImageBlock | null;
  wrapTextAroundImage?: boolean;
  imageAlignment?: 'left' | 'right' | 'top' | 'bottom';
  imageSpacing?: number;
};

export type TwoColumnBlock = {
  id: string;
  type: 'two-col';
  left: TwoColumnColumn;
  right: TwoColumnColumn;
  ratio?: '1-1' | '1-2' | '2-1';
  gap?: number;
  padding?: number;
};

export type HeaderBlock = {
  id: string;
  type: 'header';
  title: string;
  subtitle?: string;
  tagline?: string;
  backgroundImageUrl?: string | null;
  backgroundImageFit?: 'cover' | 'contain';
  backgroundImagePosition?: 'left' | 'center' | 'right';
  backgroundMode?: 'image' | 'color' | 'gradient';
  backgroundColor?: string;
  backgroundGradient?: {
    angle?: number;
    start?: string;
    end?: string;
  } | null;
  overlayEnabled?: boolean;
  overlayColor?: string;
  overlayOpacity?: number;
  overlayBrightness?: number;
  overlayContrast?: number;
  overlaySaturation?: number;
  fontFamily?: string;
  fontWeight?: number;
  titleFontSize?: number;
  titleLineHeight?: number;
  titleLetterSpacing?: number;
  titleColor?: string;
  subtitleColor?: string;
  taglineColor?: string;
  align?: 'left' | 'center' | 'right';
  paddingTop?: number;
  paddingBottom?: number;
  marginTop?: number;
  marginBottom?: number;
  fullWidth?: boolean;
  headerHeight?: number;
};

export type Block =
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | TwoColumnBlock
  | HeaderBlock;

type PageRendererProps = {
  blocks: Block[];
  device?: DeviceKind;
};

function useResponsiveDevice(override?: DeviceKind): DeviceKind {
  const [device, setDevice] = useState<DeviceKind>(override ?? 'desktop');

  useEffect(() => {
    if (override) {
      setDevice(override);
      return;
    }

    const resolveDevice = () => {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      if (width < 640) {
        setDevice('mobile');
      } else if (width < 1024) {
        setDevice('tablet');
      } else {
        setDevice('desktop');
      }
    };

    resolveDevice();
    window.addEventListener('resize', resolveDevice);
    return () => {
      window.removeEventListener('resize', resolveDevice);
    };
  }, [override]);

  return override ?? device;
}

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const scaleForDevice: Record<DeviceKind, number> = {
  mobile: 0.65,
  tablet: 0.85,
  desktop: 1,
};

const paddingScale: Record<DeviceKind, number> = {
  mobile: 0.6,
  tablet: 0.85,
  desktop: 1,
};

const alignToFlex: Record<'left' | 'center' | 'right', 'flex-start' | 'center' | 'flex-end'> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

const TEXT_ANIMATION_DEFINITIONS: Record<Exclude<TextAnimationType, 'none'>, { name: string; timingFunction: string }> = {
  'fade-in': { name: 'of-fade-in', timingFunction: 'ease-out' },
  'slide-in-left': { name: 'of-slide-in-left', timingFunction: 'ease-out' },
  'slide-in-right': { name: 'of-slide-in-right', timingFunction: 'ease-out' },
  'slide-in-up': { name: 'of-slide-in-up', timingFunction: 'ease-out' },
  'slide-in-down': { name: 'of-slide-in-down', timingFunction: 'ease-out' },
  'zoom-in': { name: 'of-zoom-in', timingFunction: 'ease-out' },
};

const TEXT_ANIMATION_GLOBAL_STYLES = `
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
`;

const hexToRgba = (value: string, alpha: number) => {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
  if (normalized.startsWith('rgba')) {
    return normalized;
  }
  if (normalized.startsWith('rgb(')) {
    const channels = normalized
      .slice(4, -1)
      .split(',')
      .map((channel) => Number.parseInt(channel.trim(), 10));
    if (channels.length === 3 && channels.every((channel) => Number.isFinite(channel))) {
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
    }
  }
  const raw = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  if (raw.length === 3) {
    const r = Number.parseInt(raw[0]! + raw[0]!, 16);
    const g = Number.parseInt(raw[1]! + raw[1]!, 16);
    const b = Number.parseInt(raw[2]! + raw[2]!, 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const match = raw.match(/^[0-9a-fA-F]{6}/);
  if (!match) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
  const r = Number.parseInt(match[0]!.slice(0, 2), 16);
  const g = Number.parseInt(match[0]!.slice(2, 4), 16);
  const b = Number.parseInt(match[0]!.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const DEFAULT_TITLE_FONT_SIZE = 48;
const DEFAULT_TITLE_LINE_HEIGHT = 1.1;
const DEFAULT_PADDING = tokens.spacing.xl * 4;
const MIN_HEADER_PADDING = tokens.spacing.lg * 2;
const MAX_HEADER_PADDING = tokens.spacing.xl * 10;
const MIN_HEADER_HEIGHT = tokens.spacing.xl * 6;
const HEADER_HORIZONTAL_PADDING_DESKTOP = Math.round(tokens.spacing.xl * 1.5);
const HEADER_HORIZONTAL_PADDING_TABLET = Math.round(tokens.spacing.xl * 1.25);
const HEADER_HORIZONTAL_PADDING_MOBILE = tokens.spacing.xl;

export default function PageRenderer({ blocks, device }: PageRendererProps) {
  const currentDevice = useResponsiveDevice(device);

  const renderHeaderBlock = (block: HeaderBlock) => {
    const scale = scaleForDevice[currentDevice];
    const paddingMultiplier = paddingScale[currentDevice];
    const rawPaddingTop = clampNumber(
      block.paddingTop ?? DEFAULT_PADDING,
      MIN_HEADER_PADDING,
      MAX_HEADER_PADDING,
    );
    const rawPaddingBottom = clampNumber(
      block.paddingBottom ?? DEFAULT_PADDING,
      MIN_HEADER_PADDING,
      MAX_HEADER_PADDING,
    );
    const paddingTop = Math.round(rawPaddingTop * paddingMultiplier);
    const paddingBottom = Math.round(rawPaddingBottom * paddingMultiplier);
    const titleSize = Math.round(
      clampNumber(block.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE, 24, 120) * scale,
    );
    const lineHeight = block.titleLineHeight ?? DEFAULT_TITLE_LINE_HEIGHT;
    const letterSpacing = block.titleLetterSpacing ?? -1;
    const fontWeight = block.fontWeight ?? 700;
    const fontFamily = getFontStackFromId(block.fontFamily) ?? tokens.fonts.sans;
    const align = block.align ?? 'center';
    const alignItems = alignToFlex[align];
    const textAlign = align;
    const subtitle = block.subtitle?.trim();
    const tagline = block.tagline?.trim();
    const subtitleSize = Math.max(Math.round(titleSize * 0.45), tokens.fontSize.md);
    const taglineSize = Math.max(Math.round(titleSize * 0.28), tokens.fontSize.sm);
    const titleColor = block.titleColor ?? '#ffffff';
    const subtitleColor = block.subtitleColor ?? 'rgba(255, 255, 255, 0.9)';
    const taglineColor = block.taglineColor ?? 'rgba(255, 255, 255, 0.75)';
    const overlayOpacity = clampNumber(block.overlayOpacity ?? 60, 0, 100) / 100;
    const overlayEnabled = block.overlayEnabled ?? false;
    const hasBackgroundImage = Boolean(block.backgroundImageUrl);
    const backgroundMode = block.backgroundMode ?? (hasBackgroundImage ? 'image' : 'color');
    const showBackgroundImage = backgroundMode === 'image' && hasBackgroundImage;
    const backgroundColor = block.backgroundColor ?? tokens.colors.surfaceInverse;
    const gradientAngle = block.backgroundGradient?.angle ?? 180;
    const gradientStart = block.backgroundGradient?.start ?? backgroundColor;
    const gradientEnd = block.backgroundGradient?.end ?? tokens.colors.surface;
    const resolvedBackgroundFill =
      backgroundMode === 'gradient'
        ? `linear-gradient(${gradientAngle}deg, ${gradientStart}, ${gradientEnd})`
        : backgroundMode === 'color'
        ? backgroundColor
        : tokens.colors.surfaceInverse;
    const overlayLayerBackground =
      showBackgroundImage && overlayEnabled
        ? hexToRgba(block.overlayColor ?? '#0f172a', overlayOpacity)
        : 'transparent';
    const backgroundSize = block.backgroundImageFit ?? 'cover';
    const backgroundPosition = `${block.backgroundImagePosition ?? 'center'} center`;
    const overlayBrightness = clampNumber(block.overlayBrightness ?? 100, 0, 200) / 100;
    const overlayContrast = clampNumber(block.overlayContrast ?? 100, 0, 200) / 100;
    const overlaySaturation = clampNumber(block.overlaySaturation ?? 100, 0, 200) / 100;
    const imageFilter = `brightness(${overlayBrightness}) contrast(${overlayContrast}) saturate(${overlaySaturation})`;
    const horizontalPadding =
      currentDevice === 'desktop'
        ? HEADER_HORIZONTAL_PADDING_DESKTOP
        : currentDevice === 'tablet'
        ? HEADER_HORIZONTAL_PADDING_TABLET
        : HEADER_HORIZONTAL_PADDING_MOBILE;
    const textGap = Math.max(tokens.spacing.sm, Math.round(tokens.spacing.md * scale));
    const minHeight = Math.max(paddingTop + paddingBottom, MIN_HEADER_HEIGHT);
    const headerHeight = clampNumber(block.headerHeight ?? 80, 40, 100);
    const headerHeightValue = `${headerHeight}vh`;

    const textColumn = (
      <div
        style={{
          width: '100%',
          maxWidth: block.fullWidth ? '100%' : 960,
          margin: block.fullWidth ? 0 : '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems,
          textAlign,
          gap: textGap,
        }}
      >
        {tagline ? (
          <p
            style={{
              margin: 0,
              fontSize: taglineSize,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: taglineColor,
              fontWeight: 600,
              fontFamily,
            }}
          >
            {tagline}
          </p>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontSize: titleSize,
            lineHeight,
            letterSpacing,
            fontWeight,
            fontFamily,
            color: titleColor,
          }}
        >
          {block.title}
        </h1>
        {subtitle ? (
          <p
            style={{
              margin: 0,
              maxWidth: block.fullWidth ? '100%' : 720,
              fontSize: subtitleSize,
              lineHeight: 1.5,
              color: subtitleColor,
              fontFamily,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    );

    return (
      <section
        key={block.id}
        style={{
          position: 'relative',
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
          background: showBackgroundImage ? tokens.colors.surfaceInverse : resolvedBackgroundFill,
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          marginTop: block.marginTop ?? 0,
          marginBottom: block.marginBottom ?? 0,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            minHeight,
            height: headerHeightValue,
            background: showBackgroundImage ? 'transparent' : resolvedBackgroundFill,
          }}
        >
          {showBackgroundImage ? (
            <img
              src={block.backgroundImageUrl ?? ''}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: backgroundSize,
                objectPosition: backgroundPosition,
                pointerEvents: 'none',
                filter: imageFilter,
              }}
            />
          ) : null}
          <div
            style={{
              position: 'relative',
              inset: 'auto',
              width: '100%',
              paddingTop,
              paddingBottom,
              paddingLeft: horizontalPadding,
              paddingRight: horizontalPadding,
              boxSizing: 'border-box',
              display: 'flex',
              justifyContent: 'center',
              background: overlayLayerBackground,
            }}
          >
            {textColumn}
          </div>
        </div>
      </section>
    );
  };

  const resolveImageRadius = (radius?: ImageBlock['radius']) => {
    if (radius === '2xl') return 24;
    if (radius === 'lg') return tokens.radius.lg;
    return tokens.radius.none;
  };

  const renderTextBlock = (block: TextBlock) => {
    const typography = block.typography ?? {};
    const spacing = block.spacing ?? {};
    const background = block.background ?? {};
    const overlay = block.overlay ?? {};
    const animation = block.animation ?? {};
    const align = block.align ?? 'left';

    const fontFamily = getFontStackFromId(typography.fontFamily) ?? tokens.fonts.sans;
    const baseFontWeight =
      typeof typography.fontWeight === 'number' && Number.isFinite(typography.fontWeight)
        ? typography.fontWeight
        : tokens.fontWeight.regular;
    const fontWeight = typography.bold ? Math.max(baseFontWeight, tokens.fontWeight.semibold) : baseFontWeight;
    const fontSize =
      typeof typography.fontSize === 'number' && Number.isFinite(typography.fontSize)
        ? typography.fontSize
        : tokens.fontSize.md;
    const lineHeight =
      typeof typography.lineHeight === 'number' && Number.isFinite(typography.lineHeight)
        ? typography.lineHeight
        : tokens.lineHeight.normal;
    const letterSpacing =
      typeof typography.letterSpacing === 'number' && Number.isFinite(typography.letterSpacing)
        ? typography.letterSpacing
        : 0;
    const textColor = typography.color ?? tokens.colors.textSecondary;
    const textOpacity = clampNumber(typography.opacity ?? 100, 0, 100) / 100;
    const resolvedTextColor = hexToRgba(textColor, textOpacity);

    const marginTop = spacing.marginTop ?? 0;
    const marginRight = spacing.marginRight ?? 0;
    const marginBottom = spacing.marginBottom ?? tokens.spacing.md;
    const marginLeft = spacing.marginLeft ?? 0;
    const paddingTop = spacing.paddingTop ?? 0;
    const paddingRight = spacing.paddingRight ?? 0;
    const paddingBottom = spacing.paddingBottom ?? 0;
    const paddingLeft = spacing.paddingLeft ?? 0;

    const backgroundMode = background.mode ?? 'none';
    const gradientSettings = background.gradient ?? {
      angle: 180,
      start: tokens.colors.surfaceInverse,
      end: tokens.colors.surface,
    };
    const hasBackgroundImage = backgroundMode === 'image' && Boolean(background.imageUrl);
    const shouldShowOverlay =
      (backgroundMode === 'gradient' || backgroundMode === 'image') &&
      (overlay.opacity !== undefined || overlay.color !== undefined);
    const overlayOpacity = clampNumber(overlay.opacity ?? 0, 0, 100) / 100;
    const overlayColor = overlay.color ?? tokens.colors.overlay.strong;

    const imageOpacity = clampNumber(background.imageOpacity ?? 100, 0, 100) / 100;
    const imageBlur = clampNumber(background.blur ?? 0, 0, 100);
    const focalX = clampNumber(background.focalX ?? 50, 0, 100);
    const focalY = clampNumber(background.focalY ?? 50, 0, 100);
    const imagePosition = `${background.imagePosition ?? 'center'} center`;
    const focalPosition = `${focalX}% ${focalY}%`;
    const resolvedObjectPosition =
      background.focalX !== undefined || background.focalY !== undefined ? focalPosition : imagePosition;

    const containerStyle: React.CSSProperties = {
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
    };

    const wrapperStyle: React.CSSProperties = {
      position: 'relative',
      display: 'block',
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      boxSizing: 'border-box',
      textAlign: align,
      borderRadius: backgroundMode !== 'none' || hasBackgroundImage ? tokens.radius.md : undefined,
      overflow: hasBackgroundImage ? 'hidden' : undefined,
      background:
        backgroundMode === 'color'
          ? background.color ?? tokens.colors.surface
          : backgroundMode === 'gradient'
          ? `linear-gradient(${gradientSettings.angle ?? 180}deg, ${
              gradientSettings.start ?? tokens.colors.surfaceInverse
            }, ${gradientSettings.end ?? tokens.colors.surface})`
          : undefined,
    };

    const animationEnabled = animation.enabled ?? false;
    const animationType = animation.type ?? 'none';
    if (animationEnabled && animationType !== 'none') {
      const definition = TEXT_ANIMATION_DEFINITIONS[animationType as Exclude<TextAnimationType, 'none'>];
      if (definition) {
        wrapperStyle.animationName = definition.name;
        wrapperStyle.animationDuration = `${clampNumber(animation.duration ?? 300, 0, 10000)}ms`;
        wrapperStyle.animationDelay = `${clampNumber(animation.delay ?? 0, 0, 10000)}ms`;
        wrapperStyle.animationTimingFunction = definition.timingFunction;
        wrapperStyle.animationFillMode = 'both';
      }
    }

    const textStyle: React.CSSProperties = {
      margin: 0,
      color: resolvedTextColor,
      fontSize,
      lineHeight,
      letterSpacing,
      fontWeight,
      fontFamily,
      fontStyle: typography.italic ? 'italic' : 'normal',
      textDecoration: typography.underline ? 'underline' : 'none',
      textTransform: typography.uppercase ? 'uppercase' : 'none',
    };

    return (
      <div key={block.id} style={containerStyle}>
        <div style={wrapperStyle}>
          {hasBackgroundImage ? (
            <img
              src={background.imageUrl ?? ''}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: background.imageFit ?? 'cover',
                objectPosition: resolvedObjectPosition,
                opacity: imageOpacity,
                filter: imageBlur > 0 ? `blur(${imageBlur}px)` : undefined,
                pointerEvents: 'none',
              }}
            />
          ) : null}
          {shouldShowOverlay && overlayOpacity > 0
            ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: hexToRgba(overlayColor, overlayOpacity),
                    pointerEvents: 'none',
                  }}
                />
              )
            : null}
          <p style={textStyle}>{block.text}</p>
        </div>
      </div>
    );
  };

  const renderImageBlock = (block: ImageBlock) => {
    const style: React.CSSProperties = {
      display: 'block',
      width: '100%',
      height: 'auto',
      borderRadius: resolveImageRadius(block.radius),
      marginBottom: tokens.spacing.md,
    };

    if (typeof block.width === 'number') {
      style.maxWidth = block.width;
    }

    return <img key={block.id} src={block.src} alt={block.alt ?? ''} style={style} />;
  };

  const renderButtonBlock = (block: ButtonBlock) => {
    const align = block.align ?? 'left';
    const justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
    const isOutline = block.style === 'outline';

    return (
      <div
        key={block.id}
        style={{
          display: 'flex',
          justifyContent,
          marginBottom: tokens.spacing.md,
        }}
      >
        <a
          href={block.href ?? '#'}
          target={block.target ?? '_self'}
          rel={block.target === '_blank' ? 'noreferrer' : undefined}
          style={{
            padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
            borderRadius: tokens.radius.lg,
            border: isOutline ? `${tokens.border.thin}px solid #059669` : 'none',
            background: isOutline ? 'transparent' : '#059669',
            color: isOutline ? '#047857' : '#ffffff',
            fontWeight: tokens.fontWeight.medium,
            textDecoration: 'none',
            transition: 'opacity 150ms ease',
          }}
        >
          {block.label}
        </a>
      </div>
    );
  };

  const renderDividerBlock = (block: DividerBlock) => (
    <hr
      key={block.id}
      style={{
        margin: `${tokens.spacing.lg}px 0`,
        border: 'none',
        borderBottom: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
      }}
    />
  );

  const renderSpacerBlock = (block: SpacerBlock) => (
    <div key={block.id} style={{ height: block.height ?? tokens.spacing.lg }} />
  );

  const renderTwoColumnColumn = (column: TwoColumnColumn, columnKey: string, scale: number) => {
    const text = column.text ?? null;
    const image = column.image ?? null;
    const alignment = column.imageAlignment ?? 'top';
    const spacingBase = column.imageSpacing ?? tokens.spacing.md;
    const spacing = Math.round(clampNumber(spacingBase, 0, 120) * scale);
    const wrapEnabled = Boolean(image && column.wrapTextAroundImage && (alignment === 'left' || alignment === 'right'));
    const elements: React.ReactNode[] = [];

    const createImageElement = (position: 'before' | 'after') => {
      if (!image) return null;

      const style: React.CSSProperties = {
        display: 'block',
        width: '100%',
        height: 'auto',
        borderRadius: resolveImageRadius(image.radius),
        boxSizing: 'border-box',
      };

      if (typeof image.width === 'number') {
        style.maxWidth = image.width;
      } else {
        style.maxWidth = '100%';
      }

      if (wrapEnabled) {
        style.width = typeof image.width === 'number' ? `${image.width}px` : '280px';
        style.maxWidth = '100%';
        const floatDirection: 'left' | 'right' = alignment === 'right' ? 'right' : 'left';
        style.float = floatDirection;
        style.margin = floatDirection === 'left'
          ? `0 ${spacing}px ${spacing}px 0`
          : `0 0 ${spacing}px ${spacing}px`;
        style.shapeOutside = `inset(0 round ${tokens.radius.lg}px)`;
      } else {
        if (alignment === 'right') {
          style.marginLeft = 'auto';
        }
        if (position === 'before') {
          style.marginBottom = spacing;
        } else {
          style.marginTop = spacing;
        }
      }

      return <img key={`${image.id}-${position}`} src={image.src} alt={image.alt ?? ''} style={style} />;
    };

    const imageBeforeText = wrapEnabled || alignment === 'top' || alignment === 'left';

    if (image && imageBeforeText) {
      const element = createImageElement('before');
      if (element) elements.push(element);
    }

    if (text) {
      elements.push(
        <p
          key={text.id}
          style={{
            margin: 0,
            fontSize: tokens.fontSize.md,
            lineHeight: tokens.lineHeight.normal,
            color: tokens.colors.textSecondary,
            textAlign: text.align ?? 'left',
          }}
        >
          {text.text}
        </p>,
      );
    }

    if (image && !imageBeforeText) {
      const element = createImageElement('after');
      if (element) elements.push(element);
    }

    if (wrapEnabled) {
      elements.push(<div key={`${columnKey}-clear`} style={{ clear: 'both' }} />);
    }

    if (!elements.length) {
      elements.push(
        <div
          key={`${columnKey}-empty`}
          style={{
            color: tokens.colors.textMuted,
            fontSize: tokens.fontSize.sm,
            padding: `${tokens.spacing.sm}px 0`,
          }}
        >
          Configure this column from the inspector.
        </div>,
      );
    }

    return (
      <div key={columnKey} style={{ position: 'relative', overflow: 'hidden' }}>
        {elements}
      </div>
    );
  };

  const renderTwoColumnBlock = (block: TwoColumnBlock) => {
    const ratio = block.ratio ?? '1-1';
    const [leftFraction, rightFraction] =
      ratio === '1-2' ? ['1fr', '2fr'] : ratio === '2-1' ? ['2fr', '1fr'] : ['1fr', '1fr'];
    const scale = scaleForDevice[currentDevice];
    const paddingMultiplier = paddingScale[currentDevice];
    const gap = Math.round(clampNumber(block.gap ?? tokens.spacing.lg, 0, 96) * scale);
    const padding = Math.round(clampNumber(block.padding ?? tokens.spacing.lg, 0, 192) * paddingMultiplier);
    const stacked = currentDevice === 'mobile';

    return (
      <section
        key={block.id}
        style={{
          margin: `${tokens.spacing.md}px 0`,
        }}
      >
        <div
          style={{
            padding,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'grid',
              gap,
              gridTemplateColumns: stacked ? '1fr' : `${leftFraction} ${rightFraction}`,
              alignItems: 'start',
            }}
          >
            {renderTwoColumnColumn(block.left, `${block.id}-left`, scale)}
            {renderTwoColumnColumn(block.right, `${block.id}-right`, scale)}
          </div>
        </div>
      </section>
    );
  };

  function renderBlock(b: Block): React.ReactNode {
    switch (b.type) {
      case 'text':
        return renderTextBlock(b);
      case 'image':
        return renderImageBlock(b);
      case 'button':
        return renderButtonBlock(b);
      case 'divider':
        return renderDividerBlock(b);
      case 'spacer':
        return renderSpacerBlock(b);
      case 'two-col':
        return renderTwoColumnBlock(b);
      case 'header':
        return renderHeaderBlock(b);
      default:
        return null;
    }
  }

  return (
    <>
      <div>{blocks.map(renderBlock)}</div>
      <style jsx global>{TEXT_ANIMATION_GLOBAL_STYLES}</style>
    </>
  );
}
