import type { CSSProperties } from 'react';
import { FALLBACK_PLACEHOLDER_SRC, normalizeSource } from '@/lib/media/placeholders';

interface KioskCategoryTileProps {
  category: {
    id: number;
    name: string;
    image_url?: string | null;
  };
  restaurantLogoUrl?: string | null;
  onSelect?: (categoryId: number) => void;
}

export default function KioskCategoryTile({ category, restaurantLogoUrl, onSelect }: KioskCategoryTileProps) {
  const categoryImage = normalizeSource(category.image_url);
  const restaurantLogo = normalizeSource(restaurantLogoUrl);
  const fallbackImage = categoryImage || restaurantLogo || FALLBACK_PLACEHOLDER_SRC;

  const isLogoFallback = !categoryImage && !!restaurantLogo;

  const handleClick = () => {
    onSelect?.(category.id);
  };

  const imageStyle: CSSProperties | undefined = isLogoFallback
    ? { filter: 'grayscale(60%)', opacity: 0.9 }
    : undefined;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative block h-full min-h-[80px] w-full overflow-hidden rounded-2xl bg-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <div className="absolute inset-0">
        <img
          src={fallbackImage}
          alt=""
          className="h-full w-full object-cover"
          style={imageStyle}
          loading="lazy"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/10 to-transparent" />
      <div className="absolute inset-x-2 bottom-2 rounded-xl bg-white/60 px-3 py-2 text-center text-base font-semibold text-neutral-900 backdrop-blur-md">
        <span className="line-clamp-2 leading-tight">{category.name}</span>
      </div>
    </button>
  );
}
