import type { CSSProperties, ReactNode } from 'react';
import { Star } from 'lucide-react';
import GalleryBlock from '../blocks/GalleryBlock';
import {
  BUTTON_FONT_SIZE_SCALE,
  BUTTON_HORIZONTAL_PADDING,
  BUTTON_VERTICAL_PADDING,
  getAspectRatioValue,
  getQuoteStarColorValue,
  getQuoteVariantBaseStyles,
  getQuoteVariantFontSizeFallback,
  hexToRgba,
  resolveButtonConfig,
  resolveGalleryConfig,
  resolveImageConfig,
  resolveLineHeightValue,
  resolveQuoteConfig,
  resolveTextShadowStyle,
  TEXT_BLOCK_SIZE_TO_FONT,
  type SlideBlock,
} from '../SlidesManager';
import { getFontStackForFamily, resolveBlockFontFamily } from '@/lib/slideFonts';
import { tokens } from '../../src/ui/tokens';

const TEXTUAL_KINDS = new Set<SlideBlock['kind']>(['heading', 'subheading', 'text']);

const getLetterSpacing = (value?: number): string | undefined =>
  typeof value === 'number' ? `${value}px` : undefined;

const getFontFamily = (block: SlideBlock): string | undefined => {
  const familyKey = resolveBlockFontFamily(block);
  return getFontStackForFamily(familyKey) ?? undefined;
};

const getTextColor = (block: SlideBlock): string =>
  block.textColor ?? block.color ?? tokens.colors.textOnDark;

const withBackgroundWrapper = (
  block: SlideBlock,
  align: 'left' | 'center' | 'right',
  background: CSSProperties,
  content: ReactNode,
) => (
  <div style={{ width: '100%', textAlign: align }}>
    <div style={background}>{content}</div>
  </div>
);

export function renderStaticBlock(block: SlideBlock): ReactNode {
  switch (block.kind) {
    case 'heading':
    case 'subheading':
    case 'text': {
      const Tag = block.kind === 'heading' ? 'h2' : block.kind === 'subheading' ? 'h3' : 'p';
      const align = (block.align ?? 'left') as 'left' | 'center' | 'right';
      const mappedSize = block.size ? TEXT_BLOCK_SIZE_TO_FONT[block.size] : undefined;
      const lineHeight = resolveLineHeightValue(block.lineHeight, block.lineHeightUnit);
      const textShadow = resolveTextShadowStyle(block);
      const letterSpacing = getLetterSpacing(block.letterSpacing);
      const style: CSSProperties = {
        color: getTextColor(block),
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
        lineHeight,
        letterSpacing,
        textShadow,
        margin: 0,
      };
      const fontFamily = getFontFamily(block);
      if (fontFamily) {
        style.fontFamily = fontFamily;
      }
      const content = block.content ?? block.text ?? '';
      const textElement = <Tag style={style}>{content}</Tag>;
      if (TEXTUAL_KINDS.has(block.kind) && block.bgStyle && block.bgStyle !== 'none') {
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
        return withBackgroundWrapper(block, align, backgroundStyle, textElement);
      }
      return textElement;
    }
    case 'button': {
      const button = resolveButtonConfig(block);
      const align = (block.align ?? 'left') as 'left' | 'center' | 'right';
      const fontSize =
        typeof block.fontSize === 'number'
          ? block.fontSize
          : BUTTON_FONT_SIZE_SCALE[button.size] ?? BUTTON_FONT_SIZE_SCALE.Medium;
      const lineHeight = resolveLineHeightValue(block.lineHeight, block.lineHeightUnit);
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
      const fontFamily = getFontFamily(block);
      if (fontFamily) {
        style.fontFamily = fontFamily;
      }
      if (fontSize) {
        style.fontSize = `${fontSize}px`;
      }
      if (lineHeight !== undefined) {
        style.lineHeight = lineHeight;
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
    case 'quote': {
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
      const fontFamily = getFontFamily(block);
      const quoteAlign = (quote.align ?? 'left') as 'left' | 'center' | 'right';
      return (
        <blockquote
          style={{
            textAlign: quoteAlign,
            fontFamily: fontFamily ?? undefined,
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
                quoteAlign === 'center'
                  ? 'center'
                  : quoteAlign === 'right'
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
                letterSpacing: getLetterSpacing(block.letterSpacing),
                whiteSpace: 'pre-line',
                textAlign: quoteAlign,
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
                  fontFamily: fontFamily ?? undefined,
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
                  fontFamily: fontFamily ?? undefined,
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
