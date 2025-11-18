import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import KioskLayout from '@/components/layouts/KioskLayout';
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

export default function KioskConfirmPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
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
    <KioskLayout restaurantId={restaurantId} restaurant={restaurant}>
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Order placed</h2>
        <p className="mt-4 text-base text-slate-600">
          Your order is being prepared. Please wait for the staff to confirm your pickup number on screen.
        </p>
        {restaurantId ? (
          <div className="mt-8 flex justify-center">
            <Link
              href={`/kiosk/${restaurantId}/menu`}
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow transition hover:bg-slate-800"
            >
              Start a new order
            </Link>
          </div>
        ) : null}
      </div>
    </KioskLayout>
  );
}
