import React from 'react';
import Link from 'next/link';
import RestaurantLogo from '../../branding/RestaurantLogo';
import Button from '../../ui/Button';
import Skeleton from '../../ui/Skeleton';

type LandingHeroProps = {
  title: string;
  subtitle?: string | null;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string | null; // optional background image
  logoUrl?: string | null; // avatar/logo
  logoShape?: 'square' | 'round' | 'rectangular' | null;
};

export default function LandingHero({
  title,
  subtitle,
  ctaLabel = 'Order Now',
  ctaHref = '/restaurant/menu',
  imageUrl,
  logoUrl,
  logoShape,
}: LandingHeroProps) {
  return (
    <section className="relative w-full min-h-[70vh] sm:min-h-[80vh] overflow-hidden rounded-2xl">
      <div
        className="absolute inset-0 bg-center bg-cover"
        style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
        aria-hidden="true"
      />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/15 via-black/10 to-black/20" />

      {/* Centered content */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="flex flex-col items-center text-center gap-4 sm:gap-5 max-w-md w-full">
          <RestaurantLogo
            src={logoUrl ?? undefined}
            alt={title}
            shape={logoShape ?? 'round'}
            size={72}
            className="shadow-none ring-0 border-0"
          />

          {/* Text + CTA with overlay */}
          <div className="relative w-full">
            <div
              className="absolute -inset-3 sm:-inset-4 rounded-2xl bg-black/45 backdrop-blur-sm"
              aria-hidden="true"
            />
            <div className="relative flex flex-col items-center gap-3 sm:gap-4">
              <h1 className="text-white text-2xl sm:text-3xl font-semibold leading-tight">{title}</h1>
              {subtitle ? (
                <p className="text-white/90 text-sm sm:text-base leading-relaxed max-w-prose">{subtitle}</p>
              ) : null}
              <Link href={ctaHref} aria-label="Order Now" className="relative">
                <Button className="px-6 py-3 text-base sm:text-lg rounded-xl">{ctaLabel}</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Skeleton fallback if no image */}
      {!imageUrl && <Skeleton className="absolute inset-0 rounded-2xl" />}
    </section>
  );
}

