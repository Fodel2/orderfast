import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/utils/supabaseClient';
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
  isOpen?: boolean; // optional open state
};

export default function LandingHero({
  title,
  subtitle,
  ctaLabel = 'Order Now',
  ctaHref = '/restaurant/menu',
  imageUrl,
  logoUrl,
  logoShape,
  isOpen,
}: LandingHeroProps) {
  const router = useRouter();
  const [open, setOpen] = useState<boolean | null>(typeof isOpen === 'boolean' ? isOpen : null);

  useEffect(() => {
    if (open !== null) return;
    const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
    const rid = pick(router.query.restaurant_id as any) || pick(router.query.id as any) || pick(router.query.r as any);
    if (!rid) return;
    supabase
      .from('restaurants')
      .select('is_open')
      .eq('id', rid)
      .maybeSingle()
      .then(({ data }) => {
        if (typeof data?.is_open === 'boolean') setOpen(data.is_open);
      });
  }, [open, router.query]);

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
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4 md:gap-5 max-w-md md:max-w-lg w-full">
          <RestaurantLogo
            src={logoUrl ?? undefined}
            alt={title}
            shape={logoShape ?? 'round'}
            size={72}
            className="ring-0 border-0 shadow-none"
          />

          {/* Text + CTA with overlay */}
          <div className="relative w-full">
            <div
              className="absolute -inset-3 sm:-inset-4 rounded-3xl bg-black/35 md:bg-black/30 backdrop-blur-md shadow-xl/20"
              aria-hidden="true"
            />
            <div className="relative flex flex-col items-center gap-3 sm:gap-4">
              <h1 className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)] text-2xl sm:text-3xl font-semibold leading-tight">
                {title}
              </h1>
              {subtitle ? (
                <p className="text-white/90 text-sm sm:text-base leading-relaxed max-w-prose">{subtitle}</p>
              ) : null}
              {open !== null && (
                <span
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--brand-secondary, rgba(255,255,255,0.15))',
                    color: 'white',
                  }}
                >
                  {open ? 'Open' : 'Closed'}
                </span>
              )}
              <Link href={ctaHref} aria-label="Order Now" className="relative">
                <Button
                  className="px-6 py-3 text-base sm:text-lg rounded-xl border-0"
                  style={{ backgroundColor: 'var(--brand-primary, #ff2eb8)' }}
                >
                  {ctaLabel}
                </Button>
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
