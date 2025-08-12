import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import CustomerLayout from '@/components/CustomerLayout';
import Slides from '@/components/customer/Slides';
import Logo from '@/components/branding/Logo';
import { useBrand } from '@/components/branding/BrandProvider';
import DebugFlag from '@/components/dev/DebugFlag';
import OpenBadge from '@/components/customer/OpenBadge';
import Link from 'next/link';
import { supabase } from '@/utils/supabaseClient';
import { useCart } from '@/context/CartContext';

export default function RestaurantHomePage() {
  const router = useRouter();
  const { restaurant_id } = router.query;
  const restaurantId = Array.isArray(restaurant_id) ? restaurant_id[0] : restaurant_id;
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const { name } = useBrand();
  const { cart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const [heroInView, setHeroInView] = useState(true);

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
      hideHeader
    >
      <DebugFlag label="HOME-A" />
      <Slides onHeroInView={setHeroInView}>
        {/* Slide 1 — Hero */}
        <section className="home-hero">
          <Logo size={72} />
          <h1 className="text-4xl font-extrabold">{name}</h1>
          {restaurant?.website_description && (
            <p className="desc">{restaurant.website_description}</p>
          )}
          {typeof restaurant?.is_open === 'boolean' && (
            <div>
              <OpenBadge isOpen={restaurant.is_open} />
            </div>
          )}
          <div>
            <Link href={orderHref} className="btn-primary">
              Order Now
            </Link>
          </div>
        </section>

        {/* Slide 2 — Opening Hours & Address */}
        <section className="slide-placeholder">
          <h2 className="text-xl font-bold">Opening Hours & Address</h2>
          <p>Opening hours will be displayed here.</p>
          <p>Address details will be displayed here.</p>
        </section>

        {/* Slide 3 — Menu Preview */}
        <section className="slide-placeholder">
          <h2 className="text-xl font-bold">Menu Preview</h2>
          <p>Menu preview coming soon.</p>
        </section>

        {/* Slide 4 — Gallery */}
        <section className="slide-placeholder">
          <h2 className="text-xl font-bold">Gallery</h2>
          <p>Photos will be displayed here.</p>
        </section>

        {/* Slide 5 — Contact Us */}
        <section className="slide-placeholder">
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
