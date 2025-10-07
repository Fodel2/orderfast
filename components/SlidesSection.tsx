import React, { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  BLOCK_INTERACTION_GLOBAL_STYLES,
  getBlockInteractionPresentation,
  type SlideCfg,
  type SlideBlock,
  type DeviceKind,
  type BlockBackground,
  type BlockBackgroundGradientDirection,
  type BlockShadowPreset,
  BUTTON_HORIZONTAL_PADDING,
  BUTTON_VERTICAL_PADDING,
  getAspectRatioValue,
  hexToRgba,
  resolveButtonConfig,
  resolveImageConfig,
  resolveLineHeightValue,
  resolveQuoteConfig,
  resolveTextShadowStyle,
  getQuoteStarColorValue,
  getQuoteVariantBaseStyles,
  getQuoteVariantFontSizeFallback,
  resolveGalleryConfig,
  resolveBlockVisibility,
} from './SlidesManager';
import type { SlideRow } from '@/components/customer/home/SlidesContainer';
import {
  DEFAULT_TEXT_FONT_FAMILY,
  resolveBlockFontFamily,
  getFontStackForFamily,
  useGoogleFontLoader,
} from '@/lib/slideFonts';
import { Star } from 'lucide-react';
import { tokens } from '../src/ui/tokens';
import GalleryBlock from './blocks/GalleryBlock';

const TEXT_SIZE_MAP: Record<string, number> = {
  sm: tokens.fontSize.lg,
  md: tokens.fontSize.xl,
  lg: tokens.fontSize['3xl'],
  xl: tokens.fontSize['4xl'],
};

const BUTTON_FONT_SIZE_MAP: Record<string, number> = {
  Small: tokens.fontSize.sm,
  Medium: tokens.fontSize.md,
  Large: tokens.fontSize.lg,
};

const BLOCK_SHADOW_VALUE: Record<BlockShadowPreset, string | undefined> = {
  none: undefined,
  sm: tokens.shadow.sm,
  md: tokens.shadow.md,
  lg: tokens.shadow.lg,
};

const BLOCK_GRADIENT_DIRECTION_MAP: Record<BlockBackgroundGradientDirection, string> = {
  'to-top': 'to top',
  'to-bottom': 'to bottom',
  'to-left': 'to left',
  'to-right': 'to right',
};

const DEFAULT_BLOCK_BACKGROUND_COLOR = tokens.colors.surface;
const DEFAULT_BLOCK_GRADIENT_FROM = tokens.colors.overlay.strong;
const DEFAULT_BLOCK_GRADIENT_TO = tokens.colors.overlay.soft;

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

function useDeviceKind(): DeviceKind {
  const [device, setDevice] = useState<DeviceKind>('desktop');
  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      if (width < 640) setDevice('mobile');
      else if (width < 1024) setDevice('tablet');
      else setDevice('desktop');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return device;
}

function pickFrame(block: SlideBlock, device: DeviceKind) {
  const frames = block.frames || {};
  return (
    frames[device] ||
    frames.desktop ||
    frames.tablet ||
    frames.mobile || {
      x: 10,
      y: 10,
      w: 40,
      h: 20,
      r: 0,
    }
  );
}

