import type { SlideBlock } from '@/components/SlidesManager';
import { tokens } from '@/src/ui/tokens';

const DEFAULT_MARGIN_FALLBACK = 16;

export const TEXT_BLOCK_SIZE_TO_FONT: Record<
  NonNullable<SlideBlock['size']>,
  number
> = {
  sm: tokens.fontSize.lg,
  md: tokens.fontSize.xl,
  lg: tokens.fontSize['3xl'],
  xl: tokens.fontSize['4xl'],
};

const TYPOGRAPHY_VERTICAL_PADDING: Record<'heading' | 'subheading' | 'text', number> = {
  heading: tokens.spacing.lg,
  subheading: tokens.spacing.md,
  text: tokens.spacing.sm,
};

const TYPOGRAPHY_LINE_HEIGHTS: Record<'heading' | 'subheading' | 'text', number> = {
  heading: tokens.lineHeight.snug,
  subheading: tokens.lineHeight.normal,
  text: tokens.lineHeight.relaxed,
};

type MarginRule = {
  min: number;
  max: number;
  scale: number;
  fallback?: number;
};

const TYPOGRAPHY_MARGIN_RULES: Record<'heading' | 'subheading' | 'text', {
  top: MarginRule;
  bottom: MarginRule;
}> = {
  heading: {
    top: { min: 0, max: tokens.spacing.md, scale: 0, fallback: 0 },
    bottom: {
      min: tokens.spacing.sm,
      max: tokens.spacing.lg,
      scale: 0.35,
      fallback: tokens.spacing.md,
    },
  },
  subheading: {
    top: {
      min: tokens.spacing.xs,
      max: tokens.spacing.md,
      scale: 0.25,
      fallback: tokens.spacing.sm,
    },
    bottom: {
      min: tokens.spacing.sm,
      max: tokens.spacing.lg,
      scale: 0.3,
      fallback: tokens.spacing.md,
    },
  },
  text: {
    top: {
      min: tokens.spacing.xs,
      max: tokens.spacing.sm,
      scale: 0.2,
      fallback: tokens.spacing.xs,
    },
    bottom: {
      min: tokens.spacing.xs,
      max: tokens.spacing.md,
      scale: 0.28,
      fallback: tokens.spacing.sm,
    },
  },
};

const clampValue = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const resolveMargin = (fontSize: number | undefined, rule: MarginRule) => {
  const fallback = rule.fallback ?? DEFAULT_MARGIN_FALLBACK;
  if (!Number.isFinite(fontSize)) {
    return clampValue(fallback, rule.min, rule.max);
  }
  const computed = fontSize * rule.scale;
  if (!Number.isFinite(computed)) {
    return clampValue(fallback, rule.min, rule.max);
  }
  return clampValue(computed, rule.min, rule.max);
};

export type TypographySpacing = {
  fontSize?: number;
  lineHeight: string | number;
  paddingTop: number;
  paddingBottom: number;
  marginTop: number;
  marginBottom: number;
};

export const resolveLineHeightValue = (
  value?: number,
  unit?: SlideBlock['lineHeightUnit'],
): string | number | undefined => {
  if (typeof value !== 'number') return undefined;
  if (unit === 'px') return `${value}px`;
  if (unit === 'em') return `${value}em`;
  return value;
};

export function resolveTypographySpacing(block: SlideBlock): TypographySpacing {
  const typographyKind: 'heading' | 'subheading' | 'text' =
    block.kind === 'heading' || block.kind === 'subheading' ? block.kind : 'text';

  const baseFontSize = (() => {
    if (typeof block.fontSize === 'number' && Number.isFinite(block.fontSize)) {
      return Math.max(block.fontSize, 1);
    }
    if (block.size && TEXT_BLOCK_SIZE_TO_FONT[block.size]) {
      return TEXT_BLOCK_SIZE_TO_FONT[block.size];
    }
    if (block.kind === 'heading') {
      return tokens.fontSize['4xl'];
    }
    if (block.kind === 'subheading') {
      return TEXT_BLOCK_SIZE_TO_FONT.md;
    }
    if (block.kind === 'text') {
      return tokens.fontSize.md;
    }
    return undefined;
  })();

  const lineHeight =
    resolveLineHeightValue(block.lineHeight, block.lineHeightUnit) ??
    TYPOGRAPHY_LINE_HEIGHTS[typographyKind];
  const paddingScale = TYPOGRAPHY_VERTICAL_PADDING[typographyKind] ?? tokens.spacing.sm;
  const marginRules = TYPOGRAPHY_MARGIN_RULES[typographyKind];

  return {
    fontSize: baseFontSize,
    lineHeight,
    paddingTop: paddingScale,
    paddingBottom: paddingScale,
    marginTop: resolveMargin(baseFontSize, marginRules.top),
    marginBottom: resolveMargin(baseFontSize, marginRules.bottom),
  };
}
