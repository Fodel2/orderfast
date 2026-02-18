import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useRestaurant } from '@/lib/restaurant-context';
import { setExpressSession } from '@/utils/express/session';

type ExpressSettings = {
  enabled: boolean;
  enable_takeaway: boolean;
  enable_dine_in: boolean;
  dine_in_payment_mode: 'immediate_pay' | 'open_tab';
  dine_in_security_mode: 'none' | 'table_code';
};

type RestaurantTable = {
  id: string;
  table_number: number;
  table_name: string | null;
  enabled: boolean;
};

export default function ExpressEntryPage() {
  const router = useRouter();
  const { restaurantId, loading: restaurantLoading } = useRestaurant();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ExpressSettings | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [step, setStep] = useState<'mode' | 'table'>('mode');
  const modeHint = typeof router.query.mode === 'string' ? router.query.mode : null;

  useEffect(() => {
    if (restaurantLoading || !restaurantId) return;

    const load = async () => {
      setLoading(true);
      const response = await fetch(`/api/express/tables?restaurant_id=${restaurantId}`);
      const payload = await response.json();
      if (!response.ok) {
        setSettings(null);
        setTables([]);
        setLoading(false);
        return;
      }

      setSettings((payload.settings as ExpressSettings) || null);
      setTables((payload.tables as RestaurantTable[]) || []);
      setLoading(false);
    };

    load();
  }, [restaurantId, restaurantLoading]);

  const visibleModes = useMemo(() => {
    if (!settings?.enabled) return [];
    const modes: Array<'takeaway' | 'dine_in'> = [];
    if (settings.enable_takeaway) modes.push('takeaway');
    if (settings.enable_dine_in) modes.push('dine_in');
    return modes;
  }, [settings]);

  useEffect(() => {
    if (!restaurantId || loading || visibleModes.length !== 1) return;
    const onlyMode = visibleModes[0];
    if (onlyMode === 'takeaway') {
      setExpressSession({ mode: 'takeaway', restaurantId });
      router.replace(`/kiosk/${restaurantId}/menu?express=1&mode=takeaway`);
    } else {
      setStep('table');
    }
  }, [loading, restaurantId, router, visibleModes]);

  useEffect(() => {
    if (modeHint === 'dine_in') setStep('table');
  }, [modeHint]);

  const continueTakeaway = () => {
    if (!restaurantId) return;
    setExpressSession({ mode: 'takeaway', restaurantId });
    router.push(`/kiosk/${restaurantId}/menu?express=1&mode=takeaway`);
  };

  const continueDineIn = () => {
    setStep('table');
  };

  const continueAfterTable = () => {
    if (!restaurantId || !selectedTable || !settings) return;
    if (settings.dine_in_security_mode === 'table_code' && !code.trim()) {
      setCodeError('Please enter your table code.');
      return;
    }

    void (async () => {
      const response = await fetch('/api/express/table-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          table_number: selectedTable.table_number,
          entered_code: code.trim(),
          security_mode: settings.dine_in_security_mode,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setCodeError(payload?.error || 'Unable to start your table session.');
        return;
      }

      setExpressSession({
        mode: 'dine_in',
        tableNumber: selectedTable.table_number,
        tableSessionId: payload.table_session_id,
        dineInPaymentMode: settings.dine_in_payment_mode,
        restaurantId,
      });
      router.push(`/kiosk/${restaurantId}/menu?express=1&mode=dine_in`);
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
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        {step === 'mode' ? (
          <>
            <h1 className="text-3xl font-bold text-gray-900">Start your Express Order</h1>
            <p className="mt-2 text-gray-600">Choose how you’d like to order.</p>
            <div className="mt-6 grid gap-4">
              {settings.enable_takeaway ? (
                <button
                  onClick={continueTakeaway}
                  className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-left transition hover:border-gray-300 hover:shadow-sm"
                >
                  <p className="text-2xl font-semibold text-gray-900">Takeaway</p>
                  <p className="mt-1 text-sm text-gray-600">Pay now by card and collect when ready.</p>
                </button>
              ) : null}

              {settings.enable_dine_in ? (
                <button
                  onClick={continueDineIn}
                  className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-left transition hover:border-gray-300 hover:shadow-sm"
                >
                  <p className="text-2xl font-semibold text-gray-900">Dine-in</p>
                  <p className="mt-1 text-sm text-gray-600">Select your table and order from your seat.</p>
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900">Choose your table</h1>
            <p className="mt-2 text-gray-600">Select your table number to continue.</p>

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
                      setCode('');
                      setCodeError('');
                    }}
                    className={`rounded-xl border px-4 py-4 text-left ${
                      selectedTable?.id === table.id
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-gray-200 bg-white text-gray-900'
                    }`}
                  >
                    <p className="text-lg font-semibold">Table {table.table_number}</p>
                    {table.table_name ? <p className="text-xs text-gray-500">{table.table_name}</p> : null}
                  </button>
                ))}
              </div>
            )}

            {settings.dine_in_security_mode === 'table_code' && selectedTable ? (
              <div className="mt-5 rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-800">Enter table code</p>
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setCodeError('');
                  }}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-lg tracking-[0.2em]"
                  maxLength={4}
                  placeholder="----"
                />
                {codeError ? <p className="mt-2 text-sm text-red-600">{codeError}</p> : null}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep('mode')} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">
                Back
              </button>
              <button
                disabled={!selectedTable}
                onClick={continueAfterTable}
                className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
