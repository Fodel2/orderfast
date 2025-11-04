import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import CartView, { CartViewActionProps } from '@/components/CartView';
import KioskLayout from '@/components/layouts/KioskLayout';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabaseClient';

type Restaurant = {
  id: string;
  name: string;
  website_title?: string | null;
};

export default function KioskCartPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const { cart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    let active = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('id,name,website_title')
          .eq('id', restaurantId)
          .maybeSingle();

        if (!active) return;
        if (error) {
          console.error('[kiosk] failed to fetch restaurant', error);
        }
        setRestaurant((data as Restaurant) || null);
      } catch (err) {
        if (!active) return;
        console.error('[kiosk] failed to load restaurant info', err);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [restaurantId]);

  const title = restaurant?.website_title || restaurant?.name || 'Review order';
  const subtitle = cartCount
    ? `${cartCount} item${cartCount === 1 ? '' : 's'} ready to check out`
    : 'Your cart is currently empty';

  const goToConfirm = () => {
    if (!restaurantId) return;
    router.push(`/kiosk/${restaurantId}/confirm`);
  };

  const kioskActions = ({ cartIsEmpty, clearCart }: CartViewActionProps) => (
    <>
      <button
        type="button"
        onClick={clearCart}
        className={`w-full rounded border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-100${
          cartIsEmpty ? ' opacity-60 cursor-not-allowed' : ''
        }`}
        disabled={cartIsEmpty}
      >
        Clean Plate
      </button>
      <button
        type="button"
        onClick={goToConfirm}
        className={`w-full rounded px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition btn-primary${
          cartIsEmpty ? ' opacity-60 cursor-not-allowed' : ''
        }`}
        disabled={cartIsEmpty}
      >
        Review & Place Order
      </button>
    </>
  );

  const action =
    restaurantId && cartCount > 0 ? (
      <Link
        href={`/kiosk/${restaurantId}/confirm`}
        className="rounded-full bg-white px-5 py-2 text-sm font-semibold uppercase tracking-wide text-slate-900 shadow transition hover:bg-white/90"
      >
        Place order
      </Link>
    ) : null;

  return (
    <KioskLayout
      title={title}
      subtitle={subtitle}
      backHref={restaurantId ? `/kiosk/${restaurantId}/menu` : undefined}
      action={action}
    >
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
        <CartView renderActions={kioskActions} />
      </div>
    </KioskLayout>
  );
}
