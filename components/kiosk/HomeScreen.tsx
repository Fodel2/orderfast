import Image from 'next/image';
import { useMemo } from 'react';
import { FALLBACK_PLACEHOLDER_SRC, normalizeSource } from '@/lib/media/placeholders';

export type KioskRestaurant = {
  id: string;
  name?: string | null;
  logo_url?: string | null;
  website_description?: string | null;
  menu_header_image_url?: string | null;
  menu_header_image_updated_at?: string | null;
  menu_header_focal_x?: number | null;
  menu_header_focal_y?: number | null;
  theme_primary_color?: string | null;
};

interface HomeScreenProps {
  restaurant: KioskRestaurant | null;
  onStart: () => void;
  fadingOut?: boolean;
}

function formatImageUrl(url?: string | null, updatedAt?: string | null) {
  const normalized = normalizeSource(url);
  if (!normalized) return null;
  if (!updatedAt) return normalized;
  const ts = new Date(updatedAt).getTime();
  return `${normalized}?v=${ts}`;
}

export default function HomeScreen({ restaurant, onStart, fadingOut }: HomeScreenProps) {
  const heroUrl = useMemo(
    () => formatImageUrl(restaurant?.menu_header_image_url, restaurant?.menu_header_image_updated_at),
    [restaurant?.menu_header_image_updated_at, restaurant?.menu_header_image_url]
  );

  const logoUrl = useMemo(() => normalizeSource(restaurant?.logo_url), [restaurant?.logo_url]);

  const backgroundImage = heroUrl || logoUrl || FALLBACK_PLACEHOLDER_SRC;
  const isFallback = !heroUrl;

  const focalX = restaurant?.menu_header_focal_x ?? 0.5;
  const focalY = restaurant?.menu_header_focal_y ?? 0.5;

  const primaryColor = normalizeSource(restaurant?.theme_primary_color) || '#111827';

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 text-white transition-opacity duration-200 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 scale-105 transform"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: `${focalX * 100}% ${focalY * 100}%`,
            filter: isFallback ? 'blur(12px) grayscale(100%)' : 'blur(0px)',
            transform: 'scale(1.05)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/35" />
      </div>

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-6 px-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border border-white/30 bg-white/10 shadow-lg shadow-black/40">
            <Image
              src={logoUrl || FALLBACK_PLACEHOLDER_SRC}
              alt={restaurant?.name || 'Restaurant logo'}
              fill
              sizes="120px"
              className={`${logoUrl ? '' : 'grayscale'} object-cover`}
              style={{ filter: logoUrl ? undefined : 'grayscale(100%) blur(0px)' }}
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{restaurant?.name || 'Restaurant'}</h1>
            {restaurant?.website_description ? (
              <p className="text-base text-white/80 sm:text-lg">{restaurant.website_description}</p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="w-full max-w-[280px] rounded-full px-8 text-lg font-semibold text-white shadow-xl shadow-black/30 transition focus:outline-none"
          style={{
            backgroundColor: primaryColor,
            minHeight: '64px',
          }}
        >
          Tap to Order
        </button>
      </div>
    </div>
  );
}
