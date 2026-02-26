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

function navLinkClass(current: string, href: string, disabled: boolean) {
  const targetPath = href === '/' ? '/restaurant' : `/restaurant/${href}`;
  return `flex flex-col items-center justify-center text-xs transition-all ${
    current === targetPath ? 'nav-active' : 'text-[var(--muted)]'
  } ${disabled ? 'opacity-50 pointer-events-none' : ''}`;
}

export default function FooterNav({ cartCount = 0, hidden }: Props) {
  const router = useRouter();
  const { restaurantId } = useRestaurant();
  // capture restaurant id so navigation preserves context
  const rid = restaurantId || getRestaurantId(router);

  const current = (router.asPath || '').split('?')[0];

  // label for the middle action (UI copy only)
  const cartLabel = 'Plate';

  const NavLink = ({ href, Icon, label }: any) => {
    if (!rid) {
      return (
        <button type="button" className={navLinkClass(current, href, true)} disabled aria-disabled="true">
          <Icon className="w-5 h-5" />
          <span className="mt-0.5">{label}</span>
        </button>
      );
    }

    return (
      <Link
        href={{
          pathname: href === '/' ? '/restaurant' : `/restaurant/${href}`,
          query: { restaurant_id: rid },
        }}
        className={navLinkClass(current, href, false)}
      >
        <Icon className="w-5 h-5" />
        <span className="mt-0.5">{label}</span>
      </Link>
    );
  };

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
          {rid ? (
            <Link
              href={{ pathname: '/restaurant/cart', query: { restaurant_id: rid } }}
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
          ) : (
            <button
              type="button"
              aria-label={cartLabel}
              title={cartLabel}
              className="relative w-14 h-14 rounded-full fab flex items-center justify-center shadow-lg opacity-50 pointer-events-none"
              disabled
              aria-disabled="true"
            >
              <PlateLick size={22} />
            </button>
          )}
        </div>
        <NavLink href="orders" Icon={ListOrdered} label="Orders" />
        <NavLink href="more" Icon={Menu} label="More" />
      </div>
    </nav>
  );
}
