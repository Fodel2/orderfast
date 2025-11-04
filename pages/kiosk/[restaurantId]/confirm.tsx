import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import KioskLayout from '@/components/layouts/KioskLayout';
import { supabase } from '@/lib/supabaseClient';

type Restaurant = {
  id: string;
  name: string;
  website_title?: string | null;
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

  const title = restaurant?.website_title || restaurant?.name || 'Order placed';

  return (
    <KioskLayout
      title={title}
      subtitle="Thank you for your order!"
      backHref={restaurantId ? `/kiosk/${restaurantId}/menu` : undefined}
    >
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-black/30 p-10 text-center shadow-2xl">
        <h2 className="text-3xl font-semibold tracking-tight text-white">Order placed</h2>
        <p className="mt-4 text-base text-white/70">
          Your order is being prepared. Please wait for the staff to confirm your pickup number on screen.
        </p>
        {restaurantId ? (
          <div className="mt-8 flex justify-center">
            <Link
              href={`/kiosk/${restaurantId}/menu`}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 shadow transition hover:bg-white/90"
            >
              Start a new order
            </Link>
          </div>
        ) : null}
      </div>
    </KioskLayout>
  );
}
