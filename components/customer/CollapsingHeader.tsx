// slides: header (single shared logo that moves from hero center to slim header)
import React from 'react';
import Logo from '@/components/branding/Logo';
import { useBrand } from '@/components/branding/BrandProvider';

export default function CollapsingHeader({ heroInView }: { heroInView: boolean }) {
  const { name } = useBrand();
  const headerVisible = !heroInView;

  return (
    <>
      {/* Slim header shell — height 0 on hero (no white bar) */}
      <div
        aria-label="Brand header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          height: headerVisible ? 56 : 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: headerVisible ? '8px 16px' : '0px 16px',
          background: headerVisible ? 'color-mix(in oklab, var(--brand) 18%, white)' : 'transparent',
          backdropFilter: headerVisible ? 'saturate(180%) blur(8px)' : 'none',
          boxShadow: headerVisible ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
          transition:
            'height 240ms ease, background 220ms ease, box-shadow 220ms ease, padding 200ms ease',
        }}
      >
        <div
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 200ms ease, transform 200ms ease',
            fontWeight: 700,
          }}
        >
          {name}
        </div>
      </div>

      {/* SINGLE shared logo: centered on hero at ~34vh; docks to header-left after scroll */}
      <div
        style={{
          position: 'fixed',
          zIndex: 30,
          top: heroInView ? 'var(--hero-logo-top, 34vh)' : 12,
          left: heroInView ? '50vw' : 16,
          transform: heroInView
            ? 'translate(-50%, -50%) scale(1.6)'
            : 'translate(0,0) scale(1)',
          transformOrigin: 'left center',
          transition:
            'top 320ms cubic-bezier(.2,.7,.2,1), left 320ms cubic-bezier(.2,.7,.2,1), transform 320ms cubic-bezier(.2,.7,.2,1)',
          pointerEvents: 'none',
        }}
      >
        <Logo size={heroInView ? 56 : 32} />
      </div>
    </>
  );
}
