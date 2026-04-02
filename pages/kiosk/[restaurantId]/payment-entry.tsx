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
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabaseClient';
import {
  normalizeKioskPaymentSettings,
  type KioskPaymentMethod,
  type KioskPaymentSettingsRow,
} from '@/lib/kiosk/paymentSettings';
import { tapToPayBridge, type TapToPayStatus } from '@/lib/kiosk/tapToPayBridge';
import type { KioskTerminalMode } from '@/lib/kiosk/terminalMode';
import { setKioskLastRealOrderNumber } from '@/utils/kiosk/orders';
import { requestPrintJobCreation } from '@/lib/print-jobs/request';

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
  auto_accept_kiosk_orders?: boolean | null;
};
type StoredCheckoutItem = {
  item_id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  addons?: Array<{ option_id: string; name: string; price: number; quantity: number }>;
};
type StoredCheckoutContext = {
  restaurantId: string;
  customerName: string;
  isExpressFlow: boolean;
  tableNumber: number | null;
  cartItems: StoredCheckoutItem[];
  subtotal: number;
  currency: string;
};

type PaymentStage = 'method_picker' | 'contactless' | 'cash' | 'pay_at_counter';
type TapStartupStage =
  | 'readiness_check'
  | 'session_create'
  | 'payment_intent'
  | 'simulated_complete'
  | 'native_support_check'
  | 'native_prepare'
  | 'native_start';
type TapStartupResultStage =
  | 'availability_result'
  | 'session_create_result'
  | 'payment_intent_result'
  | 'simulated_complete_result'
  | 'native_support_check_result'
  | 'native_prepare_result'
  | 'native_collect_result'
  | 'native_process_result'
  | 'native_cancel_result';
type StartupTraceStatus = 'idle' | 'pending' | 'ok' | 'failed' | 'skipped';
type StartupTraceKey =
  | 'availability'
  | 'session_create'
  | 'payment_intent'
  | 'simulated_complete'
  | 'native_support'
  | 'native_prepare'
  | 'native_discovery'
  | 'native_connection'
  | 'native_start';
type StartupTraceState = Record<StartupTraceKey, { status: StartupTraceStatus; detail: string }>;
type PaymentVerification = {
  verifiedPaid?: boolean;
  paymentIntentStatus?: string | null;
  reason?: string;
  mode?: KioskTerminalMode;
};

const OPERATOR_DEBUG_STORAGE_KEY = 'orderfast_kiosk_operator_debug';
const KIOSK_CHECKOUT_CONTEXT_STORAGE_KEY = 'orderfast_kiosk_checkout_context';
const OPERATOR_DEBUG_TAP_THRESHOLD = 7;
const OPERATOR_DEBUG_TAP_WINDOW_MS = 8000;
const PAYMENT_PREP_MESSAGES = [
  'Loading up the payment magic...',
  'Deliciousness secured... now time to secure the payment.',
  'Waking up the card goblins...',
  'Getting the tap ready...',
  'One tiny beep away from greatness...',
];
const STARTUP_TRACE_LABELS: Record<StartupTraceKey, string> = {
  availability: 'availability',
  session_create: 'session create',
  payment_intent: 'payment intent',
  simulated_complete: 'simulated complete',
  native_support: 'native support',
  native_prepare: 'native prepare',
  native_discovery: 'native discovery',
  native_connection: 'native connection',
  native_start: 'native start',
};

