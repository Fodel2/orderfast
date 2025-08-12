import Image from 'next/image';
import React from 'react';
import { useBrandTheme } from './BrandProvider';

export default function CustomerHeader() {
  const { logoUrl, name } = useBrandTheme();
  const monogram = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'R';
  return (
    <header className="brand-glass fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40">
      {logoUrl ? (
        <Image src={logoUrl} alt={name || 'logo'} width={32} height={32} className="rounded-full object-cover" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-sm font-semibold">
          {monogram}
        </div>
      )}
      <span className="ml-2 font-medium truncate" data-testid="header-name">
        {name}
      </span>
    </header>
  );
}
