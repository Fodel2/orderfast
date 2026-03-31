import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../../components/DashboardLayout';
import { supabase } from '../../../utils/supabaseClient';
import { DEFAULT_KIOSK_PAYMENT_SETTINGS, type KioskPaymentSettingsRow } from '@/lib/kiosk/paymentSettings';
import { InputToggle } from '@/components/ui/InputToggle';
import type { StripeConnectionReadiness, StripeConnectionSnapshot } from '@/lib/payments/stripeConnect';

type SettingsTab = 'kiosk' | 'stripe';

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

const shortAccount = (accountId: string | null) => {
  if (!accountId) return '—';
  if (accountId.length <= 12) return accountId;
  return `${accountId.slice(0, 8)}…${accountId.slice(-4)}`;
};

export default function DashboardSettingsPaymentsPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<KioskPaymentDraft>(defaultDraft);
  const [tab, setTab] = useState<SettingsTab>('kiosk');

  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeActionBusy, setStripeActionBusy] = useState(false);
  const [stripeError, setStripeError] = useState('');
  const [stripeSnapshot, setStripeSnapshot] = useState<StripeConnectionSnapshot | null>(null);
  const [stripeReadiness, setStripeReadiness] = useState<StripeConnectionReadiness | null>(null);

  const processOnDevice = settings.process_on_device;
  const hasEnabledDeviceMethod = settings.enable_cash || settings.enable_contactless || settings.enable_pay_at_counter;

  const loadStripeStatus = useCallback(async () => {
    setStripeLoading(true);
    setStripeError('');
    try {
      const response = await fetch('/api/dashboard/payments/stripe/status');
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Could not load Stripe connection status.');
      }
      setStripeSnapshot(payload.snapshot ?? null);
      setStripeReadiness(payload.readiness ?? null);
    } catch (error: any) {
      setStripeError(error?.message || 'Could not load Stripe connection status.');
      setStripeSnapshot(null);
      setStripeReadiness(null);
    } finally {
      setStripeLoading(false);
    }
  }, []);

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
    void loadStripeStatus();
  }, [loadSettings, loadStripeStatus]);

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

  const createOnboardingLink = useCallback(async () => {
    setStripeActionBusy(true);
    setStripeError('');
    try {
      const response = await fetch('/api/dashboard/payments/stripe/onboarding-link', {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.message || 'Could not open Stripe onboarding right now.');
      }
      window.location.assign(payload.url);
    } catch (error: any) {
      setStripeError(error?.message || 'Could not open Stripe onboarding right now.');
      setStripeActionBusy(false);
    }
  }, []);

  const refreshStripeStatus = useCallback(async () => {
    setStripeActionBusy(true);
    setStripeError('');
    try {
      const response = await fetch('/api/dashboard/payments/stripe/refresh', {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Could not refresh Stripe status.');
      }
      setStripeSnapshot(payload.snapshot ?? null);
      setStripeReadiness(payload.readiness ?? null);
    } catch (error: any) {
      setStripeError(error?.message || 'Could not refresh Stripe status.');
    } finally {
      setStripeActionBusy(false);
    }
  }, []);

  const onStripePrimaryAction = useCallback(async () => {
    const action = stripeReadiness?.primary_action;
    if (action === 'connect' || action === 'continue_setup' || action === 'manage_stripe') {
      await createOnboardingLink();
      return;
    }
    await refreshStripeStatus();
  }, [createOnboardingLink, refreshStripeStatus, stripeReadiness?.primary_action]);

  const stripePrimaryLabel = useMemo(() => {
    const action = stripeReadiness?.primary_action;
    if (action === 'connect') return 'Connect Stripe';
    if (action === 'continue_setup') return 'Continue setup';
    if (action === 'refresh_status') return 'Refresh status';
    return 'Manage Stripe';
  }, [stripeReadiness?.primary_action]);

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
            Manage kiosk checkout behavior and restaurant-level Stripe connection setup for future card and Tap to Pay
            routing.
          </p>
        </header>

        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 text-sm shadow-sm">
          <button
            type="button"
            onClick={() => setTab('kiosk')}
            className={`rounded-lg px-3 py-2 font-medium transition ${
              tab === 'kiosk' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Kiosk
          </button>
          <button
            type="button"
            onClick={() => setTab('stripe')}
            className={`rounded-lg px-3 py-2 font-medium transition ${
              tab === 'stripe' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Stripe
          </button>
        </div>

        {tab === 'kiosk' ? (
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
                        Whenever this is switched on after being off, all payment methods start unselected so you can
                        choose them intentionally.
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
        ) : (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Stripe connection</h2>
            <p className="mt-2 text-sm text-gray-600">
              Connect Stripe once for this restaurant. Orderfast will use this account for future card, Terminal, and Tap
              to Pay routing.
            </p>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
              {stripeLoading ? (
                <p className="text-sm text-gray-500">Loading Stripe status…</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Status</p>
                      <p className="mt-1 text-sm text-gray-700">{stripeReadiness?.heading || 'Not connected'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onStripePrimaryAction()}
                      disabled={stripeActionBusy}
                      className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {stripeActionBusy ? 'Please wait…' : stripePrimaryLabel}
                    </button>
                  </div>

                  <p className="mt-3 text-sm text-gray-600">
                    {stripeReadiness?.description || 'Connect Stripe to begin payment setup.'}
                  </p>

                  {(stripeReadiness?.status === 'setup_incomplete' ||
                    stripeReadiness?.status === 'under_review' ||
                    stripeReadiness?.status === 'restricted') && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Card payments and Tap to Pay cannot be enabled until Stripe setup is fully complete for this restaurant.
                    </p>
                  )}

                  <dl className="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Stripe account</dt>
                      <dd className="mt-1 font-medium text-gray-900">{shortAccount(stripeSnapshot?.stripe_connected_account_id || null)}</dd>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Card charge capability</dt>
                      <dd className="mt-1 font-medium text-gray-900">{stripeSnapshot?.charges_enabled ? 'Enabled' : 'Not enabled'}</dd>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Payout capability</dt>
                      <dd className="mt-1 font-medium text-gray-900">{stripeSnapshot?.payouts_enabled ? 'Enabled' : 'Not enabled'}</dd>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Tap to Pay readiness</dt>
                      <dd className="mt-1 font-medium text-gray-900">
                        {stripeReadiness?.tap_to_pay_available ? 'Available in next phase' : 'Unavailable'}
                      </dd>
                    </div>
                  </dl>

                  {stripeSnapshot?.disabled_reason ? (
                    <p className="mt-3 text-xs text-gray-500">Stripe note: {stripeSnapshot.disabled_reason}</p>
                  ) : null}
                  {stripeError ? <p className="mt-3 text-sm text-red-600">{stripeError}</p> : null}
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
