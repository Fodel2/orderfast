import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import CustomerLayout from '@/components/CustomerLayout';
import Slides from '@/components/customer/Slides';
import DebugFlag from '@/components/dev/DebugFlag';
import { useBrand } from '@/components/branding/BrandProvider';
import { supabase } from '@/utils/supabaseClient';
import { useCart } from '@/context/CartContext';
import LandingHero from '@/components/customer/home/LandingHero';

export default function RestaurantHomePage() {
  const router = useRouter();
  const { restaurant_id } = router.query;
  const restaurantId = Array.isArray(restaurant_id) ? restaurant_id[0] : restaurant_id;
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const { cart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const [heroInView, setHeroInView] = useState(true);
  const brand = useBrand();

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

  const qp = router?.query || {};
  const headerImg =
    (
      restaurant &&
      typeof restaurant === 'object' &&
      'header_image' in (restaurant as any) &&
      typeof (restaurant as any).header_image === 'string' &&
      (restaurant as any).header_image.length > 0
        ? ((restaurant as any).header_image as string)
        : ''
    ) ||
    (
      restaurant &&
      typeof restaurant === 'object' &&
      'hero_image' in (restaurant as any) &&
      typeof (restaurant as any).hero_image === 'string' &&
      (restaurant as any).hero_image.length > 0
        ? ((restaurant as any).hero_image as string)
        : ''
    ) ||
    (typeof (qp as any).header === 'string' ? ((qp as any).header as string) : '') ||
    '';

  const params = new URLSearchParams(router.query as any);
  if (restaurant?.id) params.set('restaurant_id', restaurant.id);
  const orderHref = `/restaurant/menu?${params.toString()}`;

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
          title={restaurant?.name || 'Restaurant'}
          subtitle={restaurant?.website_description ?? null}
          isOpen={restaurant?.is_open ?? true}
          ctaLabel="Order Now"
          onCta={() => router.push(orderHref)}
          imageUrl={headerImg || undefined}
          logoUrl={restaurant?.logo_url ?? null}
          accentHex={(brand?.brand as string) || (brand?.accentColor as string) || undefined}
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

export async function getStaticProps() {
  return {
    props: {
      customerMode: true,
      cartCount: 0,
    },
  };
}

