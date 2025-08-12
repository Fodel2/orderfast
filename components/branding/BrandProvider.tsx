// slides/brand: added
import React, { createContext, useContext, useMemo } from 'react';
import { useRouter } from 'next/router';

type BrandCtx = {
  brand: string; // e.g. hsl(330 90% 50%)
  brand600: string;
  brand700: string;
  name: string;
  initials: string;
  logoUrl?: string | null;
};
const BrandContext = createContext<BrandCtx | null>(null);
export const useBrand = () => {
  const v = useContext(BrandContext);
  if (!v) throw new Error('useBrand must be used within <BrandProvider>');
  return v;
};

function hsl(str: string) {
  // Simple stable hash → hue
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  // vivid but not neon
  const s = 86, l = 52;
  return {
    brand: `hsl(${hue} ${s}% ${l}%)`,
    brand600: `hsl(${hue} ${s}% ${Math.max(38, l - 14)}%)`,
    brand700: `hsl(${hue} ${s}% ${Math.max(30, l - 22)}%)`,
  };
}

export const BrandProvider: React.FC<{ restaurant?: any; children: React.ReactNode; }> = ({ restaurant, children }) => {
  const router = useRouter();
  const qp = (k: string) => (router?.query?.[k] as string) || '';

  const name = (restaurant?.name as string) || qp('name') || 'Restaurant';
  const logoUrl = (restaurant?.logo_url as string) || qp('logo') || null;
  const colorFromDb = (restaurant?.brand_color as string) || qp('brand') || '';

  const { brand, brand600, brand700 } = colorFromDb
    ? { brand: colorFromDb, brand600: colorFromDb, brand700: colorFromDb }
    : hsl(name);

  const initials = (name || 'R')
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const value = useMemo(() => ({ brand, brand600, brand700, name, initials, logoUrl }), [brand, brand600, brand700, name, initials, logoUrl]);

  return (
    <BrandContext.Provider value={value}>
      <div
        data-brand-root
        style={{
          // Core design tokens
          // buttons/badges/FAB/active nav use these
          // ink/surface/card/muted keep sensible defaults
          ['--brand' as any]: brand,
          ['--brand-600' as any]: brand600,
          ['--brand-700' as any]: brand700,
          ['--ink' as any]: '#111827',
          ['--surface' as any]: '#ffffff',
          ['--card' as any]: '#ffffff',
          ['--muted' as any]: '#6b7280',
        } as React.CSSProperties}
      >
        {children}
      </div>
    </BrandContext.Provider>
  );
};

export default BrandProvider;

