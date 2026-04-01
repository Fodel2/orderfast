import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const CONTACTLESS_SESSION_STORAGE_KEY = 'orderfast_kiosk_contactless_session';
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
  const [contactlessDebug, setContactlessDebug] = useState('idle');
  const [paymentNotice, setPaymentNotice] = useState('');
  const flowLockRef = useRef(false);
  const cancelLockRef = useRef(false);
  const stageParam = Array.isArray(router.query.stage) ? router.query.stage[0] : router.query.stage;
  const debugParam = Array.isArray(router.query.debug) ? router.query.debug[0] : router.query.debug;
  const operatorParam = Array.isArray(router.query.operator) ? router.query.operator[0] : router.query.operator;
  const showOperatorDetails = debugParam === '1' || operatorParam === '1';
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
      setContactlessDebug('idle');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
    }
  }, [CONTACTLESS_SESSION_STORAGE_KEY, stage]);

  const reconcileSession = useCallback(
    async (sessionId: string, reason: string) => {
      if (!restaurantId) return;
      setContactlessDebug(`reconciling:${reason}`);
      const reconcileRes = await fetch('/api/kiosk/payments/card-present/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, restaurant_id: restaurantId }),
      });
      const reconciled = await reconcileRes.json().catch(() => ({}));
      const nextState = reconciled?.session?.state;
      if (!reconcileRes.ok) {
        setContactlessStatus('failed');
        setContactlessError('Payment failed, please try again or choose another payment method.');
        setContactlessDebug('reconcile_failed');
        return;
      }
      if (nextState === 'finalized' || nextState === 'succeeded') {
        setContactlessStatus('succeeded');
        setContactlessError('');
        setContactlessDebug(`reconciled:${nextState}`);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
        }
        return;
      }
      if (nextState === 'canceled') {
        setContactlessStatus('canceled');
        setContactlessError('Payment cancelled');
        setContactlessDebug('reconciled:canceled');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
        }
        return;
      }
      setContactlessStatus('processing');
      setContactlessError('');
      setContactlessDebug(`reconciled:${nextState || 'unknown'}`);
    },
    [CONTACTLESS_SESSION_STORAGE_KEY, restaurantId]
  );

  const loadServerSessionTruth = useCallback(
    async (sessionId: string, reason: string) => {
      if (!restaurantId) return;
      setContactlessDebug(`session_check:${reason}`);
      const sessionRes = await fetch(
        `/api/kiosk/payments/card-present/session?session_id=${encodeURIComponent(sessionId)}&restaurant_id=${encodeURIComponent(restaurantId)}`
      );
      const payload = await sessionRes.json().catch(() => ({}));
      if (!sessionRes.ok) {
        setContactlessDebug('session_check_failed');
        return;
      }
      const serverState = payload?.session?.state as string | undefined;
      if (!serverState) return;
      if (serverState === 'finalized' || serverState === 'succeeded') {
        setContactlessStatus('succeeded');
        setContactlessError('');
        setContactlessDebug(`server:${serverState}`);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
        }
        return;
      }
      if (serverState === 'canceled' || serverState === 'failed') {
        setContactlessStatus(serverState === 'canceled' ? 'canceled' : 'failed');
        setContactlessError(
          serverState === 'canceled'
            ? 'Payment cancelled'
            : 'Payment failed, please try again or choose another payment method.'
        );
        setContactlessDebug(`server:${serverState}`);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
        }
        return;
      }
      if (serverState === 'processing' || serverState === 'needs_reconciliation' || serverState === 'collecting') {
        setContactlessStatus('processing');
        setContactlessError('');
        setContactlessDebug(`server:${serverState}`);
      }
    },
    [CONTACTLESS_SESSION_STORAGE_KEY, restaurantId]
  );

  const runTapToPay = useCallback(async () => {
    if (!restaurantId || amountCents <= 0 || contactlessBusy || flowLockRef.current) return;
    flowLockRef.current = true;
    setContactlessBusy(true);
    setContactlessError('');
    setContactlessDebug('starting');

    try {
      const readinessRes = await fetch(`/api/kiosk/payments/tap-to-pay-availability?restaurant_id=${encodeURIComponent(restaurantId)}`);
      setContactlessDebug('readiness_check');
      const readiness = await readinessRes.json();
      if (!readinessRes.ok || !readiness?.tap_to_pay_available) {
        setContactlessStatus('failed');
        setContactlessError('Contactless payment is unavailable right now. Please choose another payment method.');
        return;
      }

      const support = await tapToPayBridge.isTapToPaySupported();
      setContactlessDebug('native_support_check');
      const locationPermissionPending = (support.reason || '').toLowerCase().includes('location permission');
      if (!support.supported && !locationPermissionPending) {
        setContactlessStatus('failed');
        setContactlessError('Contactless payment is unavailable right now. Please choose another payment method.');
        return;
      }
      if (!support.supported && locationPermissionPending) {
        setPaymentNotice('This device needs permission to accept contactless payments.');
      } else {
        setPaymentNotice('');
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
        setContactlessError('Payment failed, please try again or choose another payment method.');
        return;
      }

      const sessionId = String(created.session.id);
      setContactlessSessionId(sessionId);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CONTACTLESS_SESSION_STORAGE_KEY, JSON.stringify({ sessionId, restaurantId, savedAt: new Date().toISOString() }));
      }
      setContactlessDebug(`session:${sessionId.slice(0, 8)}`);

      const paymentIntentRes = await fetch('/api/kiosk/payments/card-present/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, restaurant_id: restaurantId }),
      });
      if (!paymentIntentRes.ok) {
        const paymentIntentErr = await paymentIntentRes.json().catch(() => ({}));
        setContactlessStatus('failed');
        setContactlessError(paymentIntentErr?.error || 'Payment failed, please try again or choose another payment method.');
        return;
      }

      const backendBaseUrl = window.location.origin;
      setContactlessStatus('preparing');
      setContactlessDebug('native_prepare');
      const prepared = await tapToPayBridge.prepareTapToPay({ restaurantId, sessionId, backendBaseUrl });
      if (prepared.status === 'failed' || prepared.status === 'unavailable') {
        const permissionDenied = prepared.code === 'permission_required';
        setContactlessStatus('failed');
        setContactlessError(
          permissionDenied
            ? 'Contactless payment permission was not granted. Please choose another payment method.'
            : 'Contactless payment is unavailable right now. Please choose another payment method.'
        );
        setContactlessDebug(`prepare_failed:${prepared.code || 'unknown'}`);
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
      setPaymentNotice('');

      const readinessCheckRes = await fetch(`/api/kiosk/payments/tap-to-pay-availability?restaurant_id=${encodeURIComponent(restaurantId)}`);
      setContactlessDebug('readiness_recheck');
      const readinessCheck = await readinessCheckRes.json().catch(() => ({}));
      if (!readinessCheckRes.ok || !readinessCheck?.tap_to_pay_available) {
        setContactlessStatus('failed');
        setContactlessError('Contactless payment is unavailable right now. Please choose another payment method.');
        await fetch('/api/kiosk/payments/card-present/session-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            restaurant_id: restaurantId,
            next_state: 'failed',
            failure_code: 'readiness_false',
            failure_message: 'Tap to Pay readiness changed before collection started.',
            event_type: 'readiness_changed_before_start',
          }),
        });
        return;
      }

      setContactlessStatus('collecting');
      setContactlessDebug('native_collect_process');
      const started = await tapToPayBridge.startTapToPayPayment({ restaurantId, sessionId, backendBaseUrl });
      if (started.status !== 'succeeded') {
        setContactlessStatus(started.status === 'canceled' ? 'canceled' : 'failed');
        setContactlessError(
          started.status === 'canceled'
            ? 'Payment cancelled'
            : 'Payment failed, please try again or choose another payment method.'
        );
        setContactlessDebug(`start_failed:${started.code || started.status}`);
        await reconcileSession(sessionId, 'native_start_failed');
        return;
      }

      setContactlessStatus('processing');
      setContactlessDebug('backend_finalize');
      const finalizeRes = await fetch('/api/kiosk/payments/card-present/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, restaurant_id: restaurantId }),
      });
      const finalized = await finalizeRes.json();
      if (!finalizeRes.ok || finalized?.session?.state !== 'finalized') {
        setContactlessStatus('processing');
        setContactlessError('');
        setContactlessDebug('finalize_pending');
        return;
      }

      setContactlessStatus('succeeded');
      setContactlessDebug('finalized');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
    } catch (error) {
      setContactlessStatus('failed');
      setContactlessError('Payment failed, please try again or choose another payment method.');
      console.error('[kiosk] tap to pay flow failed', error);
    } finally {
      setContactlessBusy(false);
      flowLockRef.current = false;
    }
  }, [CONTACTLESS_SESSION_STORAGE_KEY, amountCents, contactlessBusy, currency, reconcileSession, restaurantId]);

  const returnToFallback = useCallback(
    (message: string) => {
      setPaymentNotice(message);
      setContactlessBusy(false);
      setContactlessStatus('idle');
      setContactlessError('');
      setContactlessSessionId(null);
      setContactlessDebug('fallback');
      setStage(enabledMethods.length > 1 ? 'method_picker' : 'pay_at_counter');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
    },
    [CONTACTLESS_SESSION_STORAGE_KEY, enabledMethods]
  );

  const stageLabel = useMemo(() => {
    if (stage === 'method_picker') return 'Choose payment method';
    if (stage === 'contactless') return 'Contactless payment';
    if (stage === 'cash') return 'Cash payment';
    return 'Pay at counter';
  }, [stage]);

  useEffect(() => {
    if (stage !== 'contactless' || !restaurantId) return;
    const statusPoll = async () => {
      const nativeStatus = await tapToPayBridge.getTapToPayStatus();
      setContactlessDebug(`native:${nativeStatus.status}`);
      if (nativeStatus.status === 'processing' || nativeStatus.status === 'collecting') {
        setContactlessStatus(nativeStatus.status);
      }
      if (nativeStatus.sessionId && !contactlessSessionId) {
        setContactlessSessionId(nativeStatus.sessionId);
      }
    };
    void statusPoll();
  }, [contactlessSessionId, restaurantId, stage]);

  useEffect(() => {
    if (stage !== 'contactless') return;
    if (contactlessBusy) return;
    if (contactlessStatus !== 'idle') return;
    if (amountCents <= 0) return;
    void runTapToPay();
  }, [amountCents, contactlessBusy, contactlessStatus, runTapToPay, stage]);

  useEffect(() => {
    if (stage !== 'contactless') return;
    if (contactlessBusy) return;
    if (contactlessStatus !== 'failed' && contactlessStatus !== 'canceled') return;
    const timeout = window.setTimeout(() => {
      returnToFallback(
        contactlessStatus === 'canceled'
          ? 'Payment cancelled'
          : contactlessError || 'Contactless payment is unavailable right now. Please choose another payment method.'
      );
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [contactlessBusy, contactlessError, contactlessStatus, returnToFallback, stage]);

  useEffect(() => {
    if (stage !== 'contactless' || !restaurantId) return;
    if (typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(CONTACTLESS_SESSION_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { sessionId?: string; restaurantId?: string };
      if (parsed?.sessionId && parsed?.restaurantId === restaurantId) {
        setContactlessSessionId(parsed.sessionId);
        setContactlessStatus('processing');
        setContactlessError('');
        void loadServerSessionTruth(parsed.sessionId, 'local_restore');
      }
    } catch {
      window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
    }
  }, [CONTACTLESS_SESSION_STORAGE_KEY, loadServerSessionTruth, restaurantId, stage]);

  useEffect(() => {
    if (stage !== 'contactless' || !restaurantId || !contactlessSessionId) return;
    if (typeof document === 'undefined') return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && (contactlessStatus === 'collecting' || contactlessStatus === 'processing' || contactlessBusy)) {
        setContactlessError('');
      }
      if (document.visibilityState === 'visible' && (contactlessStatus === 'collecting' || contactlessStatus === 'processing')) {
        void loadServerSessionTruth(contactlessSessionId, 'foreground_visible');
        void reconcileSession(contactlessSessionId, 'foreground_resume');
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [contactlessBusy, contactlessSessionId, contactlessStatus, loadServerSessionTruth, reconcileSession, restaurantId, stage]);

  const cancelTapToPay = useCallback(async () => {
    if (!contactlessSessionId || !restaurantId || cancelLockRef.current) return;
    cancelLockRef.current = true;
    setContactlessBusy(true);
    setContactlessDebug('canceling');
    try {
      await tapToPayBridge.cancelTapToPayPayment();
      await fetch('/api/kiosk/payments/card-present/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: contactlessSessionId, restaurant_id: restaurantId, reason: 'Canceled on kiosk' }),
      });
      setContactlessStatus('canceled');
      setContactlessError('Payment cancelled');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
    } finally {
      setContactlessBusy(false);
      cancelLockRef.current = false;
      flowLockRef.current = false;
    }
  }, [CONTACTLESS_SESSION_STORAGE_KEY, contactlessSessionId, restaurantId]);

  const renderMethodPicker = () => (
    <section className="w-full rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-200/70 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kiosk checkout</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Choose how you want to pay</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
        Select your payment method to continue checkout.
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
                  setPaymentNotice('');
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

  const renderContactlessOverlay = () => (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contactless payment</p>
        {contactlessStatus === 'preparing' || contactlessStatus === 'idle' ? <p className="mt-3 text-base font-medium text-slate-800">Starting secure payment…</p> : null}
        {contactlessStatus === 'collecting' ? <p className="mt-3 text-base font-medium text-slate-800">Hold card or phone near reader</p> : null}
        {contactlessStatus === 'processing' ? <p className="mt-3 text-base font-medium text-amber-700">Processing payment…</p> : null}
        {contactlessStatus === 'succeeded' ? (
          <p className="mt-3 flex items-center gap-2 text-base font-medium text-emerald-700">
            <CheckCircleIcon className="h-5 w-5" />
            Payment approved
          </p>
        ) : null}
        {contactlessStatus === 'failed' || contactlessStatus === 'canceled' ? (
          <p className="mt-3 flex items-center gap-2 text-base font-medium text-rose-700">
            <ExclamationTriangleIcon className="h-5 w-5" />
            {contactlessError || 'Payment failed, please try again or choose another payment method.'}
          </p>
        ) : null}
        {showOperatorDetails ? <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Debug: {contactlessDebug}</p> : null}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              if (contactlessStatus === 'failed' || contactlessStatus === 'canceled') {
                returnToFallback(
                  contactlessStatus === 'canceled'
                    ? 'Payment cancelled'
                    : 'Payment failed, please try again or choose another payment method.'
                );
                return;
              }
              void cancelTapToPay().then(() => returnToFallback('Payment cancelled'));
            }}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {contactlessStatus === 'failed' || contactlessStatus === 'canceled' ? 'Choose another method' : 'Cancel payment'}
          </button>
          {(contactlessStatus === 'failed' || contactlessStatus === 'canceled') && enabledMethods.includes('contactless') ? (
            <button
              type="button"
              onClick={() => void runTapToPay()}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Retry Tap to Pay
            </button>
          ) : null}
        </div>
      </section>
    </div>
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
          {!settingsLoading && paymentNotice ? (
            <section className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              {paymentNotice}
            </section>
          ) : null}

          {!settingsLoading && (stage === 'method_picker' || stage === 'contactless') ? renderMethodPicker() : null}
          {!settingsLoading && stage === 'cash' ? renderCash() : null}
          {!settingsLoading && stage === 'pay_at_counter' ? renderPayAtCounter() : null}
          {!settingsLoading && stage === 'contactless' ? renderContactlessOverlay() : null}
        </div>
      </div>
    </KioskLayout>
  );
}
