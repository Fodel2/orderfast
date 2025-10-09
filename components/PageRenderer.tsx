import React, { useEffect, useRef, useState } from 'react';

import { getFontStackFromId } from '@/lib/fonts';
import { tokens } from '@/src/ui/tokens';

export type DeviceKind = 'mobile' | 'tablet' | 'desktop';

export type TextBlock = {
  id: string;
  type: 'text';
  text: string;
  align?: 'left' | 'center' | 'right';
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
  overlayEnabled?: boolean;
  overlayColor?: string;
  overlayOpacity?: number;
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
  fullWidth?: boolean;
  parallaxEnabled?: boolean;
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

type HeaderSectionProps = {
  block: HeaderBlock;
  device: DeviceKind;
  marginTop: number;
  marginBottom: number;
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
const BLOCK_VERTICAL_SPACING = tokens.spacing.xl;

const resolveImageRadius = (radius?: ImageBlock['radius']) => {
  if (radius === '2xl') return 24;
  if (radius === 'lg') return tokens.radius.lg;
  return tokens.radius.none;
};

function HeaderBlockSection({ block, device, marginTop, marginBottom }: HeaderSectionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(query.matches);
    updatePreference();

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', updatePreference);
      return () => {
        query.removeEventListener('change', updatePreference);
      };
    }

    // Safari fallback
    const legacyListener = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    query.addListener(legacyListener);
    return () => {
      query.removeListener(legacyListener);
    };
  }, []);

  useEffect(() => {
    const imageNode = imageRef.current;
    if (!imageNode) return;
    if (!block.parallaxEnabled || prefersReducedMotion) {
      imageNode.style.transform = 'translateY(0)';
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }

    let frame = 0;
    let lastTransform = '';

    const update = () => {
      if (!containerRef.current || !imageRef.current) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const offset = Math.max(-60, Math.min(60, rect.top * -0.08));
      const nextTransform = `translateY(${offset.toFixed(2)}px)`;
      if (nextTransform !== lastTransform) {
        imageRef.current.style.transform = nextTransform;
        lastTransform = nextTransform;
      }
    };

    const handleScroll = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    update();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [block.parallaxEnabled, prefersReducedMotion]);

  useEffect(() => {
    if (!block.parallaxEnabled && imageRef.current) {
      imageRef.current.style.transform = 'translateY(0)';
    }
  }, [block.parallaxEnabled]);

  const scale = scaleForDevice[device];
  const paddingMultiplier = paddingScale[device];
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
  const overlayBackground = hasBackgroundImage
    ? overlayEnabled
      ? hexToRgba(block.overlayColor ?? '#0f172a', overlayOpacity)
      : 'transparent'
    : tokens.colors.surfaceInverse;
  const backgroundSize = block.backgroundImageFit ?? 'cover';
  const backgroundPosition = `${block.backgroundImagePosition ?? 'center'} center`;
  const horizontalPadding =
    device === 'desktop'
      ? HEADER_HORIZONTAL_PADDING_DESKTOP
      : device === 'tablet'
      ? HEADER_HORIZONTAL_PADDING_TABLET
      : HEADER_HORIZONTAL_PADDING_MOBILE;
  const textGap = Math.max(tokens.spacing.sm, Math.round(tokens.spacing.md * scale));
  const minHeight = Math.max(paddingTop + paddingBottom, MIN_HEADER_HEIGHT);

  return (
    <section
      style={{
        position: 'relative',
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
        background: hasBackgroundImage ? tokens.colors.surfaceInverse : tokens.colors.surface,
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        marginTop,
        marginBottom,
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          minHeight,
          backgroundColor: hasBackgroundImage ? 'transparent' : tokens.colors.surfaceInverse,
        }}
      >
        {hasBackgroundImage ? (
          <img
            ref={imageRef}
            src={block.backgroundImageUrl ?? ''}
            alt=""
            loading="lazy"
            decoding="async"
            className="of-webpage-image of-webpage-header-image"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: backgroundSize,
              objectPosition: backgroundPosition,
              pointerEvents: 'none',
              transition: `transform 500ms ${tokens.easing.standard}`,
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
            background: overlayBackground,
            transition: `background-color 220ms ${tokens.easing.standard}`,
          }}
        >
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
        </div>
      </div>
    </section>
  );
}

