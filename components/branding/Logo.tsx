// slides/brand: added
import React from 'react';
import { useBrand } from './BrandProvider';

export default function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  const { logoUrl, initials, name } = useBrand();
  if (logoUrl) {
    return (
      <span className={className} style={{ display: 'inline-flex', width: size, height: size, borderRadius: '9999px', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={name} width={size} height={size} style={{ width: size, height: size, objectFit: 'cover' }} />
      </span>
    );
  }
  return (
    <span
      className={className}
      style={{
        width: size, height: size, borderRadius: '9999px',
        background: 'var(--brand)', color: 'white',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, letterSpacing: 0.5,
      }}
      aria-label={name}
      title={name}
    >
      {initials}
    </span>
  );
}

