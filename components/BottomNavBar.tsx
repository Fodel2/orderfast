import Link from 'next/link';
import { useRouter } from 'next/router';
import { Home, Utensils, ListOrdered, Menu, ShoppingCart } from 'lucide-react';

export default function BottomNavBar({ cartCount = 0 }: { cartCount?: number }) {
  const router = useRouter();
  const { restaurantId } = (router.query || {}) as Record<string, string>;

  const isPreview = (router.asPath || '').includes('/dashboard/website/preview');
  const base = isPreview && restaurantId ? `/dashboard/website/preview/${restaurantId}` : '';

  const buildPath = (p: string) => {
    if (p === '/') return base || '/';
    return base ? `${base}${p}` : p;
  };

  const isActive = (p: string) => {
    const full = buildPath(p);
    const current = (router.asPath || '').split('?')[0];
    return current.startsWith(full);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-md z-50 md:hidden">
      <div className="relative flex justify-between items-center px-6 py-2">
        <Link
          href={buildPath('/')}
          className={`flex flex-col items-center text-xs ${isActive('/') ? 'text-black font-semibold' : 'text-gray-400'}`}
        >
          <Home className="w-5 h-5 mb-1" />
          Home
        </Link>
        <Link
          href={buildPath('/menu')}
          className={`flex flex-col items-center text-xs ${isActive('/menu') ? 'text-black font-semibold' : 'text-gray-400'}`}
        >
          <Utensils className="w-5 h-5 mb-1" />
          Menu
        </Link>

        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
          <Link
            href={buildPath('/cart')}
            className="relative bg-black text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:scale-105 transition"
          >
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>

        <Link
          href={buildPath('/orders')}
          className={`flex flex-col items-center text-xs ${isActive('/orders') ? 'text-black font-semibold' : 'text-gray-400'}`}
        >
          <ListOrdered className="w-5 h-5 mb-1" />
          Orders
        </Link>
        <Link
          href={buildPath('/more')}
          className={`flex flex-col items-center text-xs ${isActive('/more') ? 'text-black font-semibold' : 'text-gray-400'}`}
        >
          <Menu className="w-5 h-5 mb-1" />
          More
        </Link>
      </div>
    </div>
  );
}
