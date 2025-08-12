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
        <section
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 16px',
            gap: 12,
            background: 'linear-gradient(180deg,#7a7a7a 0%,#3a3a3a 100%)',
          }}
        >
          <Logo size={72} />
          <h1 className="text-4xl font-extrabold">{name}</h1>
          {restaurant?.website_description && <p>{restaurant.website_description}</p>}
          {typeof restaurant?.is_open === 'boolean' && (
            <OpenBadge isOpen={restaurant.is_open} />
          )}
          <Link href={orderHref} className="btn-primary">
            Order Now
          </Link>
        </section>
        <section
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          Menu preview coming soon.
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
