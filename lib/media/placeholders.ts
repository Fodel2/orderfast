import type { CSSProperties } from 'react';

const FALLBACK_PLACEHOLDER_SRC = '/illustrations/placeholder-cutlery.svg';

export function getItemPlaceholder(
  restaurantLogoUrl?: string
): { src: string; style?: CSSProperties } {
  if (restaurantLogoUrl) {
    return {
      src: restaurantLogoUrl,
      style: {
        filter: 'grayscale(100%)',
        opacity: 0.4,
        mixBlendMode: 'multiply',
      },
    };
  }

  return {
    src: FALLBACK_PLACEHOLDER_SRC,
    style: {
      filter: 'grayscale(100%)',
      opacity: 0.7,
    },
  };
}
