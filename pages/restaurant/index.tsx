import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import CustomerLayout from '@/components/CustomerLayout';
import Slides from '@/components/customer/Slides';
import Hero from '@/components/customer/Hero';
import DebugFlag from '@/components/dev/DebugFlag';
import Logo from '@/components/branding/Logo';
import { useBrand } from '@/components/branding/BrandProvider';
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
  const [p, setP] = useState(0); // 0..1
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

  return (
    <CustomerLayout
      restaurant={restaurant}
      cartCount={cartCount}
      hideFooter={heroInView}
      hideHeader
    >
      <DebugFlag label="HOME-A" />
      {/* Floating logo + slim header (appear after scroll) */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          height: `${56 * Math.max(0, Math.min(1, (p - 0.9) / 0.1))}px`,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: p > 0.9 ? '8px 16px' : '0 16px',
          background: p > 0.9 ? 'color-mix(in oklab, var(--brand) 18%, white)' : 'transparent',
          backdropFilter: p > 0.9 ? 'saturate(180%) blur(8px)' : 'none',
          boxShadow: p > 0.9 ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
          transition: 'height 180ms ease, background 160ms ease, box-shadow 160ms ease, padding 160ms ease',
        }}
      >
        <div style={{ opacity: p > 0.92 ? 1 : 0, transition: 'opacity 160ms ease', fontWeight: 700 }}>{name}</div>
      </div>
      <div
        style={{
          position: 'fixed',
          zIndex: 30,
          // start perfectly centered (50%/50%), then dock to (12px,16px)
          top:  `calc(12px + (50% - 12px)  * ${1 - p})`,
          left: `calc(16px + (50% - 16px)  * ${1 - p})`,
          transform: `translate(-50%, -50%) scale(${1 + 1.25 * (1 - p)})`,
          transformOrigin: 'left center',
          transition: 'top 180ms cubic-bezier(.2,.7,.2,1), left 180ms cubic-bezier(.2,.7,.2,1), transform 180ms cubic-bezier(.2,.7,.2,1)',
          pointerEvents: 'none',
        }}
      >
        <Logo size={32} />
      </div>

      <Slides onHeroInView={setHeroInView} onProgress={setP}>
        <Hero restaurant={restaurant} />

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
