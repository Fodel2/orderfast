import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import CartDrawer from '@/components/CartDrawer';
import KioskLayout from '@/components/layouts/KioskLayout';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabaseClient';

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

  return (
    <KioskLayout restaurantId={restaurantId} restaurant={restaurant} cartCount={cartCount}>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {restaurantId && cartCount > 0 ? (
          <div className="flex justify-end">
            <Link
              href={`/kiosk/${restaurantId}/confirm`}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow transition hover:bg-slate-800"
            >
              Place order
            </Link>
          </div>
        ) : null}
        <CartDrawer inline />
      </div>
    </KioskLayout>
  );
}
