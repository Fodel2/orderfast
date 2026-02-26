import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/utils/supabaseClient';
import Button from '../../ui/Button';
import Skeleton from '../../ui/Skeleton';

function readableText(color?: string | null) {
  if (!color) return '#111827';
  const c = color.trim();
  const rgbMatch = c.match(/rgb[a]?\(([^)]+)\)/i);
  const hslMatch = c.match(/hsl[a]?\(([^)]+)\)/i);
  let r: number, g: number, b: number, a = 1;

  if (hslMatch) {
    const parts = hslMatch[1]
      .replace('/', ',')
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((v) => v.replace('%', ''));
    const h = parseFloat(parts[0] || '0');
    const s = (parseFloat(parts[1] || '0') || 0) / 100;
    const l = (parseFloat(parts[2] || '0') || 0) / 100;
    a = isNaN(parseFloat(parts[3])) ? 1 : parseFloat(parts[3]);
    const cVal = (1 - Math.abs(2 * l - 1)) * s;
    const x = cVal * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - cVal / 2;
    const [r1, g1, b1] =
      h < 60
        ? [cVal, x, 0]
        : h < 120
        ? [x, cVal, 0]
        : h < 180
        ? [0, cVal, x]
        : h < 240
        ? [0, x, cVal]
        : h < 300
        ? [x, 0, cVal]
        : [cVal, 0, x];
    r = Math.round((r1 + m) * 255);
    g = Math.round((g1 + m) * 255);
    b = Math.round((b1 + m) * 255);
  } else if (rgbMatch) {
    const parts = rgbMatch[1]
      .replace('/', ',')
      .split(',')
      .map((v) => v.trim());
    r = parseFloat(parts[0] || '0');
    g = parseFloat(parts[1] || '0');
    b = parseFloat(parts[2] || '0');
    a = isNaN(parseFloat(parts[3])) ? 1 : parseFloat(parts[3]);
  } else {
    const h = c.replace('#', '');
    const hex =
      h.length === 3
        ? h
            .split('')
            .map((x) => x + x)
            .join('')
        : h.length === 4
        ? h
            .split('')
            .map((x) => x + x)
            .join('')
        : h;
    r = parseInt(hex.slice(0, 2) || '00', 16);
    g = parseInt(hex.slice(2, 4) || '00', 16);
    b = parseInt(hex.slice(4, 6) || '00', 16);
    if (hex.length >= 8) {
      a = parseInt(hex.slice(6, 8) || 'ff', 16) / 255;
    }
  }

  const alpha = Math.min(Math.max(isNaN(a) ? 1 : a, 0), 1);
  const blendedR = Math.round(r * alpha + 255 * (1 - alpha));
  const blendedG = Math.round(g * alpha + 255 * (1 - alpha));
  const blendedB = Math.round(b * alpha + 255 * (1 - alpha));
  const yiq = (blendedR * 299 + blendedG * 587 + blendedB * 114) / 1000;
  return yiq >= 145 ? '#111827' : '#ffffff';
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
  const [secondary, setSecondary] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!primary && typeof window !== 'undefined') {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim();
      if (v) setPrimary(v);
    }
  }, [primary]);

  useEffect(() => {
    if (!secondary && typeof window !== 'undefined') {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--brand-secondary').trim();
      if (v) setSecondary(v);
    }
  }, [secondary]);

  const ctaText = readableText(primary);
  const badgeBackground = secondary || 'rgba(255,255,255,0.18)';
  const badgeTextColor = readableText(badgeBackground);

  const shape = logoShape || 'round';
  const rounding =
    shape === 'round'
      ? 'rounded-full'
      : shape === 'square'
      ? 'rounded-lg'
      : 'rounded-md';
  const logoDims =
    shape === 'rectangular'
      ? { width: 72, height: 24 }
      : { width: 72, height: 72 };

  const pick = (v: string | string[] | undefined) => {
    const raw = Array.isArray(v) ? v[0] : v;
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
    return trimmed;
  };
  const routeRestaurantId =
    pick(router.query.restaurant_id as string | string[] | undefined) ||
    pick(router.query.id as string | string[] | undefined) ||
    pick(router.query.r as string | string[] | undefined);

  useEffect(() => {
    if (open !== null || !routeRestaurantId) return;
    let active = true;

    supabase
      .from('restaurants')
      .select('is_open')
      .eq('id', routeRestaurantId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (typeof data?.is_open === 'boolean') setOpen(data.is_open);
      });

    return () => {
      active = false;
    };
  }, [open, routeRestaurantId]);

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
          <div
            className={`relative overflow-visible p-0.5 ${rounding}`}
            style={{ width: logoDims.width, height: logoDims.height }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={title}
                className={`h-full w-full object-contain ${rounding}`}
              />
            ) : null}
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
                    backgroundColor: badgeBackground,
                    color: badgeTextColor,
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
