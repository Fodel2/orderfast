import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../../components/DashboardLayout';
import { supabase } from '../../../utils/supabaseClient';
import { DEFAULT_KIOSK_PAYMENT_SETTINGS, type KioskPaymentSettingsRow } from '@/lib/kiosk/paymentSettings';
import { InputToggle } from '@/components/ui/InputToggle';

type KioskPaymentDraft = {
  process_on_device: boolean;
  enable_cash: boolean;
  enable_contactless: boolean;
  enable_pay_at_counter: boolean;
};

const defaultDraft: KioskPaymentDraft = {
  process_on_device: DEFAULT_KIOSK_PAYMENT_SETTINGS.process_on_device,
  enable_cash: DEFAULT_KIOSK_PAYMENT_SETTINGS.enable_cash,
  enable_contactless: DEFAULT_KIOSK_PAYMENT_SETTINGS.enable_contactless,
  enable_pay_at_counter: DEFAULT_KIOSK_PAYMENT_SETTINGS.enable_pay_at_counter,
};

export default function DashboardSettingsPaymentsPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<KioskPaymentDraft>(defaultDraft);

  const processOnDevice = settings.process_on_device;
  const hasEnabledDeviceMethod = settings.enable_cash || settings.enable_contactless || settings.enable_pay_at_counter;

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      setMessage('Please log in to manage payment settings.');
      return;
    }

    const { data: membership, error: membershipError } = await supabase
      .from('restaurant_users')
      .select('restaurant_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (membershipError || !membership?.restaurant_id) {
      setLoading(false);
      setMessage('Unable to resolve your restaurant context.');
      return;
    }

    const nextRestaurantId = membership.restaurant_id as string;
    setRestaurantId(nextRestaurantId);

    const { data: row, error } = await supabase
      .from('kiosk_payment_settings')
      .select('restaurant_id,process_on_device,enable_cash,enable_contactless,enable_pay_at_counter')
      .eq('restaurant_id', nextRestaurantId)
      .maybeSingle();

    if (error) {
      setMessage(`Failed to load kiosk payment settings: ${error.message}`);
      setSettings(defaultDraft);
      setLoading(false);
      return;
    }

    if (!row) {
      setSettings(defaultDraft);
      setLoading(false);
      return;
    }

    setSettings({
      process_on_device: !!row.process_on_device,
      enable_cash: !!row.enable_cash,
      enable_contactless: !!row.enable_contactless,
      enable_pay_at_counter: row.enable_pay_at_counter !== false,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const onSave = useCallback(async () => {
    if (!restaurantId) return;
    setSaving(true);
    setMessage('');

    const payload: KioskPaymentSettingsRow = {
      restaurant_id: restaurantId,
      process_on_device: settings.process_on_device,
      enable_cash: settings.enable_cash,
      enable_contactless: settings.enable_contactless,
      enable_pay_at_counter: settings.enable_pay_at_counter,
    };

    const { error } = await supabase.from('kiosk_payment_settings').upsert(payload, {
      onConflict: 'restaurant_id',
    });

    setSaving(false);

    if (error) {
      setMessage(`Failed to save kiosk payment settings: ${error.message}`);
      return;
    }

    setMessage('Kiosk payment settings saved.');
  }, [restaurantId, settings]);

  if (loading) {
    return <DashboardLayout>Loading payment settings...</DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
          ← Settings Home
        </Link>

        <header>
          <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
          <p className="mt-2 text-sm text-gray-600">
            Choose whether customers pay on the kiosk or submit orders first and pay your team separately at collection,
            preparation, or hand-off.
          </p>
        </header>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Kiosk payment processing</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Device payments are <strong>off by default</strong>. Turn this on only when you want customers to choose a
            payment method during kiosk checkout.
          </p>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
              <InputToggle
                checked={processOnDevice}
                onChange={(checked) =>
                  setSettings((prev) => {
                    if (checked) {
                      return {
                        ...prev,
                        process_on_device: true,
                        enable_cash: false,
                        enable_contactless: false,
                        enable_pay_at_counter: false,
                      };
                    }
                    return {
                      ...prev,
                      process_on_device: false,
                    };
                  })
                }
                label={
                  <div className="pr-4">
                    <p className="text-sm font-semibold text-gray-900">Process kiosk payments on this device</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Whenever this is switched on after being off, all payment methods start unselected so you can choose
                      them intentionally.
                    </p>
                  </div>
                }
              />
            </div>

            {processOnDevice ? (
              <div className="rounded-2xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-900">Allowed kiosk checkout payment methods</p>
                <p className="mt-1 text-xs text-gray-500">Select the methods you want customers to see during checkout.</p>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.enable_cash}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          enable_cash: event.target.checked,
                        }))
                      }
                    />
                    Cash
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.enable_contactless}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          enable_contactless: event.target.checked,
                        }))
                      }
                    />
                    Contactless
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.enable_pay_at_counter}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          enable_pay_at_counter: event.target.checked,
                        }))
                      }
                    />
                    Pay at Counter
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || !restaurantId}
              className="inline-flex min-w-[160px] items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save payment settings'}
            </button>
            {message ? <p className="text-sm text-gray-600">{message}</p> : null}
          </div>

          {processOnDevice && !hasEnabledDeviceMethod ? (
            <p className="mt-3 text-xs text-amber-700">
              No kiosk payment methods are selected yet. Checkout will fall back to pay-at-counter behavior until you
              choose at least one method.
            </p>
          ) : null}
        </section>
      </div>
    </DashboardLayout>
  );
}
