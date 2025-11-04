import { memo } from 'react';
import { PlateIconShapes } from '@/components/icons/PlateIcon';

function PlateAdd({ size = 28, className = '' }: { size?: number; className?: string }) {
  const badgeRadius = Math.round((size / 64) * 23);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Add to Plate"
      xmlns="http://www.w3.org/2000/svg"
    >
      <PlateIconShapes accentFallback="#16a34a" />
      <g transform="translate(44,44)">
        <circle r={badgeRadius} fill="var(--brand, #16a34a)" />
        <path d="M-7 0h14M0 -7v14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default memo(PlateAdd);
