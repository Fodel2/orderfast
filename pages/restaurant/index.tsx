import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import CustomerLayout from '@/components/CustomerLayout';
import DebugFlag from '@/components/dev/DebugFlag';
import { useBrand } from '@/components/branding/BrandProvider';
import { supabase } from '@/utils/supabaseClient';
import { useCart } from '@/context/CartContext';
import LandingHero from '@/components/customer/home/LandingHero';
import SlidesContainer from '@/components/customer/home/SlidesContainer';
import resolveRestaurantId from '@/lib/resolveRestaurantId';
import { normalizeRestaurantId, useRestaurant } from '@/lib/restaurant-context';

export default function RestaurantHomePage({ initialBrand }: { initialBrand: any | null }) {
  const router = useRouter();
  const brand = useBrand();
  const [restaurant, setRestaurant] = useState<any | null>(initialBrand);
  const { cart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const [showChrome, setShowChrome] = useState(false);
  const { restaurantId: contextRestaurantId, loading: ridLoading } = useRestaurant();
  const restaurantId = normalizeRestaurantId(contextRestaurantId || resolveRestaurantId(router, brand, restaurant));
  const didLogMountRef = useRef(false);
  const bannerVisibleRef = useRef(false);
  const queryRestaurantId = normalizeRestaurantId(router.query?.restaurant_id ?? router.query?.id ?? router.query?.r);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG !== '1' || didLogMountRef.current) return;
    if (!router.isReady) return;
    didLogMountRef.current = true;
    // eslint-disable-next-line no-console
    console.debug('[customer:home] mount', { route: router.asPath, restaurantId });
  }, [router.isReady, router.asPath, restaurantId]);

  useEffect(() => {
    if (!router.isReady || ridLoading || !restaurantId) return;

    let active = true;
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          if (process.env.NEXT_PUBLIC_DEBUG === '1') {
            // eslint-disable-next-line no-console
            console.warn('[customer:home] restaurant fetch failed', error);
          }
          return;
        }
        setRestaurant(data ?? null);
      });

    return () => {
      active = false;
    };
  }, [router.isReady, ridLoading, restaurantId]);

  const coverImg = restaurant?.cover_image_url || '';

  // derive restaurant id from query so CTA retains context
  const rid = useMemo(() => queryRestaurantId || restaurantId || null, [queryRestaurantId, restaurantId]);
  const orderHref = rid ? `/restaurant/menu?restaurant_id=${String(rid)}` : '/restaurant/menu';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SHOW_THRESHOLD = 24;
    const HIDE_THRESHOLD = 8;
    const getScrollTop = () => {
      const root = document.getElementById('scroll-root');
      return root ? root.scrollTop : window.scrollY;
    };

    const updateVisibility = () => {
      const scrollTop = getScrollTop();
      const current = bannerVisibleRef.current;
      const next = current ? scrollTop > HIDE_THRESHOLD : scrollTop >= SHOW_THRESHOLD;
      if (next === current) return;
      bannerVisibleRef.current = next;
      setShowChrome(next);
      if (process.env.NEXT_PUBLIC_DEBUG === '1') {
        // eslint-disable-next-line no-console
        console.debug('[customer:home] banner visibility changed', { visible: next, scrollTop });
      }
    };

    const onScroll = () => {
      updateVisibility();
    };

    const rafId = window.requestAnimationFrame(updateVisibility);
    const scrollRoot = document.getElementById('scroll-root');
    const target: HTMLElement | Window = scrollRoot || window;
    target.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(rafId);
      target.removeEventListener('scroll', onScroll);
    };
  }, []);

  if (!ridLoading && !rid) {
    return (
      <CustomerLayout cartCount={cartCount} hideFooter={false} hideHeader={false}>
        <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center text-sm text-neutral-600">
          Missing restaurant context. Add <code>?restaurant_id=&lt;id&gt;</code> to continue.
        </div>
      </CustomerLayout>
    );
  }

  return (
      <CustomerLayout
        cartCount={cartCount}
        hideFooter={!showChrome}
        hideHeader={!showChrome}
      >
      {process.env.NEXT_PUBLIC_DEBUG === '1' && <DebugFlag label="HOME-A" />}
      <LandingHero
          title={restaurant?.website_title || restaurant?.name || 'Restaurant'}
          subtitle={restaurant?.website_description ?? null}
          ctaLabel="Order Now"
          ctaHref={orderHref}
          imageUrl={coverImg || undefined}
          logoUrl={restaurant?.logo_url ?? null}
          logoShape={restaurant?.logo_shape ?? null}
      />
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
    const { data } = await supaServer
      .from('restaurants')
      .select('id,website_title,name,logo_url,logo_shape,brand_primary_color,brand_secondary_color,cover_image_url,website_description,currency_code')
      .eq('id', id)
      .maybeSingle();
    initialBrand = data;
  }
  return {
    props: { initialBrand },
  };
};
