import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabaseClient';
import QRCode from 'qrcode';

type ExpressSettings = {
  restaurant_id: string;
  enabled: boolean;
  enable_takeaway: boolean;
  enable_dine_in: boolean;
  takeaway_payment_mode: 'card_only';
  dine_in_payment_mode: 'immediate_pay' | 'open_tab';
  dine_in_security_mode: 'none' | 'table_code';
};

type RestaurantTable = {
  id: string;
  restaurant_id: string;
  table_number: number;
  table_name: string | null;
  enabled: boolean;
};

const defaultSettings: Omit<ExpressSettings, 'restaurant_id'> = {
  enabled: false,
  enable_takeaway: true,
  enable_dine_in: true,
  takeaway_payment_mode: 'card_only',
  dine_in_payment_mode: 'immediate_pay',
  dine_in_security_mode: 'table_code',
};

export default function ExpressOrderSettingsPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<ExpressSettings | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [startRange, setStartRange] = useState(1);
  const [endRange, setEndRange] = useState(10);

  const loadData = useCallback(async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: membership } = await supabase
      .from('restaurant_users')
      .select('restaurant_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!membership?.restaurant_id) {
      setLoading(false);
      return;
    }

    const rid = membership.restaurant_id as string;
    setRestaurantId(rid);

    const [{ data: settingsData }, { data: tableData }] = await Promise.all([
      supabase.from('express_order_settings').select('*').eq('restaurant_id', rid).maybeSingle(),
      supabase
        .from('restaurant_tables')
        .select('id,restaurant_id,table_number,table_name,enabled')
        .eq('restaurant_id', rid)
        .order('table_number', { ascending: true }),
    ]);

    if (settingsData) {
      const normalized = {
        ...(settingsData as ExpressSettings),
        takeaway_payment_mode: 'card_only' as const,
        dine_in_payment_mode: 'immediate_pay' as const,
      };
      setSettings(normalized);

      if (
        settingsData.dine_in_payment_mode !== 'immediate_pay' ||
        settingsData.takeaway_payment_mode !== 'card_only'
      ) {
        await supabase
          .from('express_order_settings')
          .update({ takeaway_payment_mode: 'card_only', dine_in_payment_mode: 'immediate_pay' })
          .eq('restaurant_id', rid);
      }
    } else {
      const bootstrap: ExpressSettings = { restaurant_id: rid, ...defaultSettings };
      setSettings(bootstrap);
      await supabase.from('express_order_settings').insert([bootstrap]);
    }

    setTables((tableData as RestaurantTable[]) || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const entryUrl = useMemo(() => {
    if (!restaurantId) return '';
    if (typeof window === 'undefined') return `/express?restaurant_id=${restaurantId}&mode=entry`;
    return `${window.location.origin}/express?restaurant_id=${restaurantId}&mode=entry`;
  }, [restaurantId]);

  const persistSettings = useCallback(async (nextSettings: ExpressSettings) => {
    const normalized = {
      ...nextSettings,
      takeaway_payment_mode: 'card_only' as const,
      dine_in_payment_mode: 'immediate_pay' as const,
    };
    setSettings(normalized);
    setSaving(true);
    const { error } = await supabase.from('express_order_settings').upsert(normalized, {
      onConflict: 'restaurant_id',
    });
    setSaving(false);
    setMessage(error ? 'Failed to save settings.' : 'Settings saved.');
  }, []);

  const addTableRange = useCallback(async () => {
    if (!restaurantId) return;
    if (startRange > endRange) {
      setMessage('Start must be lower than end.');
      return;
    }
    const existing = new Set(tables.map((t) => t.table_number));
    const rows: Partial<RestaurantTable>[] = [];
    for (let number = startRange; number <= endRange; number += 1) {
      if (!existing.has(number)) {
        rows.push({
          restaurant_id: restaurantId,
          table_number: number,
          enabled: true,
        });
      }
    }

    if (!rows.length) {
      setMessage('All tables in that range already exist.');
      return;
    }

    const { error } = await supabase.from('restaurant_tables').insert(rows);
    if (error) {
      setMessage('Could not create tables.');
      return;
    }
    setMessage(`Added ${rows.length} table(s).`);
    await loadData();
  }, [endRange, loadData, restaurantId, startRange, tables]);

  const deleteTable = useCallback(async (tableId: string) => {
    const { error } = await supabase.from('restaurant_tables').delete().eq('id', tableId);
    if (error) {
      setMessage('Could not remove table.');
      return;
    }
    setTables((prev) => prev.filter((table) => table.id !== tableId));
    setMessage('Table removed.');
  }, []);

  const copyLink = useCallback(async () => {
    if (!entryUrl) return;
    await navigator.clipboard.writeText(entryUrl);
    setMessage('Link copied.');
  }, [entryUrl]);

  const downloadQr = useCallback(async () => {
    if (!entryUrl) return;
    const dataUrl = await QRCode.toDataURL(entryUrl, { width: 1024, margin: 2 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'express-order-qr.png';
    a.click();
  }, [entryUrl]);

  if (loading || !settings) {
    return <DashboardLayout>Loading...</DashboardLayout>;
  }

  const enableTableNumbers = settings.dine_in_security_mode === 'table_code';

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Express Order</h1>
          <p className="mt-1 text-sm text-gray-600">Configure quick customer self-ordering.</p>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Status</h2>
          <label className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 p-4">
            <span className="font-medium text-gray-800">Enable Express Order</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => persistSettings({ ...settings, enabled: e.target.checked })}
            />
          </label>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Modes</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
              <span className="font-medium text-gray-800">Takeaway</span>
              <input
                type="checkbox"
                disabled={!settings.enabled}
                checked={settings.enable_takeaway}
                onChange={(e) => persistSettings({ ...settings, enable_takeaway: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
              <span className="font-medium text-gray-800">Dine-in</span>
              <input
                type="checkbox"
                disabled={!settings.enabled}
                checked={settings.enable_dine_in}
                onChange={(e) => persistSettings({ ...settings, enable_dine_in: e.target.checked })}
              />
            </label>
          </div>

          <label className="mt-3 flex items-center justify-between rounded-xl border border-gray-200 p-4">
            <div>
              <p className="font-medium text-gray-800">Enable table numbers</p>
              <p className="text-xs text-gray-500">If off, dine-in skips table selection.</p>
            </div>
            <input
              type="checkbox"
              disabled={!settings.enabled || !settings.enable_dine_in}
              checked={enableTableNumbers}
              onChange={(e) =>
                persistSettings({
                  ...settings,
                  dine_in_security_mode: e.target.checked ? 'table_code' : 'none',
                })
              }
            />
          </label>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
          <p className="mt-2 text-sm text-gray-600">Express and Kiosk always use immediate card payment.</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Tables</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-sm text-gray-700">
              Start
              <input className="mt-1 rounded-lg border px-3 py-2" type="number" value={startRange} onChange={(e) => setStartRange(Number(e.target.value))} />
            </label>
            <label className="flex flex-col text-sm text-gray-700">
              End
              <input className="mt-1 rounded-lg border px-3 py-2" type="number" value={endRange} onChange={(e) => setEndRange(Number(e.target.value))} />
            </label>
            <button onClick={addTableRange} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Add missing tables</button>
          </div>

          <div className="mt-4 space-y-2">
            {!tables.length ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">No tables yet. Add a range to get started.</div>
            ) : (
              tables.map((table) => (
                <div key={table.id} className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center">
                  <span className="text-sm font-semibold text-gray-900">#{table.table_number}</span>
                  <input
                    className="rounded-lg border px-3 py-2 text-sm"
                    value={table.table_name || ''}
                    placeholder="Optional name"
                    onChange={(e) => setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, table_name: e.target.value } : t)))}
                    onBlur={async () => {
                      await supabase.from('restaurant_tables').update({ table_name: table.table_name || null }).eq('id', table.id);
                    }}
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={table.enabled}
                      onChange={async (e) => {
                        const enabled = e.target.checked;
                        setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, enabled } : t)));
                        await supabase.from('restaurant_tables').update({ enabled }).eq('id', table.id);
                      }}
                    />
                    Enabled
                  </label>
                  <button
                    onClick={() => deleteTable(table.id)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Entry link & QR</h2>
          <p className="mt-3 break-all rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{entryUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={copyLink} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800">Copy link</button>
            <button onClick={downloadQr} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">Download QR (PNG)</button>
          </div>
        </section>

        <p className="text-sm text-gray-500">{saving ? 'Saving…' : message}</p>
      </div>
    </DashboardLayout>
  );
}
