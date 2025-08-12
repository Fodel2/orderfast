import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import CustomerLayout from '@/components/CustomerLayout';
import Hero from '@/components/customer/Hero';
import Slides from '@/components/customer/Slides';
import Logo from '@/components/branding/Logo';
import { useBrand } from '@/components/branding/BrandProvider';
import DebugFlag from '@/components/dev/DebugFlag';
import { supabase } from '@/utils/supabaseClient';
import { useCart } from '@/context/CartContext';

export default function RestaurantHomePage() {
  const router = useRouter();
  const { restaurant_id } = router.query;
  const restaurantId = Array.isArray(restaurant_id) ? restaurant_id[0] : restaurant_id;
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [progress, setProgress] = useState(0); // 0..1 scroll over hero
  const { name } = useBrand();
  // clamp once for cleaner math
  const pc = Math.min(1, Math.max(0, progress)); // 0..1 scroll progress
  const { cart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

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

  const heroInView = progress < 1;
  const headerHeight = 56 * progress;
  const headerPadding = 8 * progress;
  const brandBg = progress === 0 ? 'transparent' : 'color-mix(in oklab, var(--brand) 18%, white)';

  return (
    <CustomerLayout
      restaurant={restaurant}
      cartCount={cartCount}
      hideFooter={heroInView}
      hideHeader
    >
      <DebugFlag label="HOME-A" />
      {restaurant && (
        <>
          {/* Slim header that grows with scroll progress */}
          <div
            aria-label="Brand header"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 20,
              height: `${headerHeight}px`,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: `${headerPadding}px 16px`,
              background: brandBg,
              backdropFilter: progress ? 'saturate(180%) blur(8px)' : 'none',
              boxShadow: progress ? '0 2px 12px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <div
              style={{
                opacity: progress,
                transform: `translateY(${(1 - progress) * 6}px)`,
                fontWeight: 700,
              }}
            >
              {name}
            </div>
          </div>

          {/* SINGLE moving logo */}
          <div
            style={{
              position: 'fixed',
              zIndex: 30,
              // Center around ~34vh at top; dock to 12px as p→1
              top: `calc(12px + (34vh - 12px) * ${1 - pc})`,
              left: `calc(16px + (50vw - 16px) * ${1 - pc})`,
              // ~72px at hero (32 * 2.25), scale to 32px as p→1
              transform: `translate(${(-50) * (1 - pc)}%, ${(-50) * (1 - pc)}%) scale(${1 + 1.25 * (1 - pc)})`,
              transformOrigin: 'left center',
              transition: 'top 200ms cubic-bezier(.2,.7,.2,1), left 200ms cubic-bezier(.2,.7,.2,1), transform 200ms cubic-bezier(.2,.7,.2,1)',
              pointerEvents: 'none',
            }}
          >
            <Logo size={32} />
          </div>

          <Slides onProgress={setProgress}>
            <div style={{ '--hero-logo-top': '34vh' } as React.CSSProperties}>
              <Hero restaurant={restaurant} />
            </div>
            <section
              className="flex items-center justify-center h-full w-full"
              style={{ background: 'var(--surface)', color: 'var(--ink)' }}
            >
              <div className="text-center">
                <p>Menu preview coming soon.</p>
              </div>
            </section>
            <section
              className="flex items-center justify-center h-full w-full"
              style={{ background: 'var(--surface)', color: 'var(--ink)' }}
            >
              <div className="text-center">
                <p>Gallery placeholder.</p>
              </div>
            </section>
          </Slides>
        </>
      )}
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
