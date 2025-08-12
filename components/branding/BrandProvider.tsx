import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';

interface RestaurantLite {
  id: string | number;
  name: string;
  logo_url?: string | null;
  brand_color?: string | null;
  accent_color?: string | null;
}

interface BrandTheme {
  brand: string;
  brand600: string;
  brand700: string;
  ink: string;
  surface: string;
  card: string;
  muted: string;
  logoUrl?: string | null;
  name: string;
  initials: string;
}

const BrandContext = createContext<BrandTheme>({
  brand: 'hsl(20 90% 50%)',
  brand600: 'hsl(20 90% 45%)',
  brand700: 'hsl(20 90% 40%)',
  ink: 'hsl(230 15% 12%)',
  surface: 'hsl(0 0% 98%)',
  card: 'hsl(0 0% 100% / 0.7)',
  muted: 'hsl(230 10% 46%)',
  logoUrl: null,
  name: 'Restaurant',
  initials: 'R',
});

export function useBrand() {
  return useContext(BrandContext);
}

function hashBrand(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 50%)`;
}

function shade(color: string, lOffset: number) {
  if (color.startsWith('#')) {
    const hsl = `hsl(${parseInt(color.slice(1),16)%360} 70% 50%)`;
    color = hsl;
  }
  const match = /hsl\((\d+),?\s*(\d+)%?,?\s*(\d+)%?\)/i.exec(color);
  if (!match) return color;
  const h = Number(match[1]);
  const s = Number(match[2]);
  const l = Number(match[3]) + lOffset;
  return `hsl(${h} ${s}% ${Math.max(0, Math.min(100, l))}%)`;
}

export default function BrandProvider({
  children,
  restaurant,
}: {
  children: React.ReactNode;
  restaurant?: RestaurantLite | null;
}) {
  const router = useRouter();
  const [rest, setRest] = useState<RestaurantLite | null | undefined>(restaurant);

  useEffect(() => {
    if (rest || !router.isReady) return;
    const ridRaw = router.query.restaurant_id;
    const rid = Array.isArray(ridRaw) ? ridRaw[0] : ridRaw;
    if (!rid) return;
    supabase
      .from('restaurants')
      .select('id,name,logo_url,brand_color,accent_color')
      .eq('id', rid)
      .maybeSingle()
      .then(({ data }) => setRest(data));
  }, [rest, router.isReady, router.query]);

  const queryBrand = (() => {
    const qb = router.query.brand;
    return typeof qb === 'string' ? qb : undefined;
  })();

  const queryLogo = (() => {
    const ql = router.query.logo;
    return typeof ql === 'string' ? ql : undefined;
  })();

  const queryName = (() => {
    const qn = router.query.name;
    return typeof qn === 'string' ? qn : undefined;
  })();

  const theme = useMemo(() => {
    const name = rest?.name || queryName || 'Restaurant';
    const brandBase =
      rest?.brand_color || rest?.accent_color || queryBrand || hashBrand(name);
    const logo = rest?.logo_url || queryLogo || null;
    const initials = name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    return {
      brand: brandBase,
      brand600: shade(brandBase, -5),
      brand700: shade(brandBase, -10),
      ink: 'var(--ink)',
      surface: 'var(--surface)',
      card: 'var(--card)',
      muted: 'var(--muted)',
      logoUrl: logo,
      name,
      initials,
    } as BrandTheme;
  }, [rest, queryBrand, queryLogo, queryName]);

  const styleVars: React.CSSProperties = {
    '--brand': theme.brand,
    '--brand-600': theme.brand600,
    '--brand-700': theme.brand700,
    '--ink': 'hsl(230 15% 12%)',
    '--surface': 'hsl(0 0% 98%)',
    '--card': 'hsl(0 0% 100% / 0.7)',
    '--muted': 'hsl(230 10% 46%)',
  } as any;

  return (
    <BrandContext.Provider value={theme}>
      <div data-brand style={styleVars}>
        {children}
      </div>
    </BrandContext.Provider>
  );
}
