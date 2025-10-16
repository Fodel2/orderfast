import { tokens } from '@/src/ui/tokens';

import type { InputSelectOption } from '@/src/components/inspector/controls/InputSelect';
import type { TextAnimationType } from '../../PageRenderer';

export const BACKGROUND_MODE_OPTIONS: InputSelectOption[] = [
  { label: 'None', value: 'none' },
  { label: 'Solid color', value: 'color' },
  { label: 'Gradient', value: 'gradient' },
  { label: 'Image', value: 'image' },
];

export const IMAGE_FIT_OPTIONS: InputSelectOption[] = [
  { label: 'Cover', value: 'cover' },
  { label: 'Contain', value: 'contain' },
];

export const IMAGE_POSITION_OPTIONS: InputSelectOption[] = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
];

export const ANIMATION_OPTIONS: { label: string; value: TextAnimationType }[] = [
  { label: 'Fade in', value: 'fade-in' },
  { label: 'Slide in (left)', value: 'slide-in-left' },
  { label: 'Slide in (right)', value: 'slide-in-right' },
  { label: 'Slide in (up)', value: 'slide-in-up' },
  { label: 'Slide in (down)', value: 'slide-in-down' },
  { label: 'Zoom in', value: 'zoom-in' },
];

export const CLEAR_BUTTON_STYLE: React.CSSProperties = {
  alignSelf: 'flex-start',
  borderRadius: tokens.radius.sm,
  border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
  background: tokens.colors.surface,
  color: tokens.colors.textSecondary,
  padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
};

export const gradientDefaults = {
  angle: 180,
  start: '#0f172a',
  end: '#1e293b',
};

export const extractHexFallback = (token: string, fallback: string): string => {
  const match = token.match(/#([0-9a-fA-F]{3,8})/);
  if (!match) {
    return fallback;
  }
  const [raw] = match;
  if (!raw) {
    return fallback;
  }
  const hex = raw.replace('#', '');
  if (hex.length === 3) {
    return `#${hex
      .split('')
      .map((value) => value + value)
      .join('')}`;
  }
  if (hex.length === 8) {
    return `#${hex.slice(0, 6)}`;
  }
  if (hex.length === 6) {
    return `#${hex}`;
  }
  return fallback;
};

export const mergeNested = <T extends Record<string, unknown>>(
  current: T | undefined,
  patch: Partial<T>,
): T | undefined => {
  const next: Record<string, unknown> = { ...(current ?? {}) };
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value as unknown;
    }
  });
  return Object.keys(next).length > 0 ? (next as T) : undefined;
};

export const ALIGN_OPTIONS = [
  { label: 'Left', value: 'left' as const },
  { label: 'Center', value: 'center' as const },
  { label: 'Right', value: 'right' as const },
] as const;

