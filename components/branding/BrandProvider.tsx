// slides/brand: added
import React, { createContext, useContext, useMemo } from 'react';
import { useRouter } from 'next/router';

type BrandCtx = {
  brand: string;
  brand600: string;
  brand700: string;
  name: string;
  initials: string;
  logoUrl?: string | null;
  logoShape?: string | null;
};
const Ctx = createContext<BrandCtx | null>(null);

const hashHSL = (name: string) => {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360, s = 86, l = 52;
  return {
    brand: `hsl(${hue} ${s}% ${l}%)`,
    brand600: `hsl(${hue} ${s}% ${Math.max(38, l - 14)}%)`,
    brand700: `hsl(${hue} ${s}% ${Math.max(30, l - 22)}%)`,
  };
};

export const useBrand = (): BrandCtx => {
  // SSR-safe default if provider is missing
  return React.useContext(Ctx) ?? { ...hashHSL('Restaurant'), name: 'Restaurant', initials: 'R', logoUrl: null };
};

export const BrandProvider: React.FC<{ restaurant?: any; children: React.ReactNode; }> = ({ restaurant, children }) => {
  const router = useRouter();
  const qp = (k: string) => (router?.query?.[k] as string) || '';
  const name = (restaurant?.website_title as string) || (restaurant?.name as string) || qp('name') || 'Restaurant';
  const logoUrl = (restaurant?.logo_url as string) || qp('logo') || null;
  const logoShape = (restaurant?.logo_shape as string) || null;
  const primary =
    (restaurant?.brand_primary_color as string) ||
    (restaurant?.brand_color as string) ||
    qp('brand') ||
    '';
  const secondary = (restaurant?.brand_secondary_color as string) || '';
  const colors = primary
    ? {
        brand: primary,
        brand600: secondary || primary,
        brand700: secondary || primary,
      }
    : hashHSL(name);
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'R';

  const value = useMemo(() => ({ ...colors, name, initials, logoUrl, logoShape }), [colors.brand, colors.brand600, colors.brand700, name, initials, logoUrl, logoShape]);

  return (
    <Ctx.Provider value={value}>
      <div
        data-brand-root
        style={{
          ['--brand' as any]: value.brand,
          ['--brand-600' as any]: value.brand600,
          ['--brand-700' as any]: value.brand700,
          ['--ink' as any]: '#111827',
          ['--surface' as any]: '#ffffff',
          ['--card' as any]: '#ffffff',
          ['--muted' as any]: '#6b7280',
        } as React.CSSProperties}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
};

export default BrandProvider;

