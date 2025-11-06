import type { CSSProperties } from 'react';

const FALLBACK_PLACEHOLDER_SRC = '/icons/plate-outline.svg';

export function getItemPlaceholder(
  restaurantLogoUrl?: string
): { src: string; style?: CSSProperties } {
  const sharedStyle: CSSProperties = {
    filter: 'grayscale(100%)',
    opacity: 0.55,
  };

  if (restaurantLogoUrl) {
    return {
      src: restaurantLogoUrl,
      style: sharedStyle,
    };
  }

  return {
    src: FALLBACK_PLACEHOLDER_SRC,
    style: sharedStyle,
  };
}
