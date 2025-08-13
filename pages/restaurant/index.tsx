import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import CustomerLayout from '@/components/CustomerLayout';
import Slides from '@/components/customer/Slides';
import DebugFlag from '@/components/dev/DebugFlag';
import Logo from '@/components/branding/Logo';
import { useBrand } from '@/components/branding/BrandProvider';
import OpenBadge from '@/components/customer/OpenBadge';
import { supabase } from '@/utils/supabaseClient';
import { useCart } from '@/context/CartContext';

export default function RestaurantHomePage() {
  const router = useRouter();
  const { restaurant_id } = router.query;
  const restaurantId = Array.isArray(restaurant_id) ? restaurant_id[0] : restaurant_id;
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const { cart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const [heroInView, setHeroInView] = useState(true);
  const { name } = useBrand();

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
      <DebugFlag label="HOME-A" />
      <Slides onHeroInView={setHeroInView}>
        {/* Slide 1 — HERO */}
        <section
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg,#7a7a7a 0%,#3a3a3a 100%)',
          }}
        >
          <div className="w-full max-w-[680px] px-4 text-center flex flex-col items-center gap-4 md:gap-5">
            <Logo size={84} />
            <h1 className="text-4xl md:text-5xl font-extrabold">{name}</h1>
            {restaurant?.website_description && (
              <p className="text-base md:text-lg text-gray-200/90">
                {restaurant.website_description}
              </p>
            )}
            {typeof restaurant?.is_open === 'boolean' && (
              <div className="mt-1">
                <OpenBadge isOpen={restaurant.is_open} />
              </div>
            )}
            <div className="mt-2">
              <Link
                href={orderHref}
                className="btn-primary px-6 py-3 rounded-full text-base font-semibold shadow-md"
              >
                Order Now
              </Link>
            </div>
          </div>
        </section>

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

