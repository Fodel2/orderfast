import Image from 'next/image';
import { useMemo } from 'react';
import { normalizeSource } from '@/lib/media/placeholders';

export type KioskRestaurant = {
  id: string;
  name?: string | null;
  website_title?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  kiosk_hero_image_url?: string | null;
  kiosk_hero_image_updated_at?: string | null;
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
  const kioskHero = useMemo(
    () => formatImageUrl(restaurant?.kiosk_hero_image_url, restaurant?.kiosk_hero_image_updated_at),
    [restaurant?.kiosk_hero_image_updated_at, restaurant?.kiosk_hero_image_url]
  );

  const coverHero = useMemo(() => formatImageUrl(restaurant?.cover_image_url), [restaurant?.cover_image_url]);

  const heroUrl = useMemo(() => {
    const menuHero = formatImageUrl(restaurant?.menu_header_image_url, restaurant?.menu_header_image_updated_at);
    return coverHero || kioskHero || menuHero || null;
  }, [coverHero, kioskHero, restaurant?.menu_header_image_updated_at, restaurant?.menu_header_image_url]);

  const logoUrl = useMemo(() => normalizeSource(restaurant?.logo_url), [restaurant?.logo_url]);

  const backgroundImage = heroUrl;

  const focalX = restaurant?.menu_header_focal_x ?? 0.5;
  const focalY = restaurant?.menu_header_focal_y ?? 0.5;

  const primaryColor = normalizeSource(restaurant?.theme_primary_color) || '#111827';

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-white text-neutral-900 transition-opacity duration-200 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
            backgroundColor: backgroundImage ? undefined : '#f8fafc',
            backgroundSize: 'cover',
            backgroundPosition: `${focalX * 100}% ${focalY * 100}%`,
          }}
        />
        <div className="kiosk-hero-dim" />
      </div>

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-6 px-6 text-center">
        <div className="w-full rounded-[32px] border border-neutral-200 bg-white/95 p-8 shadow-2xl shadow-neutral-300/50 backdrop-blur">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border border-neutral-200 bg-white shadow-lg shadow-neutral-200">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={restaurant?.name || 'Restaurant logo'}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-neutral-50 text-3xl font-semibold text-neutral-500">
                  {(restaurant?.name || 'R').slice(0, 1)}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold leading-tight text-neutral-900 sm:text-4xl">
                {restaurant?.website_title || restaurant?.name || 'Restaurant'}
              </h1>
              {restaurant?.website_description ? (
                <p className="text-base text-neutral-600 sm:text-lg">{restaurant.website_description}</p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onStart}
            className="mt-8 w-full max-w-[280px] rounded-full px-8 text-lg font-semibold text-white shadow-lg shadow-neutral-400 transition focus-visible:outline-none"
            style={{
              backgroundColor: primaryColor,
              minHeight: '64px',
            }}
          >
            Tap to Order
          </button>
        </div>
      </div>

      <style jsx>{`
        .kiosk-hero-dim {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.275);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
