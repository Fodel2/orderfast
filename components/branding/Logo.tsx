// slides/brand: added
import React from 'react';
import { useBrand } from './BrandProvider';

export default function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  const { logoUrl, initials, name, logoShape } = useBrand();
  const radiusClass = logoShape === 'round' ? 'rounded-full' : '';
  const boxStyle = { width: size, height: size, padding: 2 } as React.CSSProperties;

  if (logoUrl) {
    return (
      <span className={`${className} inline-flex overflow-visible ${radiusClass}`} style={boxStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={name} className="w-full h-full object-contain" />
      </span>
    );
  }

  return (
    <span
      className={`${className} inline-flex items-center justify-center font-bold ${radiusClass}`}
      style={{
        ...boxStyle,
        background: 'var(--brand)',
        color: 'white',
        letterSpacing: 0.5,
      }}
      aria-label={name}
      title={name}
    >
      {initials}
    </span>
  );
}
