import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { BuildingStorefrontIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import { useRestaurant } from '@/lib/restaurant-context';
import { supabase } from '@/lib/supabaseClient';
import { setExpressSession } from '@/utils/express/session';

type ExpressSettings = {
  enabled: boolean;
  enable_takeaway: boolean;
  enable_dine_in: boolean;
  enable_table_numbers: boolean;
};

type RestaurantBrand = {
  name: string | null;
  website_title: string | null;
  logo_url: string | null;
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
          'name,website_title,logo_url,logo_shape,menu_header_image_url,menu_header_image_updated_at,menu_header_focal_x,menu_header_focal_y,theme_primary_color'
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
  const [heroReady, setHeroReady] = useState(false);
  const [settings, setSettings] = useState<ExpressSettings | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantBrand | null>(null);
  const [entryError, setEntryError] = useState('');

  const primaryColor = restaurant?.theme_primary_color || '#0f766e';
  const heroImage = restaurant?.menu_header_image_url
    ? `${restaurant.menu_header_image_url}${restaurant.menu_header_image_updated_at ? `?v=${encodeURIComponent(restaurant.menu_header_image_updated_at)}` : ''}`
    : null;

  const logoContainerClassName = useMemo(() => {
    const base =
      'flex shrink-0 items-center justify-center border border-black/10 bg-white/95 p-2 shadow-sm';
    if (restaurant?.logo_shape === 'round') return `${base} h-16 w-16 rounded-full`;
    if (restaurant?.logo_shape === 'rectangular') return `${base} h-16 w-24 rounded-xl`;
    return `${base} h-16 w-16 rounded-2xl`;
  }, [restaurant?.logo_shape]);

  useEffect(() => {
    if (!heroImage || typeof window === 'undefined') {
      setHeroReady(false);
      return;
    }
    setHeroReady(false);
    const image = new window.Image();
    image.decoding = 'async';
    image.onload = () => setHeroReady(true);
    image.onerror = () => setHeroReady(true);
    image.src = heroImage;
  }, [heroImage]);

  const routeToKioskMenu = async (mode: 'takeaway' | 'dine_in', options?: { replace?: boolean }) => {
    if (!restaurantId) return;
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

  const visibleModes = useMemo(() => {
    if (!settings?.enabled) return [];
    const modes: Array<'takeaway' | 'dine_in'> = [];
    if (settings.enable_takeaway) modes.push('takeaway');
    if (settings.enable_dine_in) modes.push('dine_in');
    return modes;
  }, [settings]);

  useEffect(() => {
    if (!restaurantId || loading || !settings) return;

    if (visibleModes.length === 1 && visibleModes[0] === 'takeaway') {
      setExpressSession({ mode: 'takeaway', tableNumber: null, customerName: null, restaurantId, isExpress: true });
      void routeToKioskMenu('takeaway', { replace: true });
      return;
    }

    if (visibleModes.length === 1 && visibleModes[0] === 'dine_in') {
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
  }, [loading, restaurantId, settings, visibleModes]);

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

  if (restaurantLoading || loading) {
    return (
      <div className="relative min-h-screen overflow-hidden p-4 sm:p-8">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-teal-50 via-white to-cyan-50" />
        <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-4xl items-center">
          <div className="w-full space-y-4 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur">
            <div className="h-16 w-48 rounded-xl bg-teal-100/70" />
            <div className="h-7 w-56 rounded bg-teal-100/70" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-36 rounded-2xl bg-teal-100/70" />
              <div className="h-36 rounded-2xl bg-teal-100/70" />
            </div>
          </div>
        </div>
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

  if (!visibleModes.length) {
    return <div className="flex min-h-screen items-center justify-center p-6">No Express modes are currently enabled.</div>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-gray-900">
      <div className="absolute inset-0 min-h-screen">
        {heroImage ? (
          <>
            {!heroReady ? (
              <div
                className="h-full w-full animate-pulse bg-gradient-to-br from-white/50 via-white/30 to-black/5 backdrop-blur-sm"
                style={{ backgroundColor: `${primaryColor}22` }}
              />
            ) : null}
            <img
              src={heroImage}
              alt="Restaurant cover"
              className={`h-full w-full object-cover transition-opacity duration-500 ${heroReady ? 'opacity-100' : 'opacity-0'}`}
              style={{
                objectPosition: `${(restaurant?.menu_header_focal_x ?? 0.5) * 100}% ${(restaurant?.menu_header_focal_y ?? 0.5) * 100}%`,
              }}
            />
          </>
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}22 0%, ${primaryColor}4a 50%, #ffffff 100%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-white/85" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl items-center px-5 py-8 sm:px-8">
        <div className="w-full rounded-3xl border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-900/15 backdrop-blur">
          <div className="flex items-center gap-3">
            {restaurant?.logo_url ? (
              <div className={logoContainerClassName}>
                <img src={restaurant.logo_url} alt="Restaurant logo" className="h-full w-full object-contain" />
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Express order</p>
              <h1 className="text-2xl font-bold text-gray-900">{restaurant?.website_title || restaurant?.name || 'Restaurant'}</h1>
            </div>
          </div>

          <p className="mt-5 text-sm text-gray-600">Choose how you’d like to order.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {settings.enable_takeaway ? (
              <button
                onClick={continueTakeaway}
                className="group rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
              >
                <span className="inline-flex rounded-full bg-teal-50 p-2.5 text-teal-700">
                  <ShoppingBagIcon className="h-6 w-6" />
                </span>
                <p className="mt-4 text-xl font-semibold text-gray-900">Takeaway</p>
                <p className="mt-1 text-sm text-gray-600">Place your order now and pick it up when ready.</p>
              </button>
            ) : null}

            {settings.enable_dine_in ? (
              <button
                onClick={continueDineIn}
                className="group rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
              >
                <span className="inline-flex rounded-full bg-teal-50 p-2.5 text-teal-700">
                  <BuildingStorefrontIcon className="h-6 w-6" />
                </span>
                <p className="mt-4 text-xl font-semibold text-gray-900">Dine-in</p>
                <p className="mt-1 text-sm text-gray-600">Start ordering right away and confirm your table at checkout.</p>
              </button>
            ) : null}
          </div>

          {entryError ? <p className="mt-4 text-sm text-red-600">{entryError}</p> : null}
        </div>
      </div>
    </div>
  );
}
