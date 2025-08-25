import React from 'react';
import Skeleton from '../ui/Skeleton';

export interface RestaurantLogoProps {
  src?: string | null;
  alt: string;
  shape?: 'square' | 'round' | 'rectangular' | null;
  size?: number;
  className?: string;
  loading?: 'eager' | 'lazy';
  isSkeleton?: boolean;
}

export default function RestaurantLogo({
  src,
  alt,
  shape = 'round',
  size = 28,
  className = '',
  loading = 'lazy',
  isSkeleton,
}: RestaurantLogoProps) {
  const finalShape = shape || 'round';
  const rounded =
    finalShape === 'round'
      ? 'rounded-full'
      : finalShape === 'square'
      ? 'rounded-lg'
      : 'rounded-md';

  if (isSkeleton || !src) {
    if (finalShape === 'rectangular') {
      return <Skeleton className={`w-[72px] h-[24px] ${rounded} ${className}`.trim()} />;
    }
    return <Skeleton className={`${rounded} ${className}`.trim()} style={{ width: size, height: size }} />;
  }

  const dimensions =
    finalShape === 'rectangular' ? { width: 72, height: 24 } : { width: size, height: size };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={loading}
      width={dimensions.width}
      height={dimensions.height}
      className={`${rounded} object-contain ${className}`.trim()}
      style={dimensions}
    />
  );
}
