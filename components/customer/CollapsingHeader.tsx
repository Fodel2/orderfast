// slides: header (single shared logo that moves from hero center to slim header)
import React from 'react';
import Logo from '@/components/branding/Logo';
import { useBrand } from '@/components/branding/BrandProvider';

export default function CollapsingHeader({ heroInView }: { heroInView: boolean }) {
  const { name } = useBrand();

  // Header shell only shows AFTER hero; while hero is visible, the shell is transparent/invisible.
  // The Logo element is ONE node that we position/transform between center-of-hero and top-left header.
  return (
    <>
      {/* Slim header shell (becomes visible only after hero) */}
      <div
        aria-label="Brand header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          backdropFilter: heroInView ? 'none' : 'saturate(180%) blur(8px)',
          background: heroInView ? 'transparent' : 'color-mix(in oklab, var(--brand) 18%, white)',
          boxShadow: heroInView ? 'none' : '0 2px 12px rgba(0,0,0,0.08)',
          transition: 'background 220ms ease, box-shadow 220ms ease',
        }}
      >
        {/* Title fades in only after hero */}
        <div
          style={{
            opacity: heroInView ? 0 : 1,
            transform: heroInView ? 'translateY(6px)' : 'translateY(0)',
            transition: 'opacity 220ms ease, transform 220ms ease',
            fontWeight: 700,
          }}
        >
          {name}
        </div>
      </div>

      {/* SINGLE shared logo element — visually centered on hero, then animates to header-left */}
      <div
        style={{
          position: 'fixed',
          zIndex: 30,
          // Center over hero vs. dock to header
          top: heroInView ? '50vh' : 12,
          left: heroInView ? '50vw' : 16,
          transform: heroInView ? 'translate(-50%, -50%) scale(1.6)' : 'translate(0,0) scale(1)',
          transformOrigin: 'left center',
          transition: 'top 300ms cubic-bezier(.2,.7,.2,1), left 300ms cubic-bezier(.2,.7,.2,1), transform 300ms cubic-bezier(.2,.7,.2,1)',
          pointerEvents: 'none',
        }}
      >
        <Logo size={heroInView ? 48 : 32} />
      </div>
    </>
  );
}
