import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  BanknotesIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import KioskLayout from '@/components/layouts/KioskLayout';
import { KioskSessionProvider } from '@/context/KioskSessionContext';
import { supabase } from '@/lib/supabaseClient';
import {
  normalizeKioskPaymentSettings,
  type KioskPaymentMethod,
  type KioskPaymentSettingsRow,
} from '@/lib/kiosk/paymentSettings';
import { tapToPayBridge, type TapToPayStatus } from '@/lib/kiosk/tapToPayBridge';

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

type PaymentStage = 'method_picker' | 'contactless' | 'cash' | 'pay_at_counter';

const PAYMENT_METHOD_META: Record<KioskPaymentMethod, { title: string; subtitle: string; icon: typeof CreditCardIcon }> = {
  contactless: {
    title: 'Contactless',
    subtitle: 'Tap card or phone to pay now',
    icon: CreditCardIcon,
  },
  cash: {
    title: 'Cash',
    subtitle: 'Pay cash at collection point',
    icon: BanknotesIcon,
  },
  pay_at_counter: {
    title: 'Pay at Counter',
    subtitle: 'Place order now and pay staff',
    icon: BuildingStorefrontIcon,
  },
};

export default function KioskPaymentEntryPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;

  return (
    <KioskSessionProvider restaurantId={restaurantId}>
      <KioskPaymentEntryScreen restaurantId={restaurantId} />
    </KioskSessionProvider>
  );
}

