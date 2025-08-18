import React from 'react';
import { useEffect, useState } from 'react';

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
  logoUrl,
  accentHex,
  focalX,
  focalY,
}: MenuHeaderProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

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

    return (
      <section
        aria-label="Restaurant header"
        className={[
          'relative w-full overflow-hidden rounded-2xl',
          'transition-all duration-500 ease-out will-change-transform will-change-opacity',
          collapsed ? 'h-20 md:h-24 mt-2' : 'h-48 md:h-80 mt-0',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
        ].join(' ')}
      >
      {/* Background image/gradient */}
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
      {/* Overlay for contrast */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: overlay }}
      />
      {/* Optional faint watermark logo */}
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          className="absolute right-4 bottom-4 h-8 w-8 md:h-10 md:w-10 opacity-60 blur-[0.2px]"
        />
      ) : null}
      {/* Foreground content */}
      <div className="relative h-full w-full px-4 md:px-6 flex items-end">
        <div className="pb-3 md:pb-4">
          <div className={[
            'inline-flex items-center rounded-full backdrop-blur-sm',
            'bg-white/40 text-gray-800',
            'px-2.5 py-0.5 text-xs font-medium shadow-sm',
            'transition-opacity duration-300',
            collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100',
          ].join(' ')}>
            Menu
          </div>
          <h1
            className={[
              'mt-1 font-semibold text-gray-900 drop-shadow-sm',
              'transition-transform duration-300',
              collapsed ? 'text-lg md:text-xl translate-y-0' : 'text-2xl md:text-4xl translate-y-[1px]',
            ].join(' ')}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className={[
              'text-gray-700/90 transition-opacity duration-300',
              collapsed ? 'opacity-0 h-0 -mt-1 overflow-hidden' : 'opacity-100 text-sm md:text-base',
            ].join(' ')}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