const createStartupTrace = (): StartupTraceState => ({
  availability: { status: 'idle', detail: '' },
  session_create: { status: 'idle', detail: '' },
  payment_intent: { status: 'idle', detail: '' },
  simulated_complete: { status: 'idle', detail: '' },
  native_support: { status: 'idle', detail: '' },
  native_prepare: { status: 'idle', detail: '' },
  native_discovery: { status: 'idle', detail: '' },
  native_connection: { status: 'idle', detail: '' },
  native_start: { status: 'idle', detail: '' },
});

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
  const TAP_TO_PAY_SETUP_STORAGE_KEY = 'orderfast_kiosk_tap_to_pay_setup_ready';
  const router = useRouter();
  const { cart, clearCart } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [enabledMethods, setEnabledMethods] = useState<KioskPaymentMethod[]>(['pay_at_counter']);
  const [stage, setStage] = useState<PaymentStage>('method_picker');
  const [contactlessStatus, setContactlessStatus] = useState<TapToPayStatus>('idle');
  const [contactlessBusy, setContactlessBusy] = useState(false);
  const [contactlessError, setContactlessError] = useState('');
  const [contactlessSessionId, setContactlessSessionId] = useState<string | null>(null);
  const [contactlessTerminalLocationId, setContactlessTerminalLocationId] = useState<string | null>(null);
  const [contactlessDebug, setContactlessDebug] = useState('idle');
  const [contactlessDebugDetail, setContactlessDebugDetail] = useState('');
  const [operatorDebugEnabled, setOperatorDebugEnabled] = useState(false);
  const [operatorTapCount, setOperatorTapCount] = useState(0);
  const [tapStartupTrace, setTapStartupTrace] = useState<StartupTraceState>(createStartupTrace);
  const [paymentNotice, setPaymentNotice] = useState('');
  const [checkoutContext, setCheckoutContext] = useState<StoredCheckoutContext | null>(null);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSubmitError, setOrderSubmitError] = useState('');
  const [currentOrderMethod, setCurrentOrderMethod] = useState<'cash' | 'pay_at_counter' | 'contactless' | null>(null);
  const [autoSubmitAttemptedMethod, setAutoSubmitAttemptedMethod] = useState<'cash' | 'pay_at_counter' | 'contactless' | null>(null);
  const [prepMessageIndex, setPrepMessageIndex] = useState(0);
  const [terminalMode, setTerminalMode] = useState<KioskTerminalMode>('real_tap_to_pay');
  const isVerifiedPaidPayload = useCallback((verification: PaymentVerification | null | undefined) => {
    if (!verification || verification.verifiedPaid !== true) return false;
    if (verification.mode === 'simulated_terminal') return true;
    return verification.paymentIntentStatus === 'succeeded';
  }, []);
  const flowLockRef = useRef(false);
  const orderSubmitLockRef = useRef(false);
  const cancelLockRef = useRef(false);
  const operatorTapTimeoutRef = useRef<number | null>(null);
  const stageParam = Array.isArray(router.query.stage) ? router.query.stage[0] : router.query.stage;
  const showOperatorDetails = operatorDebugEnabled;
  const preferredStageFromQuery: PaymentStage | null =
    stageParam === 'contactless' || stageParam === 'cash' || stageParam === 'pay_at_counter' || stageParam === 'method_picker'
      ? stageParam
      : null;

  const amountParam = Array.isArray(router.query.amount_cents) ? router.query.amount_cents[0] : router.query.amount_cents;
  const currencyParam = Array.isArray(router.query.currency) ? router.query.currency[0] : router.query.currency;
  const amountCents = Number(amountParam || 0);
  const currency = (currencyParam || 'usd').toLowerCase();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(OPERATOR_DEBUG_STORAGE_KEY);
    setOperatorDebugEnabled(stored === '1');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !restaurantId) return;
    const raw = window.sessionStorage.getItem(KIOSK_CHECKOUT_CONTEXT_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as StoredCheckoutContext;
      if (parsed?.restaurantId === restaurantId) {
        setCheckoutContext(parsed);
      }
    } catch {
      window.sessionStorage.removeItem(KIOSK_CHECKOUT_CONTEXT_STORAGE_KEY);
    }
  }, [restaurantId]);

  useEffect(
    () => () => {
      if (operatorTapTimeoutRef.current) {
        window.clearTimeout(operatorTapTimeoutRef.current);
      }
    },
    []
  );

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
            'id,name,website_title,website_description,logo_url,logo_shape,brand_primary_color,brand_secondary_color,menu_header_image_url,menu_header_image_updated_at,menu_header_focal_x,menu_header_focal_y,auto_accept_kiosk_orders'
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
          .select('restaurant_id,process_on_device,enable_cash,enable_contactless,enable_pay_at_counter,terminal_mode')
          .eq('restaurant_id', restaurantId)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error('[kiosk] failed to load kiosk payment settings', error);
        }

        const normalized = normalizeKioskPaymentSettings((data as KioskPaymentSettingsRow | null) || null);
        setTerminalMode(normalized.terminalMode);
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
      setTapStartupTrace(createStartupTrace());
      setContactlessTerminalLocationId(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
    }
  }, [CONTACTLESS_SESSION_STORAGE_KEY, stage]);

  useEffect(() => {
    if (!orderSubmitting && !contactlessBusy && contactlessStatus !== 'preparing' && contactlessStatus !== 'collecting') {
      setPrepMessageIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setPrepMessageIndex((prev) => (prev + 1) % PAYMENT_PREP_MESSAGES.length);
    }, 1800);
    return () => window.clearInterval(interval);
  }, [contactlessBusy, contactlessStatus, orderSubmitting]);

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
      const verifiedPaid = isVerifiedPaidPayload(reconciled?.verification);
      if (!reconcileRes.ok) {
        setContactlessStatus('failed');
        setContactlessError('Payment failed, please try again or choose another payment method.');
        setContactlessDebug('reconcile_failed');
        return;
      }
      if (nextState === 'finalized' && verifiedPaid) {
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
      if (nextState === 'finalized' && !verifiedPaid) {
        setContactlessStatus('failed');
        setContactlessError('Payment was not completed. Please try again or choose another payment method.');
        setContactlessDebug('reconciled:unverified_finalized');
        setContactlessDebugDetail(
          reconciled?.verification?.reason ||
            `Finalized state rejected because PaymentIntent status is ${reconciled?.verification?.paymentIntentStatus || 'unknown'}.`
        );
        return;
      }
      setContactlessStatus('processing');
      setContactlessError('');
      setContactlessDebug(`reconciled:${nextState || 'unknown'}`);
    },
    [CONTACTLESS_SESSION_STORAGE_KEY, isVerifiedPaidPayload, restaurantId]
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
      const verifiedPaid = isVerifiedPaidPayload(payload?.verification);
      if (!serverState) return;
      if (serverState === 'finalized' && verifiedPaid) {
        setContactlessStatus('succeeded');
        setContactlessError('');
        setContactlessDebug(`server:${serverState}`);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
        }
        return;
      }
      if (serverState === 'finalized' && !verifiedPaid) {
        setContactlessStatus('failed');
        setContactlessError('Payment was not completed. Please try again or choose another payment method.');
        setContactlessDebug('server:unverified_finalized');
        setContactlessDebugDetail(
          payload?.verification?.reason ||
            `Finalized state rejected because PaymentIntent status is ${payload?.verification?.paymentIntentStatus || 'unknown'}.`
        );
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
    [CONTACTLESS_SESSION_STORAGE_KEY, isVerifiedPaidPayload, restaurantId]
  );

  const runTapToPay = useCallback(async () => {
    if (!restaurantId || amountCents <= 0 || contactlessBusy || flowLockRef.current) return;
    flowLockRef.current = true;
    setContactlessBusy(true);
    setContactlessError('');
    setContactlessDebug('starting');
    setContactlessDebugDetail('');
    setTapStartupTrace(createStartupTrace());

    const formatDetail = (detail: unknown) => {
      if (typeof detail === 'string') return detail;
      try {
        return JSON.stringify(detail);
      } catch {
        return String(detail);
      }
    };

    const logTapStageResult = (stage: TapStartupResultStage, result: 'ok' | 'failed', detail: unknown) => {
      const serialized = formatDetail(detail);
      console[result === 'failed' ? 'error' : 'info']('[kiosk][tap_to_pay_startup]', {
        stage,
        result,
        detail,
      });
      setContactlessDebug(`${stage}:${result}`);
      setContactlessDebugDetail(serialized);
      if (stage === 'availability_result') {
        setTapStartupTrace((prev) => ({ ...prev, availability: { status: result, detail: serialized } }));
      } else if (stage === 'session_create_result') {
        setTapStartupTrace((prev) => ({ ...prev, session_create: { status: result, detail: serialized } }));
      } else if (stage === 'payment_intent_result') {
        setTapStartupTrace((prev) => ({ ...prev, payment_intent: { status: result, detail: serialized } }));
      } else if (stage === 'simulated_complete_result') {
        setTapStartupTrace((prev) => ({ ...prev, simulated_complete: { status: result, detail: serialized } }));
      } else if (stage === 'native_support_check_result') {
        setTapStartupTrace((prev) => ({ ...prev, native_support: { status: result, detail: serialized } }));
      } else if (stage === 'native_prepare_result') {
        setTapStartupTrace((prev) => ({ ...prev, native_prepare: { status: result, detail: serialized } }));
      } else if (stage === 'native_collect_result' || stage === 'native_process_result') {
        setTapStartupTrace((prev) => ({ ...prev, native_start: { status: result, detail: serialized } }));
      }
    };

    const failAt = (stage: TapStartupStage, detail: string, customerMessage: string) => {
      setContactlessStatus('failed');
      setContactlessError(customerMessage);
      setContactlessDebug(`${stage}:failed`);
      setContactlessDebugDetail(detail);
    };

    try {
      if (typeof window !== 'undefined') {
        const setupRaw = window.localStorage.getItem(TAP_TO_PAY_SETUP_STORAGE_KEY);
        if (setupRaw) {
          try {
            const setupState = JSON.parse(setupRaw) as { ready?: boolean; reason?: string | null };
            if (setupState.ready === false) {
              setContactlessDebug('native_setup_cached_not_ready');
              setContactlessDebugDetail(setupState.reason || 'Cached setup state says not ready; running live checks.');
            }
          } catch {
            // Ignore malformed setup cache and continue with live checks.
          }
        }
      }

      const readinessRes = await fetch(`/api/kiosk/payments/tap-to-pay-availability?restaurant_id=${encodeURIComponent(restaurantId)}`);
      const readiness = await readinessRes.json();
      logTapStageResult('availability_result', readinessRes.ok && readiness?.tap_to_pay_available ? 'ok' : 'failed', {
        http_status: readinessRes.status,
        payload: readiness,
      });
      if (!readinessRes.ok || !readiness?.tap_to_pay_available) {
        failAt(
          'readiness_check',
          readiness?.error || `HTTP ${readinessRes.status}`,
          'Contactless payment is unavailable right now. Please choose another payment method.'
        );
        return;
      }
      const resolvedTerminalMode: KioskTerminalMode =
        readiness?.terminal_mode === 'simulated_terminal' ? 'simulated_terminal' : 'real_tap_to_pay';
      setTerminalMode(resolvedTerminalMode);

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
      logTapStageResult('session_create_result', createRes.ok && created?.session?.id ? 'ok' : 'failed', {
        http_status: createRes.status,
        payload: created,
      });
      if (!createRes.ok || !created?.session?.id) {
        failAt(
          'session_create',
          created?.error || `HTTP ${createRes.status}`,
          'Payment failed, please try again or choose another payment method.'
        );
        return;
      }

      const sessionId = String(created.session.id);
      const terminalLocationId = typeof created.session.stripe_terminal_location_id === 'string' ? created.session.stripe_terminal_location_id : '';
      if (resolvedTerminalMode === 'real_tap_to_pay' && !terminalLocationId) {
        failAt(
          'session_create',
          'Session did not include stripe_terminal_location_id',
          'Contactless payment is unavailable right now. Please choose another payment method.'
        );
        return;
      }
      setContactlessSessionId(sessionId);
      setContactlessTerminalLocationId(terminalLocationId);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CONTACTLESS_SESSION_STORAGE_KEY, JSON.stringify({ sessionId, restaurantId, savedAt: new Date().toISOString() }));
      }
      setContactlessDebug(`session:${sessionId.slice(0, 8)}`);

      if (resolvedTerminalMode === 'simulated_terminal') {
        setPaymentNotice('Sandbox test terminal mode: success is only shown after Stripe test completion.');
        setTapStartupTrace((prev) => ({
          ...prev,
          native_support: { status: 'skipped', detail: 'Skipped in simulated_terminal mode.' },
          native_prepare: { status: 'skipped', detail: 'Skipped in simulated_terminal mode.' },
          native_discovery: { status: 'skipped', detail: 'Skipped in simulated_terminal mode.' },
          native_connection: { status: 'skipped', detail: 'Skipped in simulated_terminal mode.' },
          native_start: { status: 'skipped', detail: 'Skipped in simulated_terminal mode.' },
        }));
      }

      const paymentIntentRes = await fetch('/api/kiosk/payments/card-present/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, restaurant_id: restaurantId }),
      });
      const paymentIntentPayload = await paymentIntentRes.json().catch(() => ({}));
      logTapStageResult('payment_intent_result', paymentIntentRes.ok ? 'ok' : 'failed', {
        http_status: paymentIntentRes.status,
        payload: paymentIntentPayload,
      });
      if (!paymentIntentRes.ok) {
        failAt(
          'payment_intent',
          paymentIntentPayload?.error || `HTTP ${paymentIntentRes.status}`,
          paymentIntentPayload?.error || 'Payment failed, please try again or choose another payment method.'
        );
        await fetch('/api/kiosk/payments/card-present/session-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            restaurant_id: restaurantId,
            next_state: 'failed',
            failure_code: 'payment_intent_failed',
            failure_message: paymentIntentPayload?.error || 'Failed to create card present payment intent',
            event_type: 'payment_intent_failed',
          }),
        });
        return;
      }

      if (resolvedTerminalMode === 'simulated_terminal') {
        setContactlessStatus('processing');
        setContactlessDebug('simulated_complete');
        const simulatedCompleteRes = await fetch('/api/kiosk/payments/card-present/simulate-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, restaurant_id: restaurantId }),
        });
        const simulatedCompletePayload = await simulatedCompleteRes.json().catch(() => ({}));
        const simulatedVerified = isVerifiedPaidPayload(simulatedCompletePayload?.verification);
        logTapStageResult('simulated_complete_result', simulatedCompleteRes.ok && simulatedVerified ? 'ok' : 'failed', {
          http_status: simulatedCompleteRes.status,
          payload: simulatedCompletePayload,
        });
        if (!simulatedCompleteRes.ok || simulatedCompletePayload?.session?.state !== 'finalized' || !simulatedVerified) {
          failAt(
            'simulated_complete',
            simulatedCompletePayload?.error || simulatedCompletePayload?.verification?.reason || `HTTP ${simulatedCompleteRes.status}`,
            'Test contactless payment failed. Please try again or choose another payment method.'
          );
          await fetch('/api/kiosk/payments/card-present/session-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              restaurant_id: restaurantId,
              next_state: 'failed',
              failure_code: 'simulated_completion_failed',
              failure_message:
                simulatedCompletePayload?.error || simulatedCompletePayload?.verification?.reason || 'Simulated completion failed',
              event_type: 'simulated_completion_failed',
            }),
          });
          return;
        }

        setContactlessStatus('succeeded');
        setContactlessError('');
        setContactlessDebug('simulated_finalized');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
        }
        return;
      }

      const support = await tapToPayBridge.isTapToPaySupported();
      logTapStageResult('native_support_check_result', support.supported ? 'ok' : 'failed', support);
      if (!support.supported) {
        failAt(
          'native_support_check',
          support.reason || 'Tap to Pay setup is incomplete on this kiosk device.',
          'Contactless payment is temporarily unavailable. Please choose another payment method.'
        );
        await fetch('/api/kiosk/payments/card-present/session-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            restaurant_id: restaurantId,
            next_state: 'failed',
            failure_code: 'native_support_failed',
            failure_message: support.reason || 'Tap to Pay setup is incomplete on this kiosk device.',
            event_type: 'native_support_failed',
          }),
        });
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            TAP_TO_PAY_SETUP_STORAGE_KEY,
            JSON.stringify({
              ready: false,
              checkedAt: new Date().toISOString(),
              permissionState: support.permissionState || null,
              locationServicesEnabled: support.locationServicesEnabled ?? null,
              reason: support.reason || null,
            })
          );
        }
        setStage(enabledMethods.length > 1 ? 'method_picker' : 'pay_at_counter');
        return;
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          TAP_TO_PAY_SETUP_STORAGE_KEY,
          JSON.stringify({
            ready: true,
            checkedAt: new Date().toISOString(),
            permissionState: support.permissionState || null,
            locationServicesEnabled: support.locationServicesEnabled ?? null,
            reason: support.reason || null,
          })
        );
      }
      setPaymentNotice('');

      const backendBaseUrl = window.location.origin;
      setContactlessStatus('preparing');
      setTapStartupTrace((prev) => ({
        ...prev,
        native_prepare: { status: 'pending', detail: 'Preparing Stripe Terminal native SDK.' },
        native_discovery: { status: 'pending', detail: 'Discovering Tap to Pay reader.' },
        native_connection: { status: 'pending', detail: 'Connecting Tap to Pay reader.' },
      }));
      const prepared = await tapToPayBridge.prepareTapToPay({ restaurantId, sessionId, backendBaseUrl, terminalLocationId });
      logTapStageResult('native_prepare_result', prepared.status === 'ready' || prepared.status === 'preparing' ? 'ok' : 'failed', prepared);
      const preparedDetail = prepared.detail && typeof prepared.detail === 'object' ? (prepared.detail as { stage?: unknown; nativeStage?: unknown }) : null;
      const prepareNativeStage =
        typeof prepared.nativeStage === 'string'
          ? prepared.nativeStage
          : preparedDetail && typeof preparedDetail.nativeStage === 'string'
            ? preparedDetail.nativeStage
            : preparedDetail && typeof preparedDetail.stage === 'string'
              ? preparedDetail.stage
              : '';
      if (prepareNativeStage === 'native_discovery_result') {
        setTapStartupTrace((prev) => ({
          ...prev,
          native_discovery: {
            status: prepared.status === 'failed' || prepared.status === 'unavailable' ? 'failed' : 'ok',
            detail: formatDetail(prepared.detail || prepared.message || 'Native discovery stage reached.'),
          },
        }));
      } else if (prepareNativeStage === 'native_connection_result') {
        setTapStartupTrace((prev) => ({
          ...prev,
          native_discovery: { status: 'ok', detail: 'Reader discovery completed.' },
          native_connection: {
            status: prepared.status === 'failed' || prepared.status === 'unavailable' ? 'failed' : 'ok',
            detail: formatDetail(prepared.detail || prepared.message || 'Native reader connection stage reached.'),
          },
        }));
      } else if (prepared.status === 'ready' || prepared.status === 'preparing') {
        setTapStartupTrace((prev) => ({
          ...prev,
          native_discovery: { status: 'ok', detail: 'Reader discovery completed.' },
          native_connection: { status: 'ok', detail: 'Reader connection completed.' },
        }));
      }
      if (prepared.status === 'failed' || prepared.status === 'unavailable') {
        const permissionDenied = prepared.code === 'permission_required';
        setContactlessStatus('failed');
        setContactlessError(
          permissionDenied
            ? 'Contactless payment permission was not granted. Please choose another payment method.'
            : 'Contactless payment is unavailable right now. Please choose another payment method.'
        );
        setContactlessDebug(`prepare_failed:${prepared.code || 'unknown'}`);
        setContactlessDebugDetail(
          prepared.detail
            ? `${prepared.message || prepared.code || 'Native prepare returned failure.'} | ${formatDetail(prepared.detail)}`
            : prepared.message || prepared.code || 'Native prepare returned failure.'
        );
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
      setTapStartupTrace((prev) => ({ ...prev, native_start: { status: 'pending', detail: 'Starting native collection flow.' } }));
      const started = await tapToPayBridge.startTapToPayPayment({ restaurantId, sessionId, backendBaseUrl, terminalLocationId });
      const isNativeSuccessOrProcessing = started.status === 'succeeded' || started.status === 'processing';
      logTapStageResult(
        isNativeSuccessOrProcessing ? 'native_process_result' : 'native_collect_result',
        isNativeSuccessOrProcessing ? 'ok' : 'failed',
        started
      );
      if (!isNativeSuccessOrProcessing) {
        setContactlessStatus(started.status === 'canceled' ? 'canceled' : 'failed');
        setContactlessError(
          started.status === 'canceled'
            ? 'Payment cancelled'
            : 'Payment failed, please try again or choose another payment method.'
        );
        setContactlessDebug(`start_failed:${started.code || started.status}`);
        setContactlessDebugDetail(
          started.detail
            ? `${started.message || started.code || started.status} | ${formatDetail(started.detail)}`
            : started.message || started.code || started.status
        );
        await reconcileSession(sessionId, 'native_start_failed');
        return;
      }

      if (started.status === 'processing') {
        const nativePollDeadline = Date.now() + 180000;
        let nativeResolvedStatus: TapToPayStatus = 'processing';

        while (Date.now() < nativePollDeadline) {
          await new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), 700);
          });
          const polledStatus = await tapToPayBridge.getTapToPayStatus();
          if (polledStatus.sessionId && polledStatus.sessionId !== sessionId) {
            continue;
          }
          setContactlessDebug(`native_poll:${polledStatus.status}`);
          if (polledStatus.status === 'succeeded' || polledStatus.status === 'failed' || polledStatus.status === 'canceled') {
            nativeResolvedStatus = polledStatus.status;
            logTapStageResult(polledStatus.status === 'succeeded' ? 'native_process_result' : 'native_collect_result', polledStatus.status === 'succeeded' ? 'ok' : 'failed', polledStatus);
            break;
          }
        }

        if (nativeResolvedStatus !== 'succeeded') {
          await reconcileSession(sessionId, nativeResolvedStatus === 'processing' ? 'native_poll_timeout' : `native_poll_${nativeResolvedStatus}`);
          if (nativeResolvedStatus === 'processing') {
            setContactlessStatus('failed');
            setContactlessError('Payment did not complete. Please try again or choose another payment method.');
            setContactlessDebug('native_poll_timeout');
          }
          return;
        }
      }

      setContactlessStatus('processing');
      setContactlessDebug('backend_finalize');
      const finalizeRes = await fetch('/api/kiosk/payments/card-present/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, restaurant_id: restaurantId }),
      });
      const finalized = await finalizeRes.json();
      const verifiedPaid = isVerifiedPaidPayload(finalized?.verification);
      if (!finalizeRes.ok || finalized?.session?.state !== 'finalized' || !verifiedPaid) {
        setContactlessStatus('processing');
        setContactlessError('');
        setContactlessDebug(finalized?.session?.state === 'finalized' && !verifiedPaid ? 'finalize_unverified' : 'finalize_pending');
        if (finalized?.session?.state === 'finalized' && !verifiedPaid) {
          setContactlessStatus('failed');
          setContactlessError('Payment was not completed. Please try again or choose another payment method.');
          setContactlessDebugDetail(
            finalized?.verification?.reason ||
              `Finalized state rejected because PaymentIntent status is ${finalized?.verification?.paymentIntentStatus || 'unknown'}.`
          );
        }
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
      setContactlessDebug('startup_exception');
      setContactlessDebugDetail(error instanceof Error ? error.message : 'Unexpected startup exception');
      console.error('[kiosk] tap to pay flow failed', error);
    } finally {
      setContactlessBusy(false);
      flowLockRef.current = false;
    }
  }, [
    CONTACTLESS_SESSION_STORAGE_KEY,
    TAP_TO_PAY_SETUP_STORAGE_KEY,
    amountCents,
    contactlessBusy,
    currency,
    enabledMethods.length,
    isVerifiedPaidPayload,
    reconcileSession,
    restaurantId,
  ]);

  const toggleOperatorDebug = useCallback(() => {
    const next = !operatorDebugEnabled;
    setOperatorDebugEnabled(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(OPERATOR_DEBUG_STORAGE_KEY, next ? '1' : '0');
    }
    setPaymentNotice(next ? 'Operator diagnostics enabled.' : 'Operator diagnostics hidden.');
    window.setTimeout(() => setPaymentNotice(''), 2200);
  }, [operatorDebugEnabled]);

  const handleHiddenOperatorTap = useCallback(() => {
    const nextCount = operatorTapCount + 1;
    setOperatorTapCount(nextCount);
    if (operatorTapTimeoutRef.current) window.clearTimeout(operatorTapTimeoutRef.current);
    operatorTapTimeoutRef.current = window.setTimeout(() => setOperatorTapCount(0), OPERATOR_DEBUG_TAP_WINDOW_MS);
    if (nextCount >= OPERATOR_DEBUG_TAP_THRESHOLD) {
      setOperatorTapCount(0);
      toggleOperatorDebug();
    }
  }, [operatorTapCount, toggleOperatorDebug]);

  const returnToFallback = useCallback(
    (message: string) => {
      setPaymentNotice(message);
      setContactlessBusy(false);
      setContactlessStatus('idle');
      setContactlessError('');
      setContactlessSessionId(null);
      setContactlessDebug('fallback');
      setAutoSubmitAttemptedMethod(null);
      setStage(enabledMethods.length > 1 ? 'method_picker' : 'pay_at_counter');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
    },
    [CONTACTLESS_SESSION_STORAGE_KEY, enabledMethods]
  );

  const submitOrderAndRedirect = useCallback(
    async (method: 'cash' | 'pay_at_counter' | 'contactless') => {
      if (!restaurantId || orderSubmitLockRef.current) return;
      orderSubmitLockRef.current = true;
      setCurrentOrderMethod(method);
      setOrderSubmitting(true);
      setOrderSubmitError('');

      const cartItems = checkoutContext?.cartItems?.length ? checkoutContext.cartItems : cart.items;
      const customerName = checkoutContext?.customerName?.trim() || 'Guest';
      const isExpressFlow = checkoutContext?.isExpressFlow === true;
      const tableNumber = checkoutContext?.tableNumber ?? null;
      const subtotalAmount = checkoutContext?.subtotal ?? amountCents / 100;
      const initialStatus = restaurant?.auto_accept_kiosk_orders ? 'accepted' : 'pending';
      const acceptedAt = restaurant?.auto_accept_kiosk_orders ? new Date().toISOString() : null;
      const source = isExpressFlow ? 'express' : 'kiosk';
      let orderId: string | null = null;

      try {
        if (!cartItems.length) {
          throw new Error('Cart is empty');
        }
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert([
            {
              restaurant_id: restaurantId,
              customer_name: customerName,
              order_type: 'collection',
              source,
              status: initialStatus,
              accepted_at: acceptedAt,
              total_price: subtotalAmount,
              service_fee: 0,
              delivery_fee: 0,
              dine_in_table_number: isExpressFlow ? tableNumber : null,
              table_session_id: null,
            },
          ])
          .select('id, short_order_number')
          .single();
        if (orderError || !order) throw orderError || new Error('Failed to create order');
        orderId = order.id;

        for (const item of cartItems) {
          const { data: orderItem, error: itemError } = await supabase
            .from('order_items')
            .insert([
              {
                order_id: order.id,
                item_id: item.item_id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                notes: item.notes || null,
              },
            ])
            .select('id')
            .single();
          if (itemError || !orderItem) throw itemError || new Error('Failed to insert order item');
          for (const addon of item.addons || []) {
            const { error: addonError } = await supabase.from('order_addons').insert([
              {
                order_item_id: orderItem.id,
                option_id: addon.option_id,
                name: addon.name,
                price: addon.price,
                quantity: addon.quantity,
              },
            ]);
            if (addonError) throw addonError;
          }
        }

        try {
          await requestPrintJobCreation({
            restaurantId,
            orderId: order.id,
            ticketType: 'kot',
            source: 'auto',
            triggerEvent: 'order_placed',
            dedupeToken: `order_placed:${order.id}`,
          });
        } catch (printError) {
          console.warn('[kiosk] failed to create auto KOT print jobs', printError);
        }

        clearCart();
        setKioskLastRealOrderNumber(restaurantId, order.short_order_number ?? 0);
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(KIOSK_CHECKOUT_CONTEXT_STORAGE_KEY);
        }
        const params = new URLSearchParams({ orderNumber: String(order.short_order_number ?? 0) });
        if (isExpressFlow) params.set('express', '1');
        await router.replace(`/kiosk/${restaurantId}/confirm?${params.toString()}`);
      } catch (error) {
        console.error('[kiosk] failed to submit order from payment entry', error);
        if (orderId) {
          await supabase.from('orders').delete().eq('id', orderId);
        }
        setOrderSubmitError('We could not place your order. Please choose a method and try again.');
        if (method === 'contactless') {
          setStage(enabledMethods.length > 1 ? 'method_picker' : 'contactless');
          setPaymentNotice('Payment was successful, but order submission failed. Please ask staff for help.');
        } else {
          setStage(enabledMethods.length > 1 ? 'method_picker' : method);
        }
      } finally {
        setOrderSubmitting(false);
        orderSubmitLockRef.current = false;
      }
    },
    [amountCents, cart.items, checkoutContext, clearCart, enabledMethods.length, restaurant?.auto_accept_kiosk_orders, restaurantId, router]
  );

  const stageLabel = useMemo(() => {
    if (stage === 'method_picker') return 'Choose payment method';
    if (stage === 'contactless') return 'Contactless payment';
    if (stage === 'cash') return 'Cash payment';
    return 'Pay at counter';
  }, [stage]);

  useEffect(() => {
    if (stage !== 'contactless' || !restaurantId) return;
    if (terminalMode === 'simulated_terminal') return;
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
  }, [contactlessSessionId, restaurantId, stage, terminalMode]);

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
    if (settingsLoading) return;
    if (orderSubmitting) return;
    if (stage === 'cash' && autoSubmitAttemptedMethod !== 'cash') {
      setAutoSubmitAttemptedMethod('cash');
      void submitOrderAndRedirect('cash');
    } else if (stage === 'pay_at_counter' && autoSubmitAttemptedMethod !== 'pay_at_counter') {
      setAutoSubmitAttemptedMethod('pay_at_counter');
      void submitOrderAndRedirect('pay_at_counter');
    }
  }, [autoSubmitAttemptedMethod, orderSubmitting, settingsLoading, stage, submitOrderAndRedirect]);

  useEffect(() => {
    if (contactlessStatus !== 'succeeded' || orderSubmitting || autoSubmitAttemptedMethod === 'contactless') return;
    setAutoSubmitAttemptedMethod('contactless');
    void submitOrderAndRedirect('contactless');
  }, [autoSubmitAttemptedMethod, contactlessStatus, orderSubmitting, submitOrderAndRedirect]);

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
                setOrderSubmitError('');
                setAutoSubmitAttemptedMethod(null);
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
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-500/35 px-4 backdrop-blur-[2px]">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contactless payment</p>
        {contactlessStatus === 'preparing' || contactlessStatus === 'idle' ? (
          <p className="mt-3 text-base font-medium text-slate-800">{PAYMENT_PREP_MESSAGES[prepMessageIndex]}</p>
        ) : null}
        {contactlessStatus === 'collecting' ? <p className="mt-3 text-base font-medium text-slate-800">Reader is ready. Hold your card or phone near the reader.</p> : null}
        {contactlessStatus === 'processing' ? <p className="mt-3 text-base font-medium text-amber-700">Finalizing payment result...</p> : null}
        {contactlessStatus === 'succeeded' ? (
          <p className="mt-3 flex items-center gap-2 text-base font-medium text-emerald-700">
            <CheckCircleIcon className="h-5 w-5" />
            Payment approved. Sending your order now...
          </p>
        ) : null}
        {contactlessStatus === 'failed' || contactlessStatus === 'canceled' ? (
          <p className="mt-3 flex items-center gap-2 text-base font-medium text-rose-700">
            <ExclamationTriangleIcon className="h-5 w-5" />
            {contactlessStatus === 'canceled'
              ? 'Payment was canceled. Please choose a payment method to continue.'
              : contactlessError || 'Payment failed, please try again or choose another payment method.'}
          </p>
        ) : null}
        {contactlessStatus === 'preparing' || contactlessStatus === 'idle' || contactlessStatus === 'collecting' || contactlessStatus === 'processing' ? (
          <div className="mt-5 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
          </div>
        ) : null}
        {showOperatorDetails ? <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Debug: {contactlessDebug}</p> : null}
        {showOperatorDetails && contactlessDebugDetail ? (
          <p className="mt-1 text-xs font-medium text-slate-600">Detail: {contactlessDebugDetail}</p>
        ) : null}
        {showOperatorDetails ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tap to Pay startup diagnostics</p>
            <p className="mt-1 text-xs text-slate-700">
              <span className="font-semibold">mode:</span> {terminalMode}
            </p>
            <div className="mt-2 space-y-1">
              {(Object.keys(STARTUP_TRACE_LABELS) as StartupTraceKey[]).map((key) => (
                <p key={key} className="text-xs text-slate-700">
                  <span className="font-semibold">{STARTUP_TRACE_LABELS[key]}:</span> {tapStartupTrace[key].status}
                  {tapStartupTrace[key].detail ? ` — ${tapStartupTrace[key].detail}` : ''}
                </p>
              ))}
            </div>
          </div>
        ) : null}
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

  const renderOrderSubmittingOverlay = () => (
    <div className="fixed inset-0 z-[74] flex items-center justify-center bg-slate-500/35 px-4 backdrop-blur-[2px]">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white/95 p-6 text-center shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Finishing checkout</p>
        <div className="mx-auto mt-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
        <p className="mt-4 text-base font-medium text-slate-800">
          {currentOrderMethod === 'contactless' ? 'Payment captured. Sending your order to the kitchen...' : 'Sending your order to the kitchen...'}
        </p>
      </section>
    </div>
  );

  return (
    <KioskLayout restaurantId={restaurantId} restaurant={restaurant} restaurantLoading={restaurantLoading}>
      <div className="mx-auto flex min-h-[58vh] w-full max-w-4xl items-center px-4 py-8 sm:px-6">
        <div className="w-full space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleHiddenOperatorTap}
              className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
              aria-label="Payment stage"
            >
              {stageLabel}
            </button>
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
          {!settingsLoading && orderSubmitError ? (
            <section className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
              <p>{orderSubmitError}</p>
              {!orderSubmitting && (stage === 'cash' || stage === 'pay_at_counter' || stage === 'contactless') ? (
                <button
                  type="button"
                  onClick={() => {
                    setAutoSubmitAttemptedMethod(null);
                    if (stage === 'contactless') {
                      void runTapToPay();
                      return;
                    }
                    void submitOrderAndRedirect(stage);
                  }}
                  className="mt-2 rounded-full border border-rose-300 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700"
                >
                  Try again
                </button>
              ) : null}
            </section>
          ) : null}

          {!settingsLoading ? renderMethodPicker() : null}
          {!settingsLoading && stage === 'contactless' ? renderContactlessOverlay() : null}
          {!settingsLoading && orderSubmitting ? renderOrderSubmittingOverlay() : null}
        </div>
      </div>
    </KioskLayout>
  );
}
