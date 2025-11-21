import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import CartDrawer from '@/components/CartDrawer';
import KioskLayout from '@/components/layouts/KioskLayout';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabaseClient';
import KioskActionButton from '@/components/kiosk/KioskActionButton';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

type Restaurant = {
  id: string;
  name: string;
  website_title?: string | null;
  website_description?: string | null;
  logo_url?: string | null;
  theme_primary_color?: string | null;
  menu_header_image_url?: string | null;
  menu_header_image_updated_at?: string | null;
  menu_header_focal_x?: number | null;
  menu_header_focal_y?: number | null;
};

export default function KioskCartPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const { cart, subtotal } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const placeOrderDisabled = cartCount === 0;

  useEffect(() => {
    if (!restaurantId) return;
    let active = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select(
            'id,name,website_title,website_description,logo_url,theme_primary_color,menu_header_image_url,menu_header_image_updated_at,menu_header_focal_x,menu_header_focal_y'
          )
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

  const headerContent = useMemo(() => {
    if (!restaurantId) return null;
    return (
      <div className="mx-auto flex h-full w-full max-w-5xl items-start px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] sm:px-6">
        <button
          type="button"
          onClick={() => router.push(`/kiosk/${restaurantId}/menu`)}
          className="inline-flex min-h-[3rem] items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-base font-semibold text-neutral-900 shadow-md shadow-slate-300/70 ring-1 ring-slate-200 transition hover:-translate-y-[1px] hover:shadow-lg sm:text-lg"
        >
          <ChevronLeftIcon className="h-6 w-6" />
          Back
        </button>
      </div>
    );
  }, [restaurantId, router]);

  return (
    <KioskLayout
      restaurantId={restaurantId}
      restaurant={restaurant}
      cartCount={cartCount}
      customHeaderContent={headerContent}
    >
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-28 pt-4 sm:space-y-6 sm:pt-5">
        <div className="space-y-1.5 px-2 sm:px-0">
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-[26px]">Review your order</h1>
          <p className="text-base leading-relaxed text-slate-600 sm:text-lg">Check your items before placing your order.</p>
        </div>
        <CartDrawer inline />
      </div>
      {restaurantId ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 shadow-[0_-8px_40px_rgba(15,23,42,0.14)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3.5">
            <div className="flex flex-1 flex-col gap-1 text-slate-900">
              <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Subtotal</span>
              <span className="text-xl font-semibold sm:text-2xl">${(subtotal / 100).toFixed(2)}</span>
              <span className="text-xs text-slate-500 sm:text-sm">Includes items and add-ons</span>
            </div>
            <div className="flex-1 sm:flex-none sm:w-80">
              <KioskActionButton
                href={`/kiosk/${restaurantId}/confirm`}
                aria-disabled={placeOrderDisabled}
                className={`w-full justify-center rounded-2xl px-6 py-3 text-lg font-bold uppercase tracking-wide shadow-xl shadow-slate-900/15 min-h-[3.25rem] ${
                  placeOrderDisabled ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                Place Order
              </KioskActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </KioskLayout>
  );
}
