import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import KioskLayout from '@/components/layouts/KioskLayout';
import { KioskSessionProvider, useKioskSession } from '@/context/KioskSessionContext';
import { supabase } from '@/lib/supabaseClient';
import KioskActionButton from '@/components/kiosk/KioskActionButton';
import { CheckIcon } from '@heroicons/react/24/outline';
import { getKioskLastRealOrderNumber, KIOSK_REAL_ORDER_NUMBER_EVENT } from '@/utils/kiosk/orders';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';

type Restaurant = {
  id: string;
  name: string;
  website_title?: string | null;
  website_description?: string | null;
  logo_url?: string | null;
  logo_shape?: 'square' | 'round' | 'rectangular' | null;
  brand_primary_color?: string | null;
  brand_secondary_color?: string | null;
  menu_header_image_url?: string | null;
  menu_header_image_updated_at?: string | null;
  menu_header_focal_x?: number | null;
  menu_header_focal_y?: number | null;
};

export default function KioskConfirmPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;

  return (
    <KioskSessionProvider restaurantId={restaurantId}>
      <KioskConfirmScreen restaurantId={restaurantId} />
    </KioskSessionProvider>
  );
}

function KioskConfirmScreen({ restaurantId }: { restaurantId?: string | null }) {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const { resetKioskToStart } = useKioskSession();
  const resetTimeoutRef = useRef<number | null>(null);
  useKeyboardViewport(true);
  const tempOrderNumber = useMemo(() => {
    const rawOrderNumber = router.query.orderNumber;
    const raw = Array.isArray(rawOrderNumber) ? rawOrderNumber[0] : rawOrderNumber;
    if (!raw) return null;
    const parsed = Number.parseInt(String(raw), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [router.query.orderNumber]);
  const [displayOrderNumber, setDisplayOrderNumber] = useState<number | null>(null);

  const isOpenTabConfirmation = useMemo(() => {
    const raw = router.query.openTab;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value === '1';
  }, [router.query.openTab]);

  const openTabTableNumber = useMemo(() => {
    const raw = router.query.tableNumber;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [router.query.tableNumber]);

  const isExpressConfirmation = useMemo(() => {
    const raw = router.query.express;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value === '1';
  }, [router.query.express]);

  useEffect(() => {
    if (!restaurantId) {
      setRestaurantLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    let active = true;

    const load = async () => {
      setRestaurantLoading(true);
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select(
            'id,name,website_title,website_description,logo_url,logo_shape,brand_primary_color,brand_secondary_color,menu_header_image_url,menu_header_image_updated_at,menu_header_focal_x,menu_header_focal_y'
          )
          .eq('id', restaurantId)
          .maybeSingle();

        if (!active) return;
        if (error) {
          console.error('[kiosk] failed to fetch restaurant', error);
        }
        setRestaurant((data as Restaurant) || null);
      } catch (err) {
        if (!active) return;
        console.error('[kiosk] failed to load restaurant info', err);
      } finally {
        if (active) setRestaurantLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [restaurantId]);

  useEffect(() => {
    setDisplayOrderNumber(tempOrderNumber ?? null);
  }, [tempOrderNumber]);

  useEffect(() => {
    const applyStoredNumber = () => {
      const realNumber = getKioskLastRealOrderNumber(restaurantId);
      if (realNumber) {
        setDisplayOrderNumber(realNumber);
      }
    };

    applyStoredNumber();

    const handleRealOrderNumber = (event: Event) => {
      const detail = (event as CustomEvent<{ restaurantId?: string | null; orderNumber?: number }>).detail;
      if (!detail) return;
      if (detail.restaurantId !== restaurantId) return;
      if (typeof detail.orderNumber === 'number') {
        setDisplayOrderNumber(detail.orderNumber);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(KIOSK_REAL_ORDER_NUMBER_EVENT, handleRealOrderNumber as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(KIOSK_REAL_ORDER_NUMBER_EVENT, handleRealOrderNumber as EventListener);
      }
    };
  }, [restaurantId]);

  const minimalHeader = useMemo(() => <div aria-hidden className="h-0" />, []);

  const resetAfterOrderPlaced = useCallback(() => {
    if (isExpressConfirmation && restaurantId) {
      router.push(`/express?restaurant_id=${restaurantId}&mode=entry`).catch(() => undefined);
      return;
    }
    resetKioskToStart();
  }, [isExpressConfirmation, resetKioskToStart, restaurantId, router]);

  const handleStartNewOrder = () => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    resetAfterOrderPlaced();
  };

  useEffect(() => {
    if (isExpressConfirmation) {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      return undefined;
    }

    resetTimeoutRef.current = window.setTimeout(() => {
      resetAfterOrderPlaced();
    }, 10000);

    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, [isExpressConfirmation, resetAfterOrderPlaced]);

  return (
    <KioskLayout
      restaurantId={restaurantId}
      restaurant={restaurant}
      restaurantLoading={restaurantLoading}
      customHeaderContent={minimalHeader}
      hideHeader
      hideCartButton
    >
      <section
        className="fixed inset-0 z-[60] flex w-full items-center justify-center px-4"
        style={{
          height: 'var(--vvh, 100dvh)',
          paddingTop: 'max(18px, env(safe-area-inset-top))',
          paddingBottom: 'max(18px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto w-full max-w-4xl">
          <div className="overflow-hidden rounded-[34px] border border-neutral-200/90 bg-white/95 shadow-[0_30px_70px_-38px_rgba(0,0,0,0.4)] backdrop-blur">
            <div className="border-b border-neutral-200/80 bg-gradient-to-r from-neutral-50 via-white to-neutral-50 px-6 py-4 sm:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Checkout complete</p>
            </div>
            <div className="px-6 py-9 text-center sm:px-10 sm:py-11">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-[0_16px_45px_-28px_rgba(16,185,129,0.95)]">
                <CheckIcon className="h-11 w-11" strokeWidth={2.4} />
              </div>
              <h2 className="text-4xl font-semibold tracking-tight text-neutral-900 sm:text-[42px]">Order placed</h2>
              {isOpenTabConfirmation ? (
                <>
                  <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
                    Order sent to kitchen.
                  </p>
                  <p className="mx-auto mt-2 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
                    You can add more items to Table {openTabTableNumber ?? 'your table'} anytime by scanning again.
                  </p>
                </>
              ) : (
                <>
                  <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
                    Your order is being prepared. Please wait for the staff to confirm your pickup number on screen.
                  </p>
                  {displayOrderNumber ? (
                    <div className="mt-7">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">Order number</p>
                      <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                        #{String(displayOrderNumber).padStart(4, '0')}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
              {restaurantId ? (
                <div className="mt-10 flex justify-center">
                  <KioskActionButton
                    onClick={handleStartNewOrder}
                    className="min-w-[220px] justify-center px-8 py-3.5 text-sm font-semibold uppercase tracking-wide sm:text-base"
                  >
                    Start New Order
                  </KioskActionButton>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </KioskLayout>
  );
}
