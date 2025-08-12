// slides: header
import React from 'react';
import Logo from '@/components/branding/Logo';
import { useBrand } from '@/components/branding/BrandProvider';

export default function CollapsingHeader({ compact }: { compact: boolean }) {
  const { name } = useBrand();
  return (
    <div
      aria-label="Brand header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        backdropFilter: 'saturate(180%) blur(8px)',
        background: compact ? 'color-mix(in oklab, var(--brand) 18%, white)' : 'transparent',
        boxShadow: compact ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
        transition: 'background 220ms ease, box-shadow 220ms ease',
      }}
    >
      <div
        style={{
          transform: compact ? 'translateX(0) scale(1)' : 'translateX(calc(50vw - 36px)) scale(1.7)',
          transformOrigin: 'left center',
          transition: 'transform 320ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <Logo size={32} />
      </div>
      <div
        style={{
          opacity: compact ? 1 : 0,
          transform: compact ? 'translateY(0px)' : 'translateY(6px)',
          transition: 'opacity 220ms ease, transform 220ms ease',
          fontWeight: 700,
        }}
      >
        {name}
      </div>
    </div>
  );
}
