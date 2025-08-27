import React, { useEffect, useState } from 'react';
import { useBrand } from '@/components/branding/BrandProvider';

type MenuHeaderProps = {
  title: string;
  subtitle?: string | null;
  imageUrl?: string;         // header/hero image (optional)
  logoUrl?: string | null;   // optional watermark/logo
  accentHex?: string | null; // optional brand accent for overlay
  focalX?: number | null;
  focalY?: number | null;
};

export default function MenuHeader({
  title,
  subtitle,
  imageUrl,
  logoUrl, // eslint-disable-line @typescript-eslint/no-unused-vars
  accentHex,
  focalX,
  focalY,
}: MenuHeaderProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const brand = useBrand();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setCollapsed(window.scrollY > 48);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const overlay =
    accentHex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accentHex)
      ? `linear-gradient(180deg, ${accentHex}22, ${accentHex}11, #00000022)`
      : 'linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.06), rgba(0,0,0,0.08))';

  const finalTitle = brand?.name || title;
  const finalSubtitle = subtitle ?? '';

  return (
    <section
      aria-label="Restaurant header"
      className={[
        'relative w-full overflow-hidden',
        'transition-all duration-500 ease-out will-change-transform will-change-opacity',
        collapsed ? 'h-20 md:h-24' : 'h-48 md:h-80',
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
      ].join(' ')}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            objectPosition: `${((focalX ?? 0.5) * 100).toFixed(2)}% ${((focalY ?? 0.5) * 100).toFixed(2)}%`,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200" />
      )}
      <div className="absolute inset-0" style={{ backgroundImage: overlay }} />
      <div className="relative h-full w-full flex items-end justify-center">
        <div className="pb-6 md:pb-8">
          <div className="relative max-w-[20rem] sm:max-w-[24rem] mx-auto text-center">
            <div
              className="absolute -inset-2 sm:-inset-3 rounded-2xl bg-black/12 md:bg-black/10 backdrop-blur-lg shadow-md"
              aria-hidden="true"
            />
            <div className="relative px-4 py-2 sm:px-5 sm:py-3 flex flex-col items-center text-center">
              <h1 className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)] text-xl sm:text-2xl font-semibold">
                {finalTitle}
              </h1>
              {finalSubtitle ? (
                <p className="mt-1 text-white/90 text-sm sm:text-base leading-relaxed line-clamp-2">
                  {finalSubtitle}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

