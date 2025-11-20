import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import KioskLayout from '@/components/layouts/KioskLayout';
import type { KioskRestaurant } from '@/components/kiosk/HomeScreen';
import { supabase } from '@/lib/supabaseClient';

type RestaurantRow = KioskRestaurant & {
  website_title?: string | null;
};

export default function KioskHomePage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    let active = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select(
            'id,name,website_description,logo_url,menu_header_image_url,menu_header_image_updated_at,menu_header_focal_x,menu_header_focal_y,theme_primary_color'
          )
          .eq('id', restaurantId)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error('[kiosk] failed to fetch restaurant', error);
        }

        setRestaurant((data as RestaurantRow) || null);
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
    <KioskLayout restaurantId={restaurantId} restaurant={restaurant} forceHome>
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-500">
        Preparing kiosk experience...
      </div>
    </KioskLayout>
  );
}
