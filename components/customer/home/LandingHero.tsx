import React, { useEffect, useState } from 'react';
import Skeleton from '../../ui/Skeleton';

type LandingHeroProps = {
  title: string;
  subtitle?: string | null;
  isOpen?: boolean;
  ctaLabel?: string;
  onCta?: () => void;
  imageUrl?: string | null;    // optional background image
  logoUrl?: string | null;     // avatar/logo
  accentHex?: string | null;   // brand accent for overlay, rings
};

export default function LandingHero({
  title,
  subtitle,
  isOpen = true,
  ctaLabel = 'Order Now',
  onCta,
  imageUrl,
  logoUrl,
  accentHex,
}: LandingHeroProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const overlay =
    accentHex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accentHex)
      ? `linear-gradient(180deg, ${accentHex}26 0%, ${accentHex}10 40%, rgba(0,0,0,0.20) 100%)`
      : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.20))';

  return (
    <section
      aria-label="Restaurant hero"
      className={[
        'relative w-full overflow-hidden',
        'min-h-screen',
        'rounded-none md:rounded-3xl',
        'transition-all duration-500 ease-out',
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      ].join(' ')}
      style={{ minHeight: '100svh' }}
    >
      {/* Background */}
      <div
        className="absolute inset-0 bg-center bg-cover"
        style={
          imageUrl
            ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        {!imageUrl && <Skeleton className="w-full h-full rounded-none" />}
      </div>
      {/* Overlay for contrast */}
      <div className="absolute inset-0" style={{ backgroundImage: overlay }} />

      {/* Content */}
      <div className="relative z-10 flex min-h-full flex-col items-center justify-center text-center px-6 py-16 md:py-20">
        {/* Avatar */}
        <div className="relative">
          <div
            className={[
              'h-24 w-24 md:h-28 md:w-28 rounded-full flex items-center justify-center',
              'bg-white/60 backdrop-blur-sm shadow-sm',
              'ring-4',
            ].join(' ')}
            style={{ ['--tw-ring-color' as any]: accentHex || 'white' } as React.CSSProperties}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-20 w-20 md:h-24 md:w-24 rounded-full object-cover" />
            ) : (
              <span className="text-xl md:text-2xl font-bold text-white">R</span>
            )}
          </div>
        </div>

        {/* Title */}
        <h1 className="mt-6 text-4xl md:text-6xl font-extrabold tracking-tight text-white drop-shadow-sm">
          {title}
        </h1>
        {/* Subtitle */}
        {subtitle ? (
          <p className="mt-3 max-w-xl text-base md:text-lg text-white/90">
            {subtitle}
          </p>
        ) : null}

        {/* Open pill */}
        <div className="mt-4">
          <span
            className={[
              'inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium',
              isOpen ? 'bg-white/80 text-gray-800' : 'bg-black/40 text-white'
            ].join(' ')}
          >
            <span
              className={[
                'h-2.5 w-2.5 rounded-full',
                isOpen ? 'bg-green-500' : 'bg-red-500'
              ].join(' ')}
            />
            {isOpen ? 'Open' : 'Closed'}
          </span>
        </div>

        {/* CTA */}
        <div className="mt-6">
          <button
            type="button"
            onClick={onCta}
            className={[
              'px-6 md:px-7 py-3 md:py-3.5 rounded-full text-base md:text-lg font-semibold',
              'text-white shadow-lg transition-transform duration-200 ease-out',
              'hover:scale-[1.03] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            ].join(' ')}
            style={{
              backgroundColor: accentHex || '#111827',
              ['--tw-ring-color' as any]: accentHex || '#ffffff'
            } as React.CSSProperties}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

