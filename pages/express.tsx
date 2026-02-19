import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { BuildingStorefrontIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import { useRestaurant } from '@/lib/restaurant-context';
import { supabase } from '@/lib/supabaseClient';
import { setExpressSession } from '@/utils/express/session';
import { markHomeSeen } from '@/utils/kiosk/session';
import { normalizeSource } from '@/lib/media/placeholders';

type ExpressSettings = {
  enabled: boolean;
  enable_takeaway: boolean;
  enable_dine_in: boolean;
  enable_table_numbers: boolean;
};

type RestaurantBrand = {
  name: string | null;
  website_title: string | null;
  website_description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  logo_shape: 'square' | 'round' | 'rectangular' | null;
  menu_header_image_url: string | null;
  menu_header_image_updated_at: string | null;
  menu_header_focal_x: number | null;
  menu_header_focal_y: number | null;
  theme_primary_color: string | null;
};

type ExpressPageData = {
  settings: ExpressSettings | null;
  restaurant: RestaurantBrand | null;
};

const pageDataCache = new Map<string, ExpressPageData>();
const pageDataPromiseCache = new Map<string, Promise<ExpressPageData>>();

function formatImageUrl(url?: string | null, updatedAt?: string | null) {
  const normalized = normalizeSource(url);
  if (!normalized) return null;
  if (!updatedAt) return normalized;
  const ts = new Date(updatedAt).getTime();
  return `${normalized}?v=${ts}`;
}

async function loadExpressPageData(restaurantId: string): Promise<ExpressPageData> {
  const cached = pageDataCache.get(restaurantId);
  if (cached) return cached;

  const inFlight = pageDataPromiseCache.get(restaurantId);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const [entryRes, brandRes] = await Promise.all([
      fetch(`/api/express/tables?restaurant_id=${restaurantId}`),
      supabase
        .from('restaurants')
        .select(
          'name,website_title,website_description,logo_url,cover_image_url,logo_shape,menu_header_image_url,menu_header_image_updated_at,menu_header_focal_x,menu_header_focal_y,theme_primary_color'
        )
        .eq('id', restaurantId)
        .maybeSingle<RestaurantBrand>(),
    ]);

    const payload = await entryRes.json().catch(() => ({}));
    const result: ExpressPageData = {
      settings: entryRes.ok ? ((payload.settings as ExpressSettings) || null) : null,
      restaurant: brandRes.data || null,
    };

    pageDataCache.set(restaurantId, result);
    return result;
  })();

  pageDataPromiseCache.set(restaurantId, promise);

  try {
    return await promise;
  } finally {
    pageDataPromiseCache.delete(restaurantId);
  }
}

