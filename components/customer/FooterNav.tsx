import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, Utensils, ListOrdered, Menu } from 'lucide-react';
import PlateLick from '@/components/icons/PlateLick';
import React from 'react';
import { useRestaurant } from '@/lib/restaurant-context';

interface Props {
  cartCount?: number;
  hidden?: boolean;
}

function getRestaurantId(router: any): string | undefined {
  const qp = (router?.query ?? {}) as Record<string, unknown>;
  const pick = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const raw =
    pick(qp['restaurant_id']) ||
    pick(qp['id']) ||
    pick(qp['r']) ||
    undefined;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return trimmed;
}

export default function FooterNav({ cartCount = 0, hidden }: Props) {
  const router = useRouter();
  const { restaurantId } = useRestaurant();
  // capture restaurant id so navigation preserves context
  const rid = restaurantId || getRestaurantId(router);

  const current = (router.asPath || '').split('?')[0];

  // label for the middle action (UI copy only)
  const cartLabel = 'Plate';

  const NavLink = ({ href, Icon, label }: any) => (
    <Link
      href={{
        pathname: href === '/' ? '/restaurant' : `/restaurant/${href}`,
        query: rid ? { restaurant_id: rid } : {},
      }}
      className={`flex flex-col items-center justify-center text-xs transition-all ${
        current === (href === '/' ? '/restaurant' : `/restaurant/${href}`)
          ? 'nav-active'
          : 'text-[var(--muted)]'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="mt-0.5">{label}</span>
    </Link>
  );

  const style = {
    opacity: hidden ? 0 : 1,
    transition: 'opacity 0.6s',
    pointerEvents: hidden ? 'none' : 'auto',
  } as React.CSSProperties;

  return (
    <nav
      role="navigation"
      className="fixed bottom-2 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] md:hidden z-40"
      style={style}
    >
      <div className="relative brand-glass rounded-2xl h-14 flex items-center justify-around px-4">
        <NavLink href="/" Icon={Home} label="Home" />
        <NavLink href="menu" Icon={Utensils} label="Menu" />
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
          <Link
            href={{ pathname: '/restaurant/cart', query: rid ? { restaurant_id: rid } : {} }}
            aria-label={cartLabel}
            title={cartLabel}
            className="relative w-14 h-14 rounded-full fab flex items-center justify-center shadow-lg"
          >
            <PlateLick size={22} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
        <NavLink href="orders" Icon={ListOrdered} label="Orders" />
        <NavLink href="more" Icon={Menu} label="More" />
      </div>
    </nav>
  );
}
