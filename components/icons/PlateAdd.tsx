import React from 'react';

export default function PlateAdd({ size = 28, className = '' }: { size?: number; className?: string }) {
  const s = size;
  const br = Math.round(size * 0.36); // badge radius
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Add to Plate"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>{`
          .stroke{stroke:currentColor;stroke-width:3;fill:none}
          .tongue{fill:var(--brand,#16a34a)}
          .badge{fill:var(--brand,#16a34a)}
          .badgePlus{stroke:#fff;stroke-width:3;stroke-linecap:round}
        `}</style>
      </defs>
      <circle cx="32" cy="32" r="28" className="stroke"/>
      <circle cx="32" cy="32" r="20" className="stroke"/>
      <path className="tongue" d="M45 40c0 6-5 11-11 11s-11-5-11-11c0-1.2 1.1-2 2.2-1.6 2.7.9 5.7 1.4 8.8 1.4s6.1-.5 8.8-1.4c1.1-.4 2.2.4 2.2 1.6Z"/>
      <path d="M21 36c3.2 2.4 7.1 3.8 11 3.8s7.8-1.4 11-3.8" className="stroke" strokeLinecap="round"/>
      {/* plus badge */}
      <g transform="translate(42,42)">
        <circle r={br} className="badge"/>
        <path d="M-6 0h12M0 -6v12" className="badgePlus"/>
      </g>
    </svg>
  );
}
