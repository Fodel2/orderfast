import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import CustomerLayout from '@/components/CustomerLayout';
import Slides from '@/components/customer/Slides';
import DebugFlag from '@/components/dev/DebugFlag';
import { useBrand } from '@/components/branding/BrandProvider';
import { supabase } from '@/utils/supabaseClient';
import { useCart } from '@/context/CartContext';
import LandingHero from '@/components/customer/home/LandingHero';
import resolveRestaurantId from '@/lib/resolveRestaurantId';

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

  const coverImg = restaurant?.cover_image_url || '';

  // derive restaurant id from query so CTA retains context
  const rid = (() => {
    const qp = router?.query ?? {};
    const v: any = (qp as any).restaurant_id ?? (qp as any).id ?? (qp as any).r;
    return Array.isArray(v) ? v[0] : v;
  })();
  const orderHref = rid ? `/restaurant/menu?restaurant_id=${String(rid)}` : '/restaurant/menu';

  return (
      <CustomerLayout
        restaurant={restaurant}
        cartCount={cartCount}
        hideFooter={heroInView}
        hideHeader={heroInView}
      >
      {process.env.NEXT_PUBLIC_DEBUG === '1' && <DebugFlag label="HOME-A" />}
      <Slides onHeroInView={setHeroInView}>
        {/* Slide 1 — HERO */}
        <LandingHero
          title={restaurant?.website_title || restaurant?.name || 'Restaurant'}
          subtitle={restaurant?.website_description ?? null}
          ctaLabel="Order Now"
          ctaHref={orderHref}
          imageUrl={coverImg || undefined}
          logoUrl={restaurant?.logo_url ?? null}
          logoShape={restaurant?.logo_shape ?? null}
        />

        {/* Slide 2 — Opening Hours & Address */}
        <section className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
          <h2 className="text-xl font-bold">Opening Hours & Address</h2>
          <p>Opening hours will be displayed here.</p>
          <p>Address details will be displayed here.</p>
        </section>

        {/* Slide 3 — Menu Preview */}
        <section className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
          <h2 className="text-xl font-bold">Menu Preview</h2>
          <p>Menu preview coming soon.</p>
        </section>

        {/* Slide 4 — Gallery */}
        <section className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
          <h2 className="text-xl font-bold">Gallery</h2>
          <p>Photos will be displayed here.</p>
        </section>

        {/* Slide 5 — Contact Us */}
        <section className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
          <h2 className="text-xl font-bold">Contact Us</h2>
          <p>Phone, email, and contact form will be displayed here.</p>
        </section>
      </Slides>
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