function renderBlock(block: SlideBlock) {
  const fontFamilyKey = resolveBlockFontFamily(block);
  const resolvedFontFamily = getFontStackForFamily(fontFamilyKey);
  switch (block.kind) {
    case 'heading':
    case 'subheading':
    case 'text': {
      const Tag = block.kind === 'heading' ? 'h2' : block.kind === 'subheading' ? 'h3' : 'p';
      const mappedSize = block.size ? TEXT_SIZE_MAP[block.size] : undefined;
      const align = block.align ?? 'left';
      const lineHeightValue = resolveLineHeightValue(block.lineHeight, block.lineHeightUnit);
      const textShadow = resolveTextShadowStyle(block);
      const letterSpacing =
        typeof block.letterSpacing === 'number' ? `${block.letterSpacing}px` : undefined;
      const textColor = block.textColor ?? block.color ?? tokens.colors.textOnDark;
      const style: CSSProperties = {
        color: textColor,
        textAlign: align,
        fontSize:
          typeof block.fontSize === 'number'
            ? `${block.fontSize}px`
            : mappedSize !== undefined
              ? `${mappedSize}px`
              : undefined,
        fontWeight:
          block.fontWeight ??
          (block.kind === 'heading'
            ? tokens.fontWeight.bold
            : block.kind === 'subheading'
              ? tokens.fontWeight.semibold
              : tokens.fontWeight.regular),
        lineHeight: lineHeightValue,
        letterSpacing,
        textShadow,
        margin: 0,
      };
      if (resolvedFontFamily) {
        style.fontFamily = resolvedFontFamily;
      }
      const content = block.content ?? block.text ?? '';
      const textElement = <Tag style={style}>{content}</Tag>;
      if ((block.kind === 'heading' || block.kind === 'text') && block.bgStyle && block.bgStyle !== 'none') {
        const resolvedOpacity =
          typeof block.bgOpacity === 'number'
            ? block.bgOpacity
            : block.bgStyle === 'glass'
              ? 0.5
              : 1;
        const backgroundColor =
          hexToRgba(block.bgColor ?? tokens.colors.surfaceInverse, resolvedOpacity) ??
          hexToRgba(tokens.colors.surfaceInverse, resolvedOpacity);
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
      const align = block.align ?? 'left';
      const fontSizeValue =
        typeof block.fontSize === 'number'
          ? block.fontSize
          : BUTTON_FONT_SIZE_MAP[button.size] ?? BUTTON_FONT_SIZE_MAP.Medium;
      const lineHeightValue = resolveLineHeightValue(block.lineHeight, block.lineHeightUnit);
      const paddingX = BUTTON_HORIZONTAL_PADDING[button.size] ?? BUTTON_HORIZONTAL_PADDING.Medium;
      const paddingY = BUTTON_VERTICAL_PADDING[button.size] ?? BUTTON_VERTICAL_PADDING.Medium;
      const style: CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${paddingY}px ${paddingX}px`,
        borderRadius: button.radius,
        color: button.textColor,
        backgroundColor: button.variant === 'Primary' ? button.bgColor : 'transparent',
        borderColor: button.variant === 'Outline' ? button.bgColor : 'transparent',
        borderWidth: button.variant === 'Outline' ? tokens.border.thin : 0,
        borderStyle: 'solid',
        fontWeight: block.fontWeight ?? tokens.fontWeight.semibold,
        textDecoration: 'none',
        boxShadow: button.shadow ? tokens.shadow.md : tokens.shadow.none,
        transition:
          'transform 150ms ease-out, box-shadow 150ms ease-out, background-color 150ms ease-out, color 150ms ease-out',
      };
      if (resolvedFontFamily) {
        style.fontFamily = resolvedFontFamily;
      }
      if (fontSizeValue) {
        style.fontSize = `${fontSizeValue}px`;
      }
      if (lineHeightValue !== undefined) {
        style.lineHeight = lineHeightValue;
      }
      if (button.fullWidth) {
        style.width = '100%';
      }
      if (typeof block.letterSpacing === 'number') {
        style.letterSpacing = `${block.letterSpacing}px`;
      }
      return (
        <div style={{ width: '100%', textAlign: align }}>
          <a href={button.href || '#'} style={style}>
            {button.label || block.text || 'Button'}
          </a>
        </div>
      );
    }
    case 'image': {
      const image = resolveImageConfig(block);
      const imageUrl = image.url || block.src || '';
      const aspectRatioValue = getAspectRatioValue(image.aspectRatio);
      const wrapperStyle: CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: image.radius,
        boxShadow: image.shadow ? tokens.shadow.lg : tokens.shadow.none,
        backgroundColor: 'transparent',
      };
      if (aspectRatioValue) {
        wrapperStyle.aspectRatio = aspectRatioValue;
        wrapperStyle.height = 'auto';
      }
      if (!imageUrl) {
        return (
          <div
            style={{
              ...wrapperStyle,
              backgroundColor: tokens.colors.neutral[200],
            }}
          />
        );
      }
      const imageStyle: CSSProperties = {
        width: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        borderRadius: image.radius,
        objectFit: image.fit,
        objectPosition: `${image.focalX * 100}% ${image.focalY * 100}%`,
        display: 'block',
      };
      if (aspectRatioValue) {
        imageStyle.aspectRatio = aspectRatioValue;
        imageStyle.height = 'auto';
      } else {
        imageStyle.height = '100%';
      }
      return (
        <div style={wrapperStyle}>
          <img src={imageUrl} alt={image.alt ?? ''} style={imageStyle} />
        </div>
      );
    }
    case 'quote':
      {
        const quote = resolveQuoteConfig(block);
        const variantStyles = getQuoteVariantBaseStyles(quote);
        const starColorValue = getQuoteStarColorValue(quote.starColor);
        const defaultTextColor =
          quote.style === 'plain' ? tokens.colors.textOnDark : tokens.colors.textPrimary;
        const textColor = block.textColor ?? block.color ?? defaultTextColor;
        const fallbackWeight =
          block.fontWeight ??
          (quote.style === 'emphasis'
            ? tokens.fontWeight.semibold
            : quote.style === 'card'
              ? tokens.fontWeight.medium
              : tokens.fontWeight.regular);
        const hasCustomFontSize = typeof block.fontSize === 'number';
        const fontSizeValue = hasCustomFontSize
          ? `${block.fontSize}px`
          : getQuoteVariantFontSizeFallback(quote.style);
        const lineHeightValue = resolveLineHeightValue(block.lineHeight, block.lineHeightUnit);
        const textShadow = resolveTextShadowStyle(block);
        const trimmedAuthor = quote.author.trim();
        const showReviewRating = quote.useReview && Boolean(quote.reviewId);
        const resolvedStarRating = Math.max(0, Math.min(5, Math.round(quote.starRating ?? 0)));
        const ratingValue = resolvedStarRating > 0 ? resolvedStarRating : showReviewRating ? 5 : 0;
        const shouldRenderRating = ratingValue > 0;
        const ratingLabelBase = quote.useReview ? 'review' : 'rating';
        const ratingLabelCount = ratingValue === 1 ? '1 star' : `${ratingValue} stars`;
        return (
          <blockquote
            style={{
              textAlign: quote.align,
              fontFamily: resolvedFontFamily ?? undefined,
              color: textColor,
            }}
          >
            <div
              style={{
                padding: variantStyles.padding,
                borderRadius: variantStyles.borderRadius,
                backgroundColor: variantStyles.backgroundColor,
                boxShadow: variantStyles.boxShadow,
                border: variantStyles.border,
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems:
                  quote.align === 'center'
                    ? 'center'
                    : quote.align === 'right'
                      ? 'flex-end'
                      : 'flex-start',
                maxWidth: '100%',
                gap: 0,
              }}
            >
              <p
                style={{
                  fontStyle: 'italic',
                  fontWeight: fallbackWeight,
                  fontSize: fontSizeValue,
                  lineHeight: lineHeightValue ?? tokens.lineHeight.relaxed,
                  letterSpacing:
                    typeof block.letterSpacing === 'number'
                      ? `${block.letterSpacing}px`
                      : undefined,
                  whiteSpace: 'pre-line',
                  textAlign: quote.align,
                  margin: 0,
                  textShadow,
                }}
              >
                <span aria-hidden>“</span>
                {quote.text}
                <span aria-hidden>”</span>
              </p>
              {trimmedAuthor.length > 0 ? (
                <cite
                  style={{
                    marginTop: tokens.spacing.sm,
                    fontSize: `${tokens.fontSize.xs}px`,
                    opacity: tokens.opacity[90],
                    whiteSpace: 'pre-line',
                    fontFamily: resolvedFontFamily ?? undefined,
                    fontWeight: typeof block.fontWeight === 'number' ? block.fontWeight : undefined,
                    lineHeight: lineHeightValue ?? tokens.lineHeight.normal,
                    textShadow,
                  }}
                >
                  — {trimmedAuthor}
                </cite>
              ) : null}
              {shouldRenderRating ? (
                <p
                  aria-label={`${ratingLabelCount} ${ratingLabelBase}`}
                  role="img"
                  style={{
                    fontFamily: resolvedFontFamily ?? undefined,
                    display: 'inline-flex',
                    alignItems: 'center',
                    columnGap: tokens.spacing.xs,
                    color: starColorValue,
                    marginTop: trimmedAuthor.length > 0 ? tokens.spacing.xs : tokens.spacing.sm,
                    opacity: tokens.opacity[90],
                    fontSize: `${tokens.fontSize.md}px`,
                    alignSelf: quote.style === 'card' ? 'center' : undefined,
                    justifyContent: quote.style === 'card' ? 'center' : undefined,
                    textShadow,
                  }}
                >
                  {Array.from({ length: 5 }).map((_, index) => {
                    const isFilled = index < ratingValue;
                    return (
                      <Star
                        key={index}
                        aria-hidden
                        size={tokens.spacing.md}
                        strokeWidth={1.5}
                        style={{
                          stroke: 'currentColor',
                          fill: isFilled ? 'currentColor' : 'transparent',
                          opacity: isFilled ? 1 : 0.35,
                        }}
                      />
                    );
                  })}
                </p>
              ) : null}
            </div>
          </blockquote>
        );
      }
    case 'gallery': {
      const gallery = resolveGalleryConfig(block);
      return (
        <GalleryBlock
          items={gallery.items}
          layout={gallery.layout}
          radius={gallery.radius}
          shadow={gallery.shadow}
          aspectRatio={gallery.aspectRatio}
          autoplay={gallery.autoplay}
          interval={gallery.interval}
        />
      );
    }
    case 'spacer':
      return <div className="h-full w-full" />;
    default:
      return null;
  }
}

function Background({ cfg }: { cfg: SlideCfg }) {
  const bg = cfg.background;
  if (!bg) return null;
  if (bg.type === 'color') {
    return (
      <>
        <div
          className="absolute inset-0"
          style={{ background: bg.color || tokens.colors.surfaceInverse, pointerEvents: 'none' }}
        />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{
              background: bg.overlay.color || tokens.colors.overlay.strong,
              opacity: bg.overlay.opacity ?? tokens.opacity[50],
              pointerEvents: 'none',
            }}
          />
        )}
      </>
    );
  }
  if (bg.type === 'image') {
    return (
      <>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: bg.url ? `url(${bg.url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            pointerEvents: 'none',
          }}
        />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{
              background: bg.overlay.color || tokens.colors.overlay.strong,
              opacity: bg.overlay.opacity ?? tokens.opacity[50],
              pointerEvents: 'none',
            }}
          />
        )}
      </>
    );
  }
  if (bg.type === 'video' && bg.url) {
    return (
      <>
        <video
          src={bg.url}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{
              background: bg.overlay.color || tokens.colors.overlay.strong,
              opacity: bg.overlay.opacity ?? tokens.opacity[50],
              pointerEvents: 'none',
            }}
          />
        )}
      </>
    );
  }
  return null;
}