function KioskPaymentEntryScreen({ restaurantId }: { restaurantId?: string | null }) {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [enabledMethods, setEnabledMethods] = useState<KioskPaymentMethod[]>(['pay_at_counter']);
  const [stage, setStage] = useState<PaymentStage>('pay_at_counter');
  const [contactlessStatus, setContactlessStatus] = useState<TapToPayStatus>('idle');
  const [contactlessBusy, setContactlessBusy] = useState(false);
  const [contactlessError, setContactlessError] = useState('');
  const [contactlessSessionId, setContactlessSessionId] = useState<string | null>(null);
  const stageParam = Array.isArray(router.query.stage) ? router.query.stage[0] : router.query.stage;
  const preferredStageFromQuery: PaymentStage | null =
    stageParam === 'contactless' || stageParam === 'cash' || stageParam === 'pay_at_counter' || stageParam === 'method_picker'
      ? stageParam
      : null;

  const amountParam = Array.isArray(router.query.amount_cents) ? router.query.amount_cents[0] : router.query.amount_cents;
  const currencyParam = Array.isArray(router.query.currency) ? router.query.currency[0] : router.query.currency;
  const amountCents = Number(amountParam || 0);
  const currency = (currencyParam || 'usd').toLowerCase();

  useEffect(() => {
    if (!restaurantId) {
      setRestaurantLoading(false);
      setSettingsLoading(false);
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
          console.error('[kiosk] failed to fetch restaurant for payment entry', error);
        }
        setRestaurant((data as Restaurant) || null);
      } catch (err) {
        if (!active) return;
        console.error('[kiosk] failed to load payment entry restaurant', err);
      } finally {
        if (active) setRestaurantLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    let active = true;

    const loadSettings = async () => {
      setSettingsLoading(true);
      try {
        const { data, error } = await supabase
          .from('kiosk_payment_settings')
          .select('restaurant_id,process_on_device,enable_cash,enable_contactless,enable_pay_at_counter')
          .eq('restaurant_id', restaurantId)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error('[kiosk] failed to load kiosk payment settings', error);
        }

        const normalized = normalizeKioskPaymentSettings((data as KioskPaymentSettingsRow | null) || null);
        const nextMethods = normalized.enabledMethods;
        setEnabledMethods(nextMethods);

        if (preferredStageFromQuery === 'method_picker' && nextMethods.length > 1) {
          setStage('method_picker');
        } else if (preferredStageFromQuery === 'contactless' && nextMethods.includes('contactless')) {
          setStage('contactless');
        } else if (preferredStageFromQuery === 'cash' && nextMethods.includes('cash')) {
          setStage('cash');
        } else if (preferredStageFromQuery === 'pay_at_counter' && nextMethods.includes('pay_at_counter')) {
          setStage('pay_at_counter');
        } else if (nextMethods.length === 1 && nextMethods[0] === 'contactless') {
          setStage('contactless');
        } else if (nextMethods.length > 1) {
          setStage('method_picker');
        } else if (nextMethods[0] === 'cash') {
          setStage('cash');
        } else {
          setStage('pay_at_counter');
        }
      } catch (err) {
        if (!active) return;
        console.error('[kiosk] failed to resolve kiosk payment methods', err);
        setEnabledMethods(['pay_at_counter']);
        setStage('pay_at_counter');
      } finally {
        if (active) setSettingsLoading(false);
      }
    };

    void loadSettings();

    return () => {
      active = false;
    };
  }, [preferredStageFromQuery, restaurantId]);

  useEffect(() => {
    if (stage !== 'contactless') {
      setContactlessStatus('idle');
      setContactlessSessionId(null);
      setContactlessBusy(false);
      setContactlessError('');
    }
  }, [stage]);

  const runTapToPay = async () => {
    if (!restaurantId || amountCents <= 0 || contactlessBusy) return;
    setContactlessBusy(true);
    setContactlessError('');

    try {
      const readinessRes = await fetch(`/api/kiosk/payments/tap-to-pay-availability?restaurant_id=${encodeURIComponent(restaurantId)}`);
      const readiness = await readinessRes.json();
      if (!readinessRes.ok || !readiness?.tap_to_pay_available) {
        setContactlessStatus('failed');
        setContactlessError('Tap to Pay is not ready for this restaurant yet. Please choose another payment method.');
        return;
      }

      const support = await tapToPayBridge.isTapToPaySupported();
      if (!support.supported) {
        setContactlessStatus('failed');
        setContactlessError(support.reason || 'This device does not support Tap to Pay.');
        return;
      }

      const idempotencyKey = `kiosk_${restaurantId}_${amountCents}_${Date.now()}`;
      const createRes = await fetch('/api/kiosk/payments/card-present/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          amount_cents: amountCents,
          currency,
          idempotency_key: idempotencyKey,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok || !created?.session?.id) {
        setContactlessStatus('failed');
        setContactlessError(created?.error || 'Unable to start Tap to Pay session.');
        return;
      }

      const sessionId = String(created.session.id);
      setContactlessSessionId(sessionId);

      await fetch('/api/kiosk/payments/card-present/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, restaurant_id: restaurantId }),
      });

      const backendBaseUrl = window.location.origin;
      const prepared = await tapToPayBridge.prepareTapToPay({ restaurantId, sessionId, backendBaseUrl });
      if (prepared.status === 'failed' || prepared.status === 'unavailable') {
        setContactlessStatus('failed');
        setContactlessError(prepared.message || 'Tap to Pay preparation failed.');
        await fetch('/api/kiosk/payments/card-present/session-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            restaurant_id: restaurantId,
            next_state: 'failed',
            failure_message: prepared.message || 'Tap to Pay preparation failed',
            event_type: 'native_prepare_failed',
          }),
        });
        return;
      }

      setContactlessStatus('collecting');
      const started = await tapToPayBridge.startTapToPayPayment({ restaurantId, sessionId, backendBaseUrl });
      if (started.status !== 'succeeded') {
        setContactlessStatus(started.status === 'canceled' ? 'canceled' : 'failed');
        setContactlessError(started.message || 'Tap to Pay payment was not successful.');
        await fetch('/api/kiosk/payments/card-present/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, restaurant_id: restaurantId }),
        });
        return;
      }

      const finalizeRes = await fetch('/api/kiosk/payments/card-present/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, restaurant_id: restaurantId }),
      });
      const finalized = await finalizeRes.json();
      if (!finalizeRes.ok || finalized?.session?.state !== 'finalized') {
        setContactlessStatus('processing');
        setContactlessError('Payment is processing. Staff can verify final confirmation shortly.');
        return;
      }

      setContactlessStatus('succeeded');
    } catch (error) {
      setContactlessStatus('failed');
      setContactlessError('Tap to Pay failed. Please retry or choose another payment method.');
      console.error('[kiosk] tap to pay flow failed', error);
    } finally {
      setContactlessBusy(false);
    }
  };

  const stageLabel = useMemo(() => {
    if (stage === 'method_picker') return 'Choose payment method';
    if (stage === 'contactless') return 'Contactless payment';
    if (stage === 'cash') return 'Cash payment';
    return 'Pay at counter';
  }, [stage]);

  const renderMethodPicker = () => (
    <section className="w-full rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-200/70 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kiosk checkout</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Choose how you want to pay</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
        Select your payment method to continue. Real payment processing is still in placeholder mode.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {enabledMethods.map((method) => {
          const meta = PAYMENT_METHOD_META[method];
          const Icon = meta.icon;
          return (
            <button
              key={method}
              type="button"
              onClick={() => {
                if (method === 'contactless') {
                  setStage('contactless');
                  return;
                }
                if (method === 'cash') {
                  setStage('cash');
                  return;
                }
                setStage('pay_at_counter');
              }}
              className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-5 py-6 text-left shadow-sm transition hover:-translate-y-[2px] hover:border-slate-300 hover:shadow-lg"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <Icon className="h-6 w-6" />
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-900">{meta.title}</p>
              <p className="mt-1 text-sm text-slate-600">{meta.subtitle}</p>
            </button>
          );
        })}
      </div>
    </section>
  );

  const renderContactless = () => (
    <section className="w-full rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-200/70 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contactless payment</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Tap card or phone</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
        We will securely prepare and start a Tap to Pay payment session on this kiosk.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Session: {contactlessSessionId ? contactlessSessionId.slice(0, 8) : 'Not started'}</p>
        {contactlessStatus === 'succeeded' ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircleIcon className="h-5 w-5" />
            Payment approved. Final confirmation was validated by the backend.
          </p>
        ) : null}
        {contactlessStatus === 'failed' || contactlessStatus === 'canceled' ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-rose-700">
            <ExclamationTriangleIcon className="h-5 w-5" />
            {contactlessError || 'Tap to Pay did not complete.'}
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void runTapToPay()}
          disabled={contactlessBusy || amountCents <= 0}
          className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {contactlessBusy ? 'Starting Tap to Pay…' : 'Start Tap to Pay'}
        </button>

        <button
          type="button"
          onClick={async () => {
            if (!contactlessSessionId || !restaurantId) return;
            setContactlessBusy(true);
            try {
              await tapToPayBridge.cancelTapToPayPayment();
              await fetch('/api/kiosk/payments/card-present/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: contactlessSessionId, restaurant_id: restaurantId, reason: 'Canceled on kiosk' }),
              });
              setContactlessStatus('canceled');
            } finally {
              setContactlessBusy(false);
            }
          }}
          disabled={contactlessBusy || !contactlessSessionId}
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel Tap to Pay
        </button>
      </div>
    </section>
  );

  const renderCash = () => (
    <section className="w-full rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-200/70 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cash path</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Pay with cash</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
        Cash is enabled. This path is separated and ready for future tendering/change logic.
      </p>
    </section>
  );

  const renderPayAtCounter = () => (
    <section className="w-full rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-200/70 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Default flow</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Pay at Counter</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
        Baseline kiosk behavior is unchanged: place your order and complete payment with staff at the counter.
      </p>
    </section>
  );

  return (
    <KioskLayout restaurantId={restaurantId} restaurant={restaurant} restaurantLoading={restaurantLoading}>
      <div className="mx-auto flex min-h-[58vh] w-full max-w-4xl items-center px-4 py-8 sm:px-6">
        <div className="w-full space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{stageLabel}</p>
            <div className="flex gap-2">
              {stage !== 'method_picker' && enabledMethods.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setStage('method_picker')}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Change method
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!restaurantId) return;
                  router.push(`/kiosk/${restaurantId}/cart`).catch(() => undefined);
                }}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Back to kiosk cart
              </button>
            </div>
          </div>

          {settingsLoading ? (
            <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Loading kiosk payment settings…
            </section>
          ) : null}

          {!settingsLoading && stage === 'method_picker' ? renderMethodPicker() : null}
          {!settingsLoading && stage === 'contactless' ? renderContactless() : null}
          {!settingsLoading && stage === 'cash' ? renderCash() : null}
          {!settingsLoading && stage === 'pay_at_counter' ? renderPayAtCounter() : null}
        </div>
      </div>
    </KioskLayout>
  );
}
