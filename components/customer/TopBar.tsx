import React from 'react';
import RestaurantLogo from '../branding/RestaurantLogo';
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
  return (
    <header className="brand-glass fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40">
      {loading ? (
        <RestaurantLogo isSkeleton size={28} shape="round" alt="" />
      ) : (
        <RestaurantLogo
          src={logoUrl || undefined}
          alt={title}
          shape={shape}
          size={28}
          loading="eager"
        />
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