export default function PageRenderer({ blocks, device }: PageRendererProps) {
  const currentDevice = useResponsiveDevice(device);

  const renderTextBlock = (block: TextBlock, isFirst: boolean) => (
    <section
      key={block.id}
      style={{
        marginTop: isFirst ? 0 : BLOCK_VERTICAL_SPACING,
        marginBottom: BLOCK_VERTICAL_SPACING,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: tokens.fontSize.md,
          lineHeight: tokens.lineHeight.normal,
          color: tokens.colors.textSecondary,
          textAlign: block.align ?? 'left',
        }}
      >
        {block.text}
      </p>
    </section>
  );

  const renderImageBlock = (block: ImageBlock, isFirst: boolean) => {
    const style: React.CSSProperties = {
      display: 'block',
      width: '100%',
      height: 'auto',
      borderRadius: resolveImageRadius(block.radius),
      marginLeft: 'auto',
      marginRight: 'auto',
      boxSizing: 'border-box',
    };

    if (typeof block.width === 'number') {
      style.maxWidth = block.width;
    }

    return (
      <section
        key={block.id}
        style={{
          marginTop: isFirst ? 0 : BLOCK_VERTICAL_SPACING,
          marginBottom: BLOCK_VERTICAL_SPACING,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <img
          src={block.src}
          alt={block.alt ?? ''}
          loading="lazy"
          decoding="async"
          className="of-webpage-image"
          style={style}
        />
      </section>
    );
  };

  const renderButtonBlock = (block: ButtonBlock, isFirst: boolean) => {
    const align = block.align ?? 'left';
    const justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
    const isOutline = block.style === 'outline';

    return (
      <section
        key={block.id}
        style={{
          marginTop: isFirst ? 0 : BLOCK_VERTICAL_SPACING,
          marginBottom: BLOCK_VERTICAL_SPACING,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent,
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
      </section>
    );
  };

  const renderDividerBlock = (block: DividerBlock, isFirst: boolean) => (
    <section
      key={block.id}
      style={{
        marginTop: isFirst ? 0 : BLOCK_VERTICAL_SPACING,
        marginBottom: BLOCK_VERTICAL_SPACING,
      }}
    >
      <hr
        style={{
          margin: 0,
          border: 'none',
          borderBottom: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
        }}
      />
    </section>
  );

  const renderSpacerBlock = (block: SpacerBlock, isFirst: boolean) => (
    <section
      key={block.id}
      style={{
        marginTop: isFirst ? 0 : BLOCK_VERTICAL_SPACING,
        marginBottom: BLOCK_VERTICAL_SPACING,
      }}
    >
      <div style={{ height: block.height ?? tokens.spacing.lg }} />
    </section>
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
        style.margin =
          floatDirection === 'left'
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

      return (
        <img
          key={`${image.id}-${position}`}
          src={image.src}
          alt={image.alt ?? ''}
          loading="lazy"
          decoding="async"
          className="of-webpage-image"
          style={style}
        />
      );
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

  const renderTwoColumnBlock = (block: TwoColumnBlock, isFirst: boolean) => {
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
          marginTop: isFirst ? 0 : BLOCK_VERTICAL_SPACING,
          marginBottom: BLOCK_VERTICAL_SPACING,
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

  const renderBlock = (block: Block, index: number) => {
    const isFirst = index === 0;
    switch (block.type) {
      case 'text':
        return renderTextBlock(block, isFirst);
      case 'image':
        return renderImageBlock(block, isFirst);
      case 'button':
        return renderButtonBlock(block, isFirst);
      case 'divider':
        return renderDividerBlock(block, isFirst);
      case 'spacer':
        return renderSpacerBlock(block, isFirst);
      case 'two-col':
        return renderTwoColumnBlock(block, isFirst);
      case 'header':
        return (
          <HeaderBlockSection
            key={block.id}
            block={block}
            device={currentDevice}
            marginTop={isFirst ? 0 : BLOCK_VERTICAL_SPACING}
            marginBottom={BLOCK_VERTICAL_SPACING}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="of-webpage-renderer">
      {blocks.map((block, index) => renderBlock(block, index))}

      <style jsx global>{`
        @keyframes ofBuilderImageShimmer {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .of-webpage-image {
          background-image: linear-gradient(
            90deg,
            rgba(15, 23, 42, 0.06) 0%,
            rgba(15, 23, 42, 0.02) 45%,
            rgba(15, 23, 42, 0.06) 100%
          );
          background-size: 400% 100%;
          animation: ofBuilderImageShimmer 2.4s ease-in-out infinite;
          transition: filter 200ms ${tokens.easing.standard};
        }

        .of-webpage-header-image {
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .of-webpage-image {
            animation-duration: 0.001ms;
            animation-iteration-count: 1;
          }
        }
      `}</style>
    </div>
  );
}
