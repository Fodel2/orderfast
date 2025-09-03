import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import CustomerLayout from '@/components/CustomerLayout';
import DebugFlag from '@/components/dev/DebugFlag';
import { useBrand } from '@/components/branding/BrandProvider';
import { supabase } from '@/utils/supabaseClient';
import { useCart } from '@/context/CartContext';
import resolveRestaurantId from '@/lib/resolveRestaurantId';
import RestaurantSlides from '@/components/customer/home/RestaurantSlides';

export default function RestaurantHomePage({ initialBrand }: { initialBrand: any | null }) {
  const router = useRouter();
  const brand = useBrand();
  const [restaurant, setRestaurant] = useState<any | null>(initialBrand);
  const { cart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const [heroInView, setHeroInView] = useState(true);
  const restaurantId = resolveRestaurantId(router, brand, restaurant);

  useEffect(() => {
    // dev: prove this file renders in prod
    // eslint-disable-next-line no-console
    console.log('[Home] pages/restaurant/index.tsx mounted');
  }, []);

  useEffect(() => {
    if (!router.isReady || !restaurantId) return;
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .maybeSingle()
      .then(({ data }) => setRestaurant(data));
  }, [router.isReady, restaurantId]);

  return (
      <CustomerLayout
        cartCount={cartCount}
        hideFooter={heroInView}
        hideHeader={heroInView}
      >
      {process.env.NEXT_PUBLIC_DEBUG === '1' && <DebugFlag label="HOME-A" />}
      <RestaurantSlides restaurantId={restaurantId} restaurant={restaurant} onHeroInView={setHeroInView} />
      </CustomerLayout>
  );
}

import { supaServer } from '@/lib/supaServer';
import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async ctx => {
  const pick = (v: any) => (Array.isArray(v) ? v[0] : v);
  const id =
    (pick(ctx.query.restaurant_id) as string) ||
    (pick(ctx.query.id) as string) ||
    (pick(ctx.query.r) as string) ||
    null;
  let initialBrand = null;
  if (id) {
    const { data } = await supaServer()
      .from('restaurants')
      .select('id,website_title,name,logo_url,logo_shape,brand_primary_color,brand_secondary_color,cover_image_url,website_description')
      .eq('id', id)
      .maybeSingle();
    initialBrand = data;
  }
  return {
    props: { initialBrand },
  };
};