export default function ExpressEntryPage() {
  const router = useRouter();
  const { restaurantId, loading: restaurantLoading } = useRestaurant();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ExpressSettings | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantBrand | null>(null);
  const [entryError, setEntryError] = useState('');

  const primaryColor = restaurant?.theme_primary_color || '#111827';
  const heroImage = useMemo(() => {
    const cover = formatImageUrl(restaurant?.cover_image_url);
    if (cover) return cover;
    return formatImageUrl(restaurant?.menu_header_image_url, restaurant?.menu_header_image_updated_at);
  }, [restaurant?.cover_image_url, restaurant?.menu_header_image_updated_at, restaurant?.menu_header_image_url]);
  const logoUrl = useMemo(() => normalizeSource(restaurant?.logo_url), [restaurant?.logo_url]);
  const focalX = restaurant?.menu_header_focal_x ?? 0.5;
  const focalY = restaurant?.menu_header_focal_y ?? 0.5;

  const isTakeawayOnly = !!settings?.enabled && !!settings.enable_takeaway && !settings.enable_dine_in;

  const routeToKioskMenu = async (mode: 'takeaway' | 'dine_in', options?: { replace?: boolean }) => {
    if (!restaurantId) return;
    markHomeSeen(restaurantId);
    const params = new URLSearchParams();

    Object.entries(router.query).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 0) {
        params.set(key, value);
      }
    });

    params.set('express', '1');
    params.set('mode', mode);

    const href = `/kiosk/${restaurantId}/menu?${params.toString()}`;
    const ok = options?.replace ? await router.replace(href) : await router.push(href);
    if (!ok) {
      setEntryError('Unable to continue right now. Please try again.');
    }
  };

  useEffect(() => {
    if (restaurantLoading || !restaurantId) return;

    const load = async () => {
      setLoading(true);
      const data = await loadExpressPageData(restaurantId);
      setSettings(data.settings);
      setRestaurant(data.restaurant);
      setLoading(false);
    };

    void load();
  }, [restaurantId, restaurantLoading]);

  useEffect(() => {
    if (!restaurantId || loading || !settings?.enabled) return;

    if (!settings.enable_takeaway && settings.enable_dine_in) {
      setExpressSession({
        mode: 'dine_in',
        tableNumber: null,
        tableSessionId: null,
        customerName: null,
        dineInPaymentMode: 'immediate_pay',
        restaurantId,
        isExpress: true,
      });
      void routeToKioskMenu('dine_in', { replace: true });
    }
  }, [loading, restaurantId, settings]);

  const continueTakeaway = () => {
    if (!restaurantId) return;
    setExpressSession({ mode: 'takeaway', tableNumber: null, customerName: null, restaurantId, isExpress: true });
    void routeToKioskMenu('takeaway');
  };

  const continueDineIn = () => {
    if (!restaurantId || !settings) return;
    setEntryError('');
    setExpressSession({
      mode: 'dine_in',
      tableNumber: null,
      tableSessionId: null,
      customerName: null,
      dineInPaymentMode: 'immediate_pay',
      restaurantId,
      isExpress: true,
    });
    void routeToKioskMenu('dine_in');
  };

  const logoFrameClassName = useMemo(() => {
    if (restaurant?.logo_shape === 'round') return 'relative h-24 w-24 overflow-hidden rounded-full border border-neutral-200 bg-white shadow-lg shadow-neutral-200';
    if (restaurant?.logo_shape === 'rectangular') return 'relative h-20 w-36 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg shadow-neutral-200';
    return 'relative h-24 w-24 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg shadow-neutral-200';
  }, [restaurant?.logo_shape]);

  const logoImageClass =
    restaurant?.logo_shape === 'rectangular' ? 'object-contain' : 'object-cover';

  if (restaurantLoading || loading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white text-neutral-900">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 animate-pulse bg-neutral-200" />
          <div className="kiosk-hero-dim" />
        </div>
        <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-6 px-6 text-center">
          <div className="w-full rounded-[32px] border border-neutral-200 bg-white/95 p-8 shadow-2xl shadow-neutral-300/50 backdrop-blur">
            <div className="flex flex-col items-center gap-4">
              <div className="h-24 w-24 rounded-full bg-neutral-200/80 animate-pulse" />
              <div className="h-8 w-52 rounded-full bg-neutral-200/80 animate-pulse sm:h-9 sm:w-64" />
            </div>
            <div className="mt-8 h-16 w-full rounded-full bg-neutral-200/80 animate-pulse" />
          </div>
        </div>
        <style jsx>{`
          .kiosk-hero-dim {
            position: absolute;
            inset: 0;
            background: rgba(255, 255, 255, 0.275);
            pointer-events: none;
          }
        `}</style>
      </div>
    );
  }

  if (!restaurantId) {
    return <div className="flex min-h-screen items-center justify-center p-6 text-center">Missing restaurant context.</div>;
  }

  if (!settings?.enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Express Order is unavailable</h1>
          <p className="mt-2 text-gray-600">This restaurant hasn’t enabled Express Order yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-white text-neutral-900">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: heroImage ? `url(${heroImage})` : undefined,
            backgroundColor: heroImage ? undefined : '#f8fafc',
            backgroundSize: 'cover',
            backgroundPosition: `${focalX * 100}% ${focalY * 100}%`,
          }}
        />
        <div className="kiosk-hero-dim" />
      </div>

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-6 px-6 text-center">
        <div className="w-full rounded-[32px] border border-neutral-200 bg-white/95 p-8 shadow-2xl shadow-neutral-300/50 backdrop-blur">
          <div className="flex flex-col items-center gap-4">
            {logoUrl ? (
              <div className={logoFrameClassName}>
                <img
                  src={logoUrl}
                  alt={restaurant?.name || 'Restaurant logo'}
                  className={`h-full w-full ${logoImageClass}`}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold leading-tight text-neutral-900 sm:text-4xl">
                {restaurant?.website_title || restaurant?.name || 'Restaurant'}
              </h1>
              {restaurant?.website_description ? (
                <p className="text-base text-neutral-600 sm:text-lg">{restaurant.website_description}</p>
              ) : null}
            </div>
          </div>

          {isTakeawayOnly ? (
            <button
              type="button"
              onClick={continueTakeaway}
              className="mt-8 w-full rounded-full px-8 text-lg font-semibold text-white shadow-lg shadow-neutral-400 transition focus-visible:outline-none"
              style={{
                backgroundColor: primaryColor,
                minHeight: '64px',
              }}
            >
              Tap to Order
            </button>
          ) : (
            <div className="mt-8 grid gap-3">
              {settings.enable_takeaway ? (
                <button
                  type="button"
                  onClick={continueTakeaway}
                  className="flex w-full items-center justify-center gap-2 rounded-full px-8 text-lg font-semibold text-white shadow-lg shadow-neutral-400 transition focus-visible:outline-none"
                  style={{ backgroundColor: primaryColor, minHeight: '64px' }}
                >
                  <ShoppingBagIcon className="h-5 w-5" />
                  Takeaway
                </button>
              ) : null}
              {settings.enable_dine_in ? (
                <button
                  type="button"
                  onClick={continueDineIn}
                  className="flex w-full items-center justify-center gap-2 rounded-full px-8 text-lg font-semibold text-white shadow-lg shadow-neutral-400 transition focus-visible:outline-none"
                  style={{ backgroundColor: primaryColor, minHeight: '64px' }}
                >
                  <BuildingStorefrontIcon className="h-5 w-5" />
                  Dine-in
                </button>
              ) : null}
            </div>
          )}

          {entryError ? <p className="mt-4 text-sm text-red-600">{entryError}</p> : null}
        </div>
      </div>

      <style jsx>{`
        .kiosk-hero-dim {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.275);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
