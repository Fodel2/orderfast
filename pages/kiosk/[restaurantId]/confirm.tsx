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
  theme_primary_color?: string | null;
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
            'id,name,website_title,website_description,logo_url,theme_primary_color,menu_header_image_url,menu_header_image_updated_at,menu_header_focal_x,menu_header_focal_y'
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
    >
      <div
        className="fixed inset-0 z-[60] flex w-full items-center justify-center px-4"
        style={{
          height: 'var(--vvh, 100dvh)',
          paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        }}
      >
        <div className="w-full max-w-2xl rounded-[32px] border border-neutral-200 bg-white/95 px-7 py-10 text-center shadow-2xl shadow-neutral-300/40 backdrop-blur sm:px-9 sm:py-12">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-[0_15px_50px_-30px_rgba(16,185,129,0.9)]">
            <CheckIcon className="h-10 w-10" strokeWidth={2.4} />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-[32px]">Order placed</h2>
          {isOpenTabConfirmation ? (
            <>
              <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">Order sent to kitchen.</p>
              <p className="mt-2 text-base leading-relaxed text-neutral-600 sm:text-lg">
                You can add more items to Table {openTabTableNumber ?? 'your table'} anytime by scanning again.
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
                Your order is being prepared. Please wait for the staff to confirm your pickup number on screen.
              </p>
              {displayOrderNumber ? (
                <p className="mt-3 text-lg font-semibold text-neutral-900 sm:text-xl">
                  Your order number is{' '}
                  <span className="rounded-full bg-neutral-100 px-3 py-1">#{String(displayOrderNumber).padStart(4, '0')}</span>
                </p>
              ) : null}
            </>
          )}
          {restaurantId ? (
            <div className="mt-8 flex justify-center">
              <KioskActionButton
                onClick={handleStartNewOrder}
                className="px-7 py-3 text-sm font-semibold uppercase tracking-wide sm:text-base"
              >
                Start New Order
              </KioskActionButton>
            </div>
          ) : null}
        </div>
      </div>
    </KioskLayout>
  );
}