function getBlockChromeStyle(
  block: SlideBlock,
  backgroundPresentation?: BlockBackgroundPresentation | null,
): CSSProperties {
  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'transparent',
  };

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
    style.borderColor = borderColor ?? tokens.colors.borderStrong;
  } else if (borderColor && borderColor !== 'transparent') {
    style.borderWidth = tokens.border.thin;
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

export default function SlidesSection({ slide, cfg }: { slide: SlideRow; cfg: SlideCfg }) {
  const device = useDeviceKind();
  const fontsInUse = useMemo(() => {
    const set = new Set<string>();
    (cfg.blocks || []).forEach((block) => {
      set.add(resolveBlockFontFamily(block));
    });
    if (set.size === 0) {
      set.add(DEFAULT_TEXT_FONT_FAMILY);
    }
    return Array.from(set);
  }, [cfg.blocks]);

  useGoogleFontLoader(fontsInUse);

  const blocks = useMemo(() => cfg.blocks || [], [cfg.blocks]);

  return (
    <>
      <style jsx global>{BLOCK_INTERACTION_GLOBAL_STYLES}</style>
      <section className="relative flex min-h-screen snap-start items-center justify-center" style={{ height: '100dvh' }}>
        <Background cfg={cfg} />
        <div className="relative h-full w-full" style={{ pointerEvents: 'none' }}>
          {blocks.map((block) => {
            const visibility = resolveBlockVisibility(block);
            if (!visibility[device]) {
              return null;
            }
            const frame = pickFrame(block, device);
            const style: CSSProperties = {
              position: 'absolute',
              left: `${frame.x}%`,
              top: `${frame.y}%`,
              width: `${frame.w}%`,
              height: `${frame.h}%`,
              transform: `rotate(${frame.r ?? 0}deg)`,
              transformOrigin: 'top left',
              pointerEvents: 'auto',
            };
            const interaction = getBlockInteractionPresentation(block);
            const backgroundPresentation = getBlockBackgroundPresentation(block.background);
            const chromeStyle = {
              ...getBlockChromeStyle(block, backgroundPresentation),
              ...(interaction.style || {}),
            } as CSSProperties;
            const chromeClasses = [
              'relative flex h-full w-full items-center justify-center',
              ...(interaction.classNames ?? []),
            ].join(' ');
            return (
              <div key={block.id} style={style} className="flex h-full w-full items-center justify-center">
                <div style={chromeStyle} className={chromeClasses}>
                  {backgroundPresentation && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={backgroundPresentation.style}
                    />
                  )}
                  <div className="relative z-[1] flex h-full w-full items-center justify-center">
                    {renderBlock(block)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

