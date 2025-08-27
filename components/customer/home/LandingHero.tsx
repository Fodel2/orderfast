import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/utils/supabaseClient';
import RestaurantLogo from '../../branding/RestaurantLogo';
import Button from '../../ui/Button';
import Skeleton from '../../ui/Skeleton';

function readableText(hex?: string | null) {
  if (!hex) return '#fff';
  const h = hex.replace('#', '');
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? '#000' : '#fff';
}
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
  const [primary, setPrimary] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!primary && typeof window !== 'undefined') {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim();
      if (v) setPrimary(v);
    }
  }, [primary]);

  const ctaText = readableText(primary);

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
    <section className="relative w-full min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-cover"
        style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
        aria-hidden="true"
      />

      {/* Centered content */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="flex flex-col items-center text-center gap-3 sm:gap-4 md:gap-5">
          <div className="p-1">
            <RestaurantLogo
              src={logoUrl ?? undefined}
              alt={title}
              shape={logoShape ?? 'round'}
              size={72}
              className="object-contain ring-0 border-0 shadow-none"
            />
          </div>

          <div className="relative max-w-[20rem] sm:max-w-[24rem] w-auto mx-auto">
            <div
              className="absolute -inset-2 sm:-inset-3 rounded-2xl bg-black/12 md:bg-black/10 backdrop-blur-lg shadow-md"
              aria-hidden="true"
            ></div>
            <div className="relative flex flex-col items-center text-center gap-3 sm:gap-4 px-4 py-3 sm:px-5 sm:py-4">
              <h1 className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)] text-2xl sm:text-3xl font-semibold leading-tight">
                {title}
              </h1>
              {subtitle ? (
                <p className="text-white/90 text-sm sm:text-base leading-relaxed line-clamp-2 max-w-prose">
                  {subtitle}
                </p>
              ) : null}
              {open !== null && (
                <span
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium shadow-sm"
                  style={{
                    backgroundColor: 'var(--brand-secondary, rgba(255,255,255,0.18))',
                    color: '#fff',
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: open ? '#22c55e' : '#ef4444' }}
                  />
                  {open ? 'Open' : 'Closed'}
                </span>
              )}
              <Link href={ctaHref} aria-label="Order Now" className="relative">
                <Button
                  className="rounded-full px-5 py-2 sm:px-6 sm:py-2.5 text-sm sm:text-base font-medium tracking-tight shadow-md hover:shadow-lg transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.99] border-0 focus:outline-none focus:ring-2 focus:ring-white/40"
                  style={{
                    backgroundColor: primary || 'var(--brand-primary, #111827)',
                    color: ctaText,
                    borderColor: 'transparent',
                  }}
                >
                  {ctaLabel}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Skeleton fallback if no image */}
      {!imageUrl && <Skeleton className="absolute inset-0" />}
    </section>
  );
}
