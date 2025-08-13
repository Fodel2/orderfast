import React from 'react';

/** Plate with tongue (brand-aware). Uses currentColor for outlines and var(--brand) for the tongue. */
export default function PlateLick({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Plate"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>{`
          .stroke { stroke: currentColor; stroke-width: 3; fill: none; }
          .tongue { fill: var(--brand, #16a34a); }
        `}</style>
      </defs>
      {/* outer plate */}
      <circle cx="32" cy="32" r="28" className="stroke" />
      {/* inner rim */}
      <circle cx="32" cy="32" r="20" className="stroke" />
      {/* tongue (accent) */}
      <path className="tongue" d="M45 40c0 6-5 11-11 11s-11-5-11-11c0-1.2 1.1-2 2.2-1.6 2.7.9 5.7 1.4 8.8 1.4s6.1-.5 8.8-1.4c1.1-.4 2.2.4 2.2 1.6Z" />
      {/* smile */}
      <path d="M21 36c3.2 2.4 7.1 3.8 11 3.8s7.8-1.4 11-3.8" className="stroke" strokeLinecap="round" />
    </svg>
  );
}

