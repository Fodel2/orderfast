import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Home, Utensils, ShoppingCart, ListOrdered, Menu } from 'lucide-react';

export default function BottomNavBar({ cartCount = 0 }: { cartCount?: number }) {
  const router = useRouter();
  const { restaurant_id } = router.query || {};
  const restaurantId =
    typeof restaurant_id === 'string'
      ? restaurant_id
      : Array.isArray(restaurant_id)
      ? restaurant_id[0]
      : '';

  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 10 || currentY < lastScrollY) {
        setShowNav(true);
      } else {
        setShowNav(false);
      }
      setLastScrollY(currentY);
    };

    // only track scroll on mobile
    if (window.innerWidth < 768) {
      window.addEventListener('scroll', handleScroll);
    }
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const buildPath = (slug: string) => {
    const base = '/restaurant';
    if (slug === '/') return `${base}?restaurant_id=${restaurantId}`;
    const normalized = slug.startsWith('/') ? slug : `/${slug}`;
    return `${base}${normalized}?restaurant_id=${restaurantId}`;
  };

  const isActive = (slug: string) => {
    const current = (router.asPath || '').split('?')[0];
    const check = slug === '/' ? '/restaurant' : `/restaurant${slug.startsWith('/') ? slug : `/${slug}`}`;
    return current === check;
  };

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: 'menu', icon: Utensils, label: 'Menu' },
    { href: 'orders', icon: ListOrdered, label: 'Orders' },
    { href: 'more', icon: Menu, label: 'More' },
  ];

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-50 md:hidden transition-all duration-300 ${showNav ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-24'}`}
    >
      <div className="relative flex items-center justify-between bg-white/60 backdrop-blur-md border border-gray-300 rounded-full px-4 py-2 shadow-lg">
        {navItems.slice(0, 2).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={buildPath(item.href)}
              className={`flex flex-col items-center text-xs transition-transform duration-200 ${
                isActive(item.href)
                  ? 'text-black font-semibold scale-105'
                  : 'text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {item.label}
            </Link>
          );
        })}

        {/* Center Cart Button */}
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
          <Link
            href={buildPath('cart')}
            className={`relative bg-black text-white rounded-full w-16 h-16 flex items-center justify-center shadow-xl border-4 border-white transition-transform hover:scale-105 ${
              cartCount > 0 ? 'animate-pulse' : ''
            }`}
          >
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>

        {navItems.slice(2).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={buildPath(item.href)}
              className={`flex flex-col items-center text-xs transition-transform duration-200 ${
                isActive(item.href)
                  ? 'text-black font-semibold scale-105'
                  : 'text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
