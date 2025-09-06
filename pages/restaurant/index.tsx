import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import CustomerLayout from '@/components/CustomerLayout';
import DebugFlag from '@/components/dev/DebugFlag';
import { useBrand } from '@/components/branding/BrandProvider';
import { supabase } from '@/utils/supabaseClient';
import { useCart } from '@/context/CartContext';
import LandingHero from '@/components/customer/home/LandingHero';
import SlidesContainer from '@/components/customer/home/SlidesContainer';
import resolveRestaurantId from '@/lib/resolveRestaurantId';

export default function RestaurantHomePage({ initialBrand }: { initialBrand: any | null }) {
  const router = useRouter();
  const brand = useBrand();
  const [restaurant, setRestaurant] = useState<any | null>(initialBrand);
  const { cart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const [heroInView, setHeroInView] = useState(true);
  const heroRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!heroRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeroInView(entry.isIntersecting),
      { threshold: 0.95 }
    );
    obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  return (
      <CustomerLayout
        cartCount={cartCount}
        hideFooter={heroInView}
        hideHeader={heroInView}
      >
      {process.env.NEXT_PUBLIC_DEBUG === '1' && <DebugFlag label="HOME-A" />}
      <div ref={heroRef}>
        <LandingHero
          title={restaurant?.website_title || restaurant?.name || 'Restaurant'}
          subtitle={restaurant?.website_description ?? null}
          ctaLabel="Order Now"
          ctaHref={orderHref}
          imageUrl={coverImg || undefined}
          logoUrl={restaurant?.logo_url ?? null}
          logoShape={restaurant?.logo_shape ?? null}
        />
      </div>
      <SlidesContainer />
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

