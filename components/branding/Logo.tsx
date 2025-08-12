import React from 'react';
import Image from 'next/image';
import { useBrand } from './BrandProvider';

interface Props {
  size?: number;
  className?: string;
  ariaLabel?: string;
}

export default function Logo({ size = 32, className = '', ariaLabel }: Props) {
  const { logoUrl, name, initials } = useBrand();
  const label = ariaLabel || name;
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={label}
        width={size}
        height={size}
        className={`object-cover rounded-full ${className}`}
      />
    );
  }
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: size * 0.5,
  };
  return (
    <div
      aria-label={label}
      className={`rounded-full bg-[var(--brand)] text-white flex items-center justify-center font-semibold ${className}`}
      style={style}
    >
      {initials}
    </div>
  );
}
