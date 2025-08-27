import React from 'react';
import { useBrand } from '../branding/BrandProvider';
import Skeleton from '../ui/Skeleton';

interface Props {
  hidden?: boolean;
  restaurant?: any | null;
}

export default function TopBar({ hidden, restaurant }: Props) {
  const { name } = useBrand();
  if (hidden) return null;
  const title = restaurant?.website_title || restaurant?.name || name;
  const shape = restaurant?.logo_shape || 'round';
  const logoUrl = restaurant?.logo_url ?? null;
  const loading = !restaurant;

  const dims =
    shape === 'rectangular'
      ? 'h-8 sm:h-10 w-[3.2rem] sm:w-[4rem]'
      : 'h-8 w-8 sm:h-10 sm:w-10';
  const rounding =
    shape === 'round'
      ? 'rounded-full'
      : shape === 'square'
      ? 'rounded-lg'
      : 'rounded-md';
  const wrapper = `${dims} ${rounding} overflow-visible p-0.5`;
  return (
    <header className="brand-glass fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40">
      {loading ? (
        <Skeleton className={wrapper.replace('overflow-visible p-0.5', '')} />
      ) : (
        <div className={wrapper}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={title}
              className={`h-full w-full object-contain ${rounding}`}
            />
          ) : null}
        </div>
      )}
      {loading ? (
        <Skeleton className="ml-2 h-5 w-40 rounded-md" />
      ) : (
        <span className="ml-2 font-medium truncate" data-testid="header-name">
          {title}
        </span>
      )}
    </header>
  );
}
