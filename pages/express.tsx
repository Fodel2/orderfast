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
  menu_header_image_url: string | null;
  menu_header_image_updated_at: string | null;
  menu_header_focal_x: number | null;
  menu_header_focal_y: number | null;
  theme_primary_color: string | null;
};

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
  const [step, setStep] = useState<'mode' | 'table'>('mode');
  const modeHint = typeof router.query.mode === 'string' ? router.query.mode : null;

  const primaryColor = restaurant?.theme_primary_color || '#0f766e';
  const heroImage = restaurant?.menu_header_image_url
    ? `${restaurant.menu_header_image_url}${restaurant.menu_header_image_updated_at ? `?v=${encodeURIComponent(restaurant.menu_header_image_updated_at)}` : ''}`
    : null;

  const routeToKioskMenu = async (mode: 'takeaway' | 'dine_in') => {
    if (!restaurantId) return;
    const ok = await router.push(`/kiosk/${restaurantId}/menu?express=1&mode=${mode}`);
    if (!ok) {
      setEntryError('Unable to continue right now. Please try again.');
    }
  };

  useEffect(() => {
    if (restaurantLoading || !restaurantId) return;

    const load = async () => {
      setLoading(true);
      const [entryRes, brandRes] = await Promise.all([
        fetch(`/api/express/tables?restaurant_id=${restaurantId}`),
        supabase
          .from('restaurants')
          .select('name,website_title,logo_url,menu_header_image_url,menu_header_image_updated_at,menu_header_focal_x,menu_header_focal_y,theme_primary_color')
          .eq('id', restaurantId)
          .maybeSingle<RestaurantBrand>(),
      ]);

      const payload = await entryRes.json().catch(() => ({}));
      if (!entryRes.ok) {
        setSettings(null);
        setTables([]);
        setLoading(false);
        return;
      }

      setSettings((payload.settings as ExpressSettings) || null);
      setTables((payload.tables as RestaurantTable[]) || []);
      setRestaurant(brandRes.data || null);
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
    if (!restaurantId || loading || visibleModes.length !== 1 || !settings) return;
    const onlyMode = visibleModes[0];
    if (onlyMode === 'takeaway') {
      setExpressSession({ mode: 'takeaway', restaurantId });
      router.replace(`/kiosk/${restaurantId}/menu?express=1&mode=takeaway`);
      return;
    }

    if (settings.enable_table_numbers) {
      setStep('table');
      return;
    }

    setExpressSession({
      mode: 'dine_in',
      tableNumber: null,
      tableSessionId: null,
      dineInPaymentMode: 'immediate_pay',
      restaurantId,
    });
    router.replace(`/kiosk/${restaurantId}/menu?express=1&mode=dine_in`);
  }, [loading, restaurantId, router, settings, visibleModes]);

  useEffect(() => {
    if (modeHint === 'dine_in' && settings?.enable_table_numbers) setStep('table');
  }, [modeHint, settings?.enable_table_numbers]);

  const continueTakeaway = () => {
    if (!restaurantId) return;
    setExpressSession({ mode: 'takeaway', restaurantId });
    void routeToKioskMenu('takeaway');
  };

  const continueDineIn = () => {
    if (!restaurantId || !settings) return;
    setEntryError('');

    if (!settings.enable_table_numbers) {
      setExpressSession({
        mode: 'dine_in',
        tableNumber: null,
        tableSessionId: null,
        dineInPaymentMode: 'immediate_pay',
        restaurantId,
      });
      void routeToKioskMenu('dine_in');
      return;
    }

    setStep('table');
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
    return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  }

  if (!restaurantId) {
    return <div className="flex min-h-screen items-center justify-center p-6 text-center">Missing restaurant context.</div>;
  }

  if (!settings?.enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
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
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="relative h-48 sm:h-60">
        {heroImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${heroImage})`,
              backgroundPosition: `${(restaurant?.menu_header_focal_x ?? 0.5) * 100}% ${(restaurant?.menu_header_focal_y ?? 0.5) * 100}%`,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black" />
        )}
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative mx-auto flex h-full w-full max-w-3xl items-end gap-3 px-5 pb-6">
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt="Restaurant logo" className="h-14 w-14 rounded-2xl border border-white/30 object-cover" />
          ) : null}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/80">Express order</p>
            <h1 className="text-3xl font-bold">{restaurant?.website_title || restaurant?.name || 'Restaurant'}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-6">
        {step === 'mode' ? (
          <>
            <p className="text-base text-white/70">Choose how you’d like to order.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {settings.enable_takeaway ? (
                <button
                  onClick={continueTakeaway}
                  className="group rounded-3xl border border-white/15 bg-white/5 p-6 text-left transition hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/10"
                >
                  <ShoppingBagIcon className="h-9 w-9 text-white/80" />
                  <p className="mt-4 text-2xl font-semibold text-white">Takeaway</p>
                  <p className="mt-1 text-sm text-white/70">Pay by card and collect when ready.</p>
                </button>
              ) : null}

              {settings.enable_dine_in ? (
                <button
                  onClick={continueDineIn}
                  className="group rounded-3xl border border-white/15 bg-white/5 p-6 text-left transition hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/10"
                >
                  <BuildingStorefrontIcon className="h-9 w-9 text-white/80" />
                  <p className="mt-4 text-2xl font-semibold text-white">Dine-in</p>
                  <p className="mt-1 text-sm text-white/70">Order from your table and pay by card.</p>
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold text-white">Choose your table</h2>
            <p className="mt-2 text-white/70">Select your table number to continue.</p>

            {!tables.length ? (
              <div className="mt-6 rounded-xl border border-dashed border-white/25 p-4 text-sm text-white/70">
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
                        ? 'border-white bg-white text-neutral-900'
                        : 'border-white/20 bg-white/5 text-white hover:border-white/40'
                    }`}
                  >
                    <p className="text-lg font-semibold">Table {table.table_number}</p>
                    {table.table_name ? <p className="text-xs opacity-80">{table.table_name}</p> : null}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep('mode')} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white">
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

        {entryError ? <p className="mt-4 text-sm text-red-300">{entryError}</p> : null}
      </div>
    </div>
  );
}
