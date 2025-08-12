import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import CustomerLayout from '@/components/CustomerLayout';
import Hero from '@/components/customer/Hero';
import Slides from '@/components/customer/Slides';
import Logo from '@/components/branding/Logo';
import { useBrand } from '@/components/branding/BrandProvider';
import { supabase } from '@/utils/supabaseClient';
import { useCart } from '@/context/CartContext';

export default function RestaurantHomePage() {
  const router = useRouter();
  const { restaurant_id } = router.query;
  const restaurantId = Array.isArray(restaurant_id) ? restaurant_id[0] : restaurant_id;
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [progress, setProgress] = useState(0); // 0..1 scroll over hero
  const { name } = useBrand();
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  // clamp once for cleaner math
  const pc = Math.min(1, Math.max(0, progress));
  const { cart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  useEffect(() => {
    if (!router.isReady || !restaurantId) return;
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .maybeSingle()
      .then(({ data }) => setRestaurant(data));
  }, [router.isReady, restaurantId]);

  useEffect(() => {
    const handle = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  const heroInView = progress < 1;
  const headerHeight = 56 * progress;
  const headerPadding = 8 * progress;
  const brandBg = progress === 0 ? 'transparent' : 'color-mix(in oklab, var(--brand) 18%, white)';
  const logoTopStart = viewport.h * 0.4;
  const logoLeftStart = viewport.w * 0.5;
  const logoTop = logoTopStart + (12 - logoTopStart) * pc;
  const logoLeft = logoLeftStart + (16 - logoLeftStart) * pc;
  const translate = -50 * (1 - pc);
  const logoScale = 1 + 2 * (1 - pc);

  return (
    <CustomerLayout
      restaurant={restaurant}
      cartCount={cartCount}
      hideFooter={heroInView}
      hideHeader
    >
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
              /* Start a bit lower and bigger (≈96px from 32px base), then dock to (12px,16px). */
              top: `${logoTop}px`,
              left: `${logoLeft}px`,
              transform: `translate(${translate}%, ${translate}%) scale(${logoScale})`,
              transformOrigin: 'left center',
              transition: 'top 200ms cubic-bezier(.2,.7,.2,1), left 200ms cubic-bezier(.2,.7,.2,1), transform 200ms cubic-bezier(.2,.7,.2,1)',
              pointerEvents: 'none',
            }}
          >
            {/* Final docked size is 32; at hero we scale up to approx 96 via transform */}
            <Logo size={32} />
          </div>

          <Slides onProgress={setProgress}>
            <div style={{ '--hero-logo-top': '40vh' } as React.CSSProperties}>
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
