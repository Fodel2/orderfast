import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import KioskLayout from '@/components/layouts/KioskLayout';
import { KioskSessionProvider } from '@/context/KioskSessionContext';
import { supabase } from '@/lib/supabaseClient';

type Restaurant = {
  id: string;
  name: string;
  website_title?: string | null;
  website_description?: string | null;
  logo_url?: string | null;
  logo_shape?: 'square' | 'round' | 'rectangular' | null;
  brand_primary_color?: string | null;
  brand_secondary_color?: string | null;
  menu_header_image_url?: string | null;
  menu_header_image_updated_at?: string | null;
  menu_header_focal_x?: number | null;
  menu_header_focal_y?: number | null;
};

export default function KioskPaymentEntryPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;

  return (
    <KioskSessionProvider restaurantId={restaurantId}>
      <KioskPaymentEntryScreen restaurantId={restaurantId} />
    </KioskSessionProvider>
  );
}

function KioskPaymentEntryScreen({ restaurantId }: { restaurantId?: string | null }) {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantLoading, setRestaurantLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setRestaurantLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    let active = true;

    const load = async () => {
      setRestaurantLoading(true);
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select(
            'id,name,website_title,website_description,logo_url,logo_shape,brand_primary_color,brand_secondary_color,menu_header_image_url,menu_header_image_updated_at,menu_header_focal_x,menu_header_focal_y'
          )
          .eq('id', restaurantId)
          .maybeSingle();

        if (!active) return;
        if (error) {
          console.error('[kiosk] failed to fetch restaurant for payment entry shell', error);
        }
        setRestaurant((data as Restaurant) || null);
      } catch (err) {
        if (!active) return;
        console.error('[kiosk] failed to load payment entry shell', err);
      } finally {
        if (active) setRestaurantLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [restaurantId]);

  return (
    <KioskLayout restaurantId={restaurantId} restaurant={restaurant} restaurantLoading={restaurantLoading}>
      <div className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center px-4 py-8 sm:px-6">
        <section className="w-full rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-200/70 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kiosk payment entry</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Kiosk payment shell ready
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            This route is reserved for kiosk-only payment UI handoff. No payment SDK or processing is wired here yet.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                if (!restaurantId) return;
                router.push(`/kiosk/${restaurantId}/cart`).catch(() => undefined);
              }}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Back to kiosk cart
            </button>
            <button
              type="button"
              onClick={() => {
                if (!restaurantId) return;
                router.push(`/kiosk/${restaurantId}`).catch(() => undefined);
              }}
              className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Return to kiosk start
            </button>
          </div>
        </section>
      </div>
    </KioskLayout>
  );
}
