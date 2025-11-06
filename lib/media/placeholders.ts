import type { CSSProperties } from 'react';

const FALLBACK_PLACEHOLDER_SRC = '/icons/plate-outline.svg';

function normalizeSource(src?: string | null): string | undefined {
  if (typeof src !== 'string') return undefined;
  const trimmed = src.trim();
  return trimmed.length ? trimmed : undefined;
}

export function getItemPlaceholder(
  restaurantLogoUrl?: string | null
): { src: string; style?: CSSProperties } {
  const sharedStyle: CSSProperties = {
    filter: 'grayscale(100%)',
    opacity: 0.55,
  };

  const normalizedLogo = normalizeSource(restaurantLogoUrl);

  if (normalizedLogo) {
    return {
      src: normalizedLogo,
      style: sharedStyle,
    };
  }

  return {
    src: FALLBACK_PLACEHOLDER_SRC,
    style: sharedStyle,
  };
}

export { normalizeSource };
