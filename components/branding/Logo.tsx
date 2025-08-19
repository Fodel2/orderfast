// slides/brand: added
import React from 'react';
import { useBrand } from './BrandProvider';

export default function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  const { logoUrl, initials, name, logoShape } = useBrand();
  const radius = logoShape === 'round' ? '9999px' : '0px';
  const width = logoShape === 'rectangular' ? size * 1.6 : size;
  const height = size;
  if (logoUrl) {
    return (
      <span
        className={className}
        style={{ display: 'inline-flex', width, height, borderRadius: radius, overflow: 'hidden' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={name} width={width} height={height} style={{ width, height, objectFit: 'cover' }} />
      </span>
    );
  }
  return (
    <span
      className={className}
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'var(--brand)',
        color: 'white',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        letterSpacing: 0.5,
      }}
      aria-label={name}
      title={name}
    >
      {initials}
    </span>
  );
}
