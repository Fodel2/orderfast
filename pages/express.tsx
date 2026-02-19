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

type RestaurantTable = {
  id: string;
  table_number: number;
  table_name: string | null;
  enabled: boolean;
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
  tables: RestaurantTable[];
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
      tables: entryRes.ok ? ((payload.tables as RestaurantTable[]) || []) : [],
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
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [restaurant, setRestaurant] = useState<RestaurantBrand | null>(null);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [entryError, setEntryError] = useState('');
  const [submittingTable, setSubmittingTable] = useState(false);
  const [step, setStep] = useState<'takeaway_start' | 'mode' | 'table'>('mode');
  const modeHint = typeof router.query.mode === 'string' ? router.query.mode : null;

  const primaryColor = restaurant?.theme_primary_color || '#0f766e';
  const heroImage = restaurant?.menu_header_image_url
    ? `${restaurant.menu_header_image_url}${restaurant.menu_header_image_updated_at ? `?v=${encodeURIComponent(restaurant.menu_header_image_updated_at)}` : ''}`
    : null;

  const logoClassName = useMemo(() => {
    const base = 'h-14 w-14 border border-black/10 bg-white object-contain';
    if (restaurant?.logo_shape === 'round') return `${base} rounded-full`;
    if (restaurant?.logo_shape === 'rectangular') return `${base} h-12 w-20 rounded-xl`;
    return `${base} rounded-2xl`;
  }, [restaurant?.logo_shape]);

  useEffect(() => {
    if (!heroImage || typeof window === 'undefined') return;
    const image = new window.Image();
    image.decoding = 'async';
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
      setTables(data.tables);
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

    if (modeHint === 'dine_in' && settings.enable_table_numbers) {
      setStep('table');
      return;
    }

    if (visibleModes.length === 1 && visibleModes[0] === 'takeaway') {
      setStep('takeaway_start');
      return;
    }

    if (visibleModes.length === 1 && visibleModes[0] === 'dine_in') {
      setExpressSession({
        mode: 'dine_in',
        tableNumber: null,
        tableSessionId: null,
        dineInPaymentMode: 'immediate_pay',
        restaurantId,
        isExpress: true,
      });
      void routeToKioskMenu('dine_in', { replace: true });
      return;
    }

    setStep('mode');
  }, [loading, modeHint, restaurantId, router, settings, visibleModes]);

  const continueTakeaway = () => {
    if (!restaurantId) return;
    setExpressSession({ mode: 'takeaway', restaurantId, isExpress: true });
    void routeToKioskMenu('takeaway');
  };

  const continueDineIn = () => {
    if (!restaurantId || !settings) return;
    setEntryError('');

    setExpressSession({
      mode: 'dine_in',
      tableNumber: null,
      tableSessionId: null,
      dineInPaymentMode: 'immediate_pay',
      restaurantId,
      isExpress: true,
    });
    void routeToKioskMenu('dine_in');
  };

  const continueAfterTable = () => {
    if (!restaurantId || !selectedTable || !settings) return;
    setEntryError('');
    setSubmittingTable(true);

    void (async () => {
      try {
        const response = await fetch('/api/express/table-entry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurant_id: restaurantId,
            table_number: selectedTable.table_number,
            mode: 'dine_in',
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = payload?.error || `Request failed (${response.status})`;
          if (process.env.NODE_ENV !== 'production') {
            console.error('Express table-entry failed', { status: response.status, body: payload });
          }
          setEntryError(message);
          return;
        }

        setExpressSession({
          mode: 'dine_in',
          tableNumber: selectedTable.table_number,
          tableSessionId: null,
          dineInPaymentMode: 'immediate_pay',
          restaurantId,
          isExpress: true,
        });
        await routeToKioskMenu('dine_in');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected network error';
        if (process.env.NODE_ENV !== 'production') {
          console.error('Express table-entry request error', error);
        }
        setEntryError(message);
      } finally {
        setSubmittingTable(false);
      }
    })();
  };

  if (restaurantLoading || loading) {
    return (
      <div className="min-h-screen bg-[#f7faf9] p-4 sm:p-8">
        <div className="mx-auto w-full max-w-3xl animate-pulse space-y-4">
          <div className="h-56 rounded-3xl bg-teal-100/70" />
          <div className="h-7 w-56 rounded bg-teal-100/70" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-36 rounded-2xl bg-teal-100/70" />
            <div className="h-36 rounded-2xl bg-teal-100/70" />
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
      <div className="flex min-h-screen items-center justify-center bg-[#f7faf9] p-6">
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
    <div className="min-h-screen bg-[#f7faf9] text-gray-900">
      <div className="relative h-52 sm:h-64">
        {heroImage ? (
          <img
            src={heroImage}
            alt="Restaurant cover"
            className="h-full w-full object-cover"
            style={{
              objectPosition: `${(restaurant?.menu_header_focal_x ?? 0.5) * 100}% ${(restaurant?.menu_header_focal_y ?? 0.5) * 100}%`,
            }}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}33 0%, ${primaryColor}55 55%, #ffffff 100%)`,
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.55), rgba(255,255,255,0.15) 45%, rgba(255,255,255,0))',
          }}
        />
      </div>

      <div className="mx-auto -mt-10 w-full max-w-3xl px-5 pb-10">
        <div className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-xl shadow-slate-200/70 backdrop-blur">
          <div className="flex items-center gap-3">
            {restaurant?.logo_url ? (
              <img src={restaurant.logo_url} alt="Restaurant logo" className={logoClassName} />
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Express order</p>
              <h1 className="text-2xl font-bold text-gray-900">{restaurant?.website_title || restaurant?.name || 'Restaurant'}</h1>
            </div>
          </div>

          {step === 'takeaway_start' ? (
            <div className="mt-6 rounded-3xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/70 p-6">
              <p className="text-sm text-gray-600">Ready to start?</p>
              <button
                onClick={continueTakeaway}
                style={{ backgroundColor: primaryColor }}
                className="mt-4 w-full rounded-2xl px-5 py-4 text-lg font-semibold text-white shadow-sm transition active:scale-[0.99]"
              >
                Tap to Order
              </button>
            </div>
          ) : step === 'mode' ? (
            <>
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
                    <p className="mt-1 text-sm text-gray-600">Start ordering right away and set your table from the menu header.</p>
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-5 text-2xl font-bold text-gray-900">Choose your table</h2>
              <p className="mt-1 text-sm text-gray-600">Select your table number to continue.</p>

              {!tables.length ? (
                <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                  No enabled tables are available right now.
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {tables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => {
                        setSelectedTable(table);
                        setEntryError('');
                      }}
                      className={`rounded-xl border px-4 py-4 text-left transition ${
                        selectedTable?.id === table.id
                          ? 'border-teal-500 bg-teal-50 text-teal-800'
                          : 'border-gray-200 bg-white text-gray-900 hover:border-teal-300'
                      }`}
                    >
                      <p className="text-lg font-semibold">Table {table.table_number}</p>
                      {table.table_name ? <p className="text-xs text-gray-500">{table.table_name}</p> : null}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep('mode')} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">
                  Back
                </button>
                <button
                  disabled={!selectedTable || submittingTable}
                  onClick={continueAfterTable}
                  style={{ backgroundColor: primaryColor }}
                  className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submittingTable ? 'Starting…' : 'Continue'}
                </button>
              </div>
            </>
          )}

          {entryError ? <p className="mt-4 text-sm text-red-600">{entryError}</p> : null}
        </div>
      </div>
    </div>
  );
}
