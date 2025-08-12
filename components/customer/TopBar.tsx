import React from 'react';
import Logo from '../branding/Logo';
import { useBrand } from '../branding/BrandProvider';

interface Props {
  hidden?: boolean;
}

export default function TopBar({ hidden }: Props) {
  const { name } = useBrand();
  if (hidden) return null;
  return (
    <header className="brand-glass fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40">
      <Logo size={28} />
      <span className="ml-2 font-medium truncate" data-testid="header-name">{name}</span>
    </header>
  );
}
