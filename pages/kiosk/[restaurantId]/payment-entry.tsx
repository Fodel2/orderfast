import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  BanknotesIcon,
  BuildingStorefrontIcon,
  CreditCardIcon,
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
import {
  resolveContactlessEligibility,
  resolveContactlessPresentation,
  type ContactlessEligibilityResult,
} from '@/lib/payments/contactlessEligibility';
import { resolveNativeTapToPayReadiness } from '@/lib/kiosk/tapToPayNativeReadiness';
import { tapToPayBridge, type TapToPayResult, type TapToPayStatus } from '@/lib/kiosk/tapToPayBridge';
import type { KioskTerminalMode } from '@/lib/kiosk/terminalMode';
import { setKioskLastRealOrderNumber } from '@/utils/kiosk/orders';
import { requestPrintJobCreation } from '@/lib/print-jobs/request';
import NativeTapToPayPreHandoverOverlay from '@/components/payments/NativeTapToPayPreHandoverOverlay';
import {
  canCloseNativeTapToPayPreHandoverOverlay,
  isNativeTapToPayOverlayVisiblePhase,
  normalizeNativeTapToPayState,
  POST_HANDOVER_PROGRESS_LINES,
  PRE_HANDOVER_PROGRESS_LINES,
  resolveNativeTapToPayUiPhase,
} from '@/lib/payments/nativeTapToPayUiPhases';

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
type ContactlessTerminalState = 'idle' | 'in_progress' | 'success' | 'canceled' | 'failed';
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

type PaymentTheme = {
  primary: string;
  secondary: string;
  primarySoft: string;
  secondarySoft: string;
  ring: string;
};

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

const normalizeHexColor = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) return null;
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toUpperCase();
  }
  return trimmed.toUpperCase();
};

const hexToRgba = (hex: string, alpha: number) => {
  const sanitized = normalizeHexColor(hex);
  if (!sanitized) return `rgba(15, 23, 42, ${alpha})`;
  const value = sanitized.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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
  const [sessionStartContactlessEligible, setSessionStartContactlessEligible] = useState(false);
  const [restaurantAllowsContactless, setRestaurantAllowsContactless] = useState(false);
  const [contactlessEligibility, setContactlessEligibility] = useState<ContactlessEligibilityResult | null>(null);
  const [stage, setStage] = useState<PaymentStage>('method_picker');
  const [contactlessStatus, setContactlessStatus] = useState<TapToPayStatus>('idle');
  const [contactlessBusy, setContactlessBusy] = useState(false);
  const [contactlessError, setContactlessError] = useState('');
  const [contactlessUnsupportedDevice, setContactlessUnsupportedDevice] = useState(false);
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
  const [suppressStageAutoSubmit, setSuppressStageAutoSubmit] = useState(false);
  const [prepMessageIndex, setPrepMessageIndex] = useState(0);
  const [successTickVisible, setSuccessTickVisible] = useState(false);
  const [terminalVisualState, setTerminalVisualState] = useState<'success' | 'canceled' | 'failed' | null>(null);
  const [terminalMode, setTerminalMode] = useState<KioskTerminalMode>('real_tap_to_pay');
  const [contactlessTerminalState, setContactlessTerminalState] = useState<ContactlessTerminalState>('idle');
  const [preHandoverOverlayOwned, setPreHandoverOverlayOwned] = useState(false);
  const isVerifiedPaidPayload = useCallback((verification: PaymentVerification | null | undefined) => {
    if (!verification || verification.verifiedPaid !== true) return false;
    if (verification.mode === 'simulated_terminal') return true;
    return verification.paymentIntentStatus === 'succeeded';
  }, []);
  const flowLockRef = useRef(false);
  const orderSubmitLockRef = useRef(false);
  const cancelLockRef = useRef(false);
  const terminalTransitionLockRef = useRef(false);
  const contactlessOwnerRef = useRef<{ id: string; active: boolean; cancelRequested: boolean } | null>(null);
  const deadContactlessSessionRef = useRef<{ sessionId: string | null; outcome: 'canceled' | 'failed' | null }>({
    sessionId: null,
    outcome: null,
  });
  const deadContactlessSessionIdsRef = useRef<Set<string>>(new Set());
  const contactlessTerminalRouteCommittedRef = useRef(false);
  const contactlessOverlayVisibleRef = useRef(false);
  const preHandoverInFlightRef = useRef(false);
  const authoritativeSuccessRef = useRef<{ committed: boolean; source: string | null; at: number | null }>({
    committed: false,
    source: null,
    at: null,
  });
  const stageRef = useRef<PaymentStage>('method_picker');
  const contactlessStatusRef = useRef<TapToPayStatus>('idle');
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

  const logContactlessState = useCallback((event: string, payload?: Record<string, unknown>) => {
    console.info('[kiosk][contactless_state_machine]', event, {
      ownerId: contactlessOwnerRef.current?.id || null,
      ownerActive: contactlessOwnerRef.current?.active === true,
      stage: stageRef.current,
      route: router.asPath,
      ...payload,
    });
  }, [router.asPath]);

  const establishContactlessOwner = useCallback(
    (reason: string) => {
      const ownerId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      contactlessOwnerRef.current = { id: ownerId, active: true, cancelRequested: false };
      preHandoverInFlightRef.current = true;
      setPreHandoverOverlayOwned(true);
      contactlessTerminalRouteCommittedRef.current = false;
      logContactlessState('handover_owner_established', { reason, ownerId });
      return ownerId;
    },
    [logContactlessState]
  );

  const releaseContactlessOwner = useCallback(
    (reason: string) => {
      const ownerId = contactlessOwnerRef.current?.id || null;
      if (ownerId) {
        logContactlessState('handover_owner_released', { reason, ownerId });
      }
      contactlessOwnerRef.current = null;
      preHandoverInFlightRef.current = false;
      setPreHandoverOverlayOwned(false);
      contactlessTerminalRouteCommittedRef.current = false;
    },
    [logContactlessState]
  );

  const isActiveContactlessOwner = useCallback(
    (ownerId: string | null) => {
      if (!ownerId) return false;
      const owner = contactlessOwnerRef.current;
      return owner?.active === true && owner.cancelRequested !== true && owner.id === ownerId && stageRef.current === 'contactless';
    },
    []
  );

  const commitAuthoritativeSuccess = useCallback(
    (source: string, payload?: Record<string, unknown>) => {
      if (!authoritativeSuccessRef.current.committed) {
        authoritativeSuccessRef.current = { committed: true, source, at: Date.now() };
        logContactlessState('first_authoritative_terminal_signal_received', { source, ...payload });
      } else {
        logContactlessState('authoritative_success_signal_received_after_lock', {
          source,
          firstSource: authoritativeSuccessRef.current.source,
          ...payload,
        });
      }
      logContactlessState('terminal_outcome_committed', { outcome: 'success', source, ...payload });
      deadContactlessSessionRef.current = { sessionId: null, outcome: null };
      deadContactlessSessionIdsRef.current.clear();
      setContactlessStatus('succeeded');
      setContactlessTerminalState('success');
      setContactlessError('');
    },
    [logContactlessState]
  );

  const suppressLegacyPostSuccessDowngrade = useCallback(
    (source: string, payload?: Record<string, unknown>) => {
      if (!authoritativeSuccessRef.current.committed) return false;
      logContactlessState('stale_route_or_state_downgrade_suppressed', {
        source,
        firstSuccessSource: authoritativeSuccessRef.current.source,
        ...payload,
      });
      return true;
    },
    [logContactlessState]
  );

  const commitNonSuccessOutcome = useCallback(
    (
      nextStatus: 'canceled' | 'failed',
      source: string,
      payload?: Record<string, unknown>,
      errorMessage?: string
    ) => {
      if (authoritativeSuccessRef.current.committed) {
        logContactlessState(
          nextStatus === 'canceled' ? 'canceled_commit_attempted_after_success' : 'failed_commit_attempted_after_success',
          {
            source,
            firstSuccessSource: authoritativeSuccessRef.current.source,
            ...payload,
          }
        );
        logContactlessState('terminal_outcome_override_suppressed', {
          attemptedOutcome: nextStatus,
          source,
          firstSuccessSource: authoritativeSuccessRef.current.source,
          ...payload,
        });
        return false;
      }
      logContactlessState('terminal_outcome_committed', { outcome: nextStatus, source, ...payload });
      const payloadSessionId = payload && typeof payload.sessionId === 'string' ? payload.sessionId : null;
      deadContactlessSessionRef.current = { sessionId: payloadSessionId, outcome: nextStatus };
      if (payloadSessionId) {
        deadContactlessSessionIdsRef.current.add(payloadSessionId);
      }
      setContactlessStatus(nextStatus);
      setContactlessTerminalState(nextStatus);
      if (typeof errorMessage === 'string') {
        setContactlessError(errorMessage);
      }
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
      return true;
    },
    [CONTACTLESS_SESSION_STORAGE_KEY, logContactlessState]
  );

  const shouldSuppressDeadRunRevival = useCallback(
    (source: string, sessionId: string | null | undefined) => {
      if (authoritativeSuccessRef.current.committed) return false;
      const deadSession = deadContactlessSessionRef.current;
      if (!deadSession.sessionId || !deadSession.outcome || !sessionId || deadSession.sessionId !== sessionId) {
        return false;
      }
      logContactlessState('dead_contactless_session_revival_suppressed', {
        source,
        sessionId,
        deadOutcome: deadSession.outcome,
      });
      return true;
    },
    [logContactlessState]
  );

  const isDeadContactlessSession = useCallback((sessionId: string | null | undefined) => {
    if (!sessionId) return false;
    return deadContactlessSessionIdsRef.current.has(sessionId);
  }, []);

  const shouldBlockNonTerminalWrite = useCallback(
    (source: string, sessionId: string | null | undefined) => {
      if (!sessionId) return false;
      if (!isDeadContactlessSession(sessionId)) return false;
      logContactlessState('dead_contactless_session_non_terminal_write_blocked', { source, sessionId });
      return true;
    },
    [isDeadContactlessSession, logContactlessState]
  );

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
        setRestaurantAllowsContactless(normalized.enableContactless);
        setTerminalMode(normalized.terminalMode);
        const contactlessResolved = await resolveContactlessEligibility({
          checkpoint: 'session_start',
          audience: 'customer',
          entryPoint: 'kiosk',
          restaurantAllowsContactless: normalized.enableContactless,
          entryPointSupportsContactless: true,
        });
        setContactlessEligibility(contactlessResolved);
        const contactlessPresentation = resolveContactlessPresentation(contactlessResolved);
        const contactlessEnabledForCustomerSession = contactlessPresentation.presentation === 'enabled';
        setSessionStartContactlessEligible(contactlessEnabledForCustomerSession);
        const nextMethods = normalized.enabledMethods.filter((method) => (method === 'contactless' ? contactlessEnabledForCustomerSession : true));
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
        setContactlessEligibility(null);
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

  const recheckContactlessEligibility = useCallback(
    async (checkpoint: 'before_render' | 'selection' | 'before_native_start') => {
      const resolved = await resolveContactlessEligibility({
        checkpoint,
        audience: 'customer',
        entryPoint: 'kiosk',
        restaurantAllowsContactless,
        entryPointSupportsContactless: true,
      });
      setContactlessEligibility(resolved);
      console.info('[payments][contactless_eligibility]', 'kiosk_runtime_recheck', {
        checkpoint,
        eligible: resolved.eligible,
        reason: resolved.reason,
      });
      return resolved;
    },
    [restaurantAllowsContactless]
  );

  useEffect(() => {
    if (settingsLoading) return;
    console.info('[payments][contactless_eligibility]', 'rendered_payment_methods', {
      entryPoint: 'kiosk',
      runtime: contactlessEligibility?.runtime || null,
      eligible: contactlessEligibility?.eligible === true,
      reason: contactlessEligibility?.reason || null,
      methods: enabledMethods,
      stage,
    });
  }, [contactlessEligibility, enabledMethods, settingsLoading, stage]);

  useEffect(() => {
    if (settingsLoading) return;
    if (!restaurantAllowsContactless || !sessionStartContactlessEligible) return;
    let active = true;
    const run = async (checkpoint: 'before_render') => {
      const resolved = await recheckContactlessEligibility(checkpoint);
      if (!active) return;
      if (!resolved.eligible) {
        console.info('[payments][contactless_eligibility]', 'nfc_or_device_readiness_change_detected', {
          checkpoint,
          reason: resolved.reason,
          detail: resolved.detail,
          stage: stageRef.current,
        });
        if (stageRef.current === 'contactless' && !contactlessBusy && contactlessStatus === 'idle') {
          console.info('[payments][contactless_eligibility]', 'terminal_outcome_selected', { entryPoint: 'kiosk', outcome: 'ineligible' });
          setPaymentNotice('Contactless is unavailable right now. Please choose another payment method.');
          setContactlessBusy(false);
          setContactlessStatus('idle');
          setContactlessTerminalState('idle');
          setContactlessError('');
          setStage('method_picker');
        }
      }
    };
    void run('before_render');
    const onVisibilityOrFocus = () => {
      void run('before_render');
    };
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    const timer = window.setInterval(() => void run('before_render'), 12000);
    return () => {
      active = false;
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.clearInterval(timer);
    };
  }, [
    contactlessBusy,
    contactlessStatus,
    recheckContactlessEligibility,
    restaurantAllowsContactless,
    sessionStartContactlessEligible,
    settingsLoading,
  ]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    contactlessStatusRef.current = contactlessStatus;
  }, [contactlessStatus]);

  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      if (!restaurantId) return;
      const ownPathPrefix = `/kiosk/${restaurantId}/payment-entry`;
      if (url.startsWith(ownPathPrefix)) return;
      if (contactlessOwnerRef.current?.active) {
        logContactlessState('navigation_away_invalidated_payment_owner', { to: url });
      }
      releaseContactlessOwner('navigation_away');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, [CONTACTLESS_SESSION_STORAGE_KEY, logContactlessState, releaseContactlessOwner, restaurantId, router.events]);

  useEffect(
    () => () => {
      releaseContactlessOwner('component_unmount');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
    },
    [CONTACTLESS_SESSION_STORAGE_KEY, releaseContactlessOwner]
  );

  useEffect(() => {
    if (stage === 'contactless') {
      setContactlessTerminalState('in_progress');
      return;
    }
    authoritativeSuccessRef.current = { committed: false, source: null, at: null };
    if (contactlessOwnerRef.current?.active) {
      logContactlessState('payment_options_revealed_while_handover_active', { reason: 'stage_changed_off_contactless' });
    }
    if (contactlessOwnerRef.current?.active) {
      logContactlessState('navigation_away_invalidated_payment_owner', { reason: 'stage_exit_contactless' });
    }
    releaseContactlessOwner('stage_exit_contactless');
    setContactlessStatus('idle');
    setContactlessSessionId(null);
    setContactlessBusy(false);
    setContactlessError('');
    setContactlessDebug('idle');
    setTapStartupTrace(createStartupTrace());
    setContactlessTerminalLocationId(null);
    setContactlessTerminalState('idle');
    setSuppressStageAutoSubmit(false);
    deadContactlessSessionIdsRef.current.clear();
    preHandoverInFlightRef.current = false;
    setPreHandoverOverlayOwned(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
    }
  }, [CONTACTLESS_SESSION_STORAGE_KEY, logContactlessState, releaseContactlessOwner, stage]);

  useEffect(() => {
    const overlayVisible = isNativeTapToPayOverlayVisiblePhase(contactlessStatus, {
      hasReturnedFromNative: contactlessStatus === 'processing' || contactlessStatus === 'succeeded' || contactlessStatus === 'canceled' || contactlessStatus === 'failed',
    }) || successTickVisible;
    if (!overlayVisible) {
      setPrepMessageIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setPrepMessageIndex((prev) => prev + 1);
    }, 3400);
    return () => window.clearInterval(interval);
  }, [contactlessStatus, successTickVisible]);

  const reconcileSession = useCallback(
    async (sessionId: string, reason: string) => {
      if (!restaurantId) return;
      if (shouldSuppressDeadRunRevival('reconcile_session_entry', sessionId)) return;
      if (shouldBlockNonTerminalWrite('reconcile_session_entry', sessionId)) return;
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
        setContactlessTerminalState('failed');
        logContactlessState('kiosk_failure_received', { sessionId, reason: 'reconcile_failed' });
        setContactlessError('Payment failed, please try again or choose another payment method.');
        setContactlessDebug('reconcile_failed');
        return;
      }
      if (nextState === 'finalized' && verifiedPaid) {
        commitAuthoritativeSuccess('server_reconcile_verified_paid', { sessionId });
        logContactlessState('kiosk_success_received', { sessionId, reason: 'reconcile' });
        setContactlessDebug(`reconciled:${nextState}`);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
        }
        return;
      }
      if (nextState === 'canceled') {
        if (!commitNonSuccessOutcome('canceled', 'server_reconcile_canceled', { sessionId }, 'Payment cancelled')) return;
        logContactlessState('kiosk_cancel_received', { sessionId, reason: 'reconcile' });
        setContactlessDebug('reconciled:canceled');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
        }
        return;
      }
      if (nextState === 'finalized' && !verifiedPaid) {
        if (!commitNonSuccessOutcome('failed', 'server_reconcile_unverified_finalized', { sessionId })) return;
        logContactlessState('kiosk_failure_received', { sessionId, reason: 'reconcile_unverified_finalized' });
        setContactlessError('Payment was not completed. Please try again or choose another payment method.');
        setContactlessDebug('reconciled:unverified_finalized');
        setContactlessDebugDetail(
          reconciled?.verification?.reason ||
            `Finalized state rejected because PaymentIntent status is ${reconciled?.verification?.paymentIntentStatus || 'unknown'}.`
        );
        return;
      }
      if (suppressLegacyPostSuccessDowngrade('reconcile_non_terminal_state', { sessionId, reason, nextState: nextState || null })) {
        return;
      }
      if (shouldSuppressDeadRunRevival('reconcile_non_terminal_state', sessionId)) return;
      setContactlessStatus('processing');
      setContactlessError('');
      setContactlessDebug(`reconciled:${nextState || 'unknown'}`);
    },
    [
      CONTACTLESS_SESSION_STORAGE_KEY,
      commitAuthoritativeSuccess,
      commitNonSuccessOutcome,
      isVerifiedPaidPayload,
      logContactlessState,
      restaurantId,
      suppressLegacyPostSuccessDowngrade,
      shouldSuppressDeadRunRevival,
      shouldBlockNonTerminalWrite,
    ]
  );

  const loadServerSessionTruth = useCallback(
    async (sessionId: string, reason: string) => {
      if (!restaurantId) return;
      if (shouldSuppressDeadRunRevival('server_session_truth_entry', sessionId)) return;
      if (shouldBlockNonTerminalWrite('server_session_truth_entry', sessionId)) return;
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
        commitAuthoritativeSuccess('server_session_truth_verified_paid', { sessionId, reason });
        logContactlessState('kiosk_success_received', { sessionId, reason: 'session_truth' });
        setContactlessDebug(`server:${serverState}`);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
        }
        return;
      }
      if (serverState === 'finalized' && !verifiedPaid) {
        if (!commitNonSuccessOutcome('failed', 'server_session_truth_unverified_finalized', { sessionId, reason })) return;
        logContactlessState('kiosk_failure_received', { sessionId, reason: 'session_truth_unverified_finalized' });
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
        if (
          !commitNonSuccessOutcome(
            serverState === 'canceled' ? 'canceled' : 'failed',
            'server_session_truth_terminal_state',
            { sessionId, reason, serverState },
            serverState === 'canceled' ? 'Payment cancelled' : 'Payment failed, please try again or choose another payment method.'
          )
        ) {
          return;
        }
        logContactlessState(serverState === 'canceled' ? 'kiosk_cancel_received' : 'kiosk_failure_received', {
          sessionId,
          reason: 'session_truth_terminal_state',
          serverState,
        });
        setContactlessDebug(`server:${serverState}`);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
        }
        return;
      }
      if (serverState === 'processing' || serverState === 'needs_reconciliation' || serverState === 'collecting') {
        if (suppressLegacyPostSuccessDowngrade('server_session_truth_non_terminal_state', { sessionId, reason, serverState })) {
          return;
        }
        if (shouldSuppressDeadRunRevival('server_session_truth_non_terminal_state', sessionId)) return;
        setContactlessStatus('processing');
        setContactlessError('');
        setContactlessDebug(`server:${serverState}`);
      }
    },
    [
      CONTACTLESS_SESSION_STORAGE_KEY,
      commitAuthoritativeSuccess,
      commitNonSuccessOutcome,
      isVerifiedPaidPayload,
      logContactlessState,
      restaurantId,
      suppressLegacyPostSuccessDowngrade,
      shouldSuppressDeadRunRevival,
      shouldBlockNonTerminalWrite,
    ]
  );

  const runTapToPay = useCallback(async () => {
    if (!restaurantId || amountCents <= 0 || contactlessBusy || flowLockRef.current) return;
    if (!sessionStartContactlessEligible) {
      logContactlessState('contactless_start_blocked_by_session_gate', { checkpoint: 'before_native_start' });
      setPaymentNotice('Contactless is unavailable right now. Please choose another payment method.');
      return;
    }
    flowLockRef.current = true;
    deadContactlessSessionRef.current = { sessionId: null, outcome: null };
    deadContactlessSessionIdsRef.current.clear();
    const ownerId = establishContactlessOwner('contactless_started');
    setContactlessBusy(true);
    setContactlessError('');
    setContactlessUnsupportedDevice(false);
    setContactlessDebug('starting');
    setContactlessDebugDetail('');
    setTapStartupTrace(createStartupTrace());
    const isStaleOwner = (label: string) => {
      if (isActiveContactlessOwner(ownerId)) return false;
      if (contactlessOwnerRef.current?.id === ownerId && contactlessOwnerRef.current?.cancelRequested) {
        logContactlessState('late_handover_callback_ignored_after_cancel', { label, ownerId });
      } else {
        logContactlessState('kiosk_stale_callback_ignored', { label, ownerId });
      }
      return true;
    };

    const formatDetail = (detail: unknown) => {
      if (typeof detail === 'string') return detail;
      try {
        return JSON.stringify(detail);
      } catch {
        return String(detail);
      }
    };

    const updateReaderHintFromDetail = (_detail: unknown) => {
      return;
    };

    const logNativeOutcome = (label: string, payload: unknown) => {
      console.info('[kiosk][tap_to_pay_native_outcome]', {
        label,
        sessionId: contactlessSessionId,
        restaurantId,
        payload,
      });
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
      setContactlessTerminalState('failed');
      setContactlessError(customerMessage);
      setContactlessUnsupportedDevice(false);
      setContactlessDebug(`${stage}:failed`);
      setContactlessDebugDetail(detail);
    };

    const isUnsupportedDeviceResult = (result: TapToPayResult) => {
      if (result.code === 'unsupported_device') return true;
      if (!result.detail || typeof result.detail !== 'object') return false;
      return (result.detail as { terminalCode?: unknown }).terminalCode === 'TAP_TO_PAY_UNSUPPORTED_DEVICE';
    };

    try {
      const selectionEligibility = await recheckContactlessEligibility('before_native_start');
      if (!selectionEligibility.eligible) {
        logContactlessState('contactless_start_blocked_by_eligibility_guard', {
          checkpoint: 'before_native_start',
          reason: selectionEligibility.reason,
          detail: selectionEligibility.detail,
        });
        failAt(
          'readiness_check',
          selectionEligibility.detail,
          'Contactless payment is unavailable right now. Please choose another payment method.'
        );
        return;
      }

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
      if (isStaleOwner('availability_result')) return;
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
      if (isStaleOwner('session_create_result')) return;
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
      if (!shouldBlockNonTerminalWrite('session_storage_write_on_create', sessionId) && typeof window !== 'undefined') {
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
      if (isStaleOwner('payment_intent_result')) return;
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
        if (isStaleOwner('simulated_complete_result')) return;
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

        commitAuthoritativeSuccess('simulated_complete_verified_paid', { sessionId });
        setContactlessError('');
        setContactlessDebug('simulated_finalized');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
        }
        return;
      }

      const support = await resolveNativeTapToPayReadiness({ promptIfNeeded: false });
      if (isStaleOwner('native_support_check_result')) return;
      logTapStageResult('native_support_check_result', support.supported && support.ready ? 'ok' : 'failed', support);
      if (!support.supported || !support.ready) {
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
      if (isStaleOwner('native_prepare_result')) return;
      updateReaderHintFromDetail(prepared.detail);
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
        const unsupportedDevice = isUnsupportedDeviceResult(prepared);
        setContactlessStatus('failed');
        setContactlessTerminalState('failed');
        setContactlessUnsupportedDevice(unsupportedDevice);
        setContactlessError(
          unsupportedDevice
            ? 'This device cannot use Tap to Pay. Please choose another payment method.'
            : permissionDenied
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
            failure_code: unsupportedDevice ? 'unsupported_device' : prepared.code || 'native_prepare_failed',
            failure_message: prepared.message || 'Tap to Pay preparation failed',
            event_type: 'native_prepare_failed',
          }),
        });
        if (unsupportedDevice && typeof window !== 'undefined') {
          window.localStorage.setItem(
            TAP_TO_PAY_SETUP_STORAGE_KEY,
            JSON.stringify({
              ready: false,
              checkedAt: new Date().toISOString(),
              unsupportedDevice: true,
              unsupportedDevicePermanent: true,
              reason: prepared.message || 'Stripe Tap to Pay rejected this device for hardware/security requirements.',
            })
          );
        }
        return;
      }
      setPaymentNotice('');

      const readinessCheckRes = await fetch(`/api/kiosk/payments/tap-to-pay-availability?restaurant_id=${encodeURIComponent(restaurantId)}`);
      setContactlessDebug('readiness_recheck');
      const readinessCheck = await readinessCheckRes.json().catch(() => ({}));
      if (isStaleOwner('readiness_recheck')) return;
      if (!readinessCheckRes.ok || !readinessCheck?.tap_to_pay_available) {
        setContactlessStatus('failed');
        setContactlessTerminalState('failed');
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
      console.info('[kiosk][tap_to_pay_collect_start]', { sessionId, restaurantId, terminalLocationId });
      logContactlessState('stripe_handoff_started', {
        sessionId,
        ownerId,
        overlayOwner: 'app_pre_stripe',
      });
      setTapStartupTrace((prev) => ({ ...prev, native_start: { status: 'pending', detail: 'Starting native collection flow.' } }));
      if (!isActiveContactlessOwner(ownerId)) {
        logContactlessState('stripe_handover_attempt_blocked_due_to_cancel', { sessionId, ownerId, reason: 'owner_invalid_before_start' });
        return;
      }
      preHandoverInFlightRef.current = true;
      setPreHandoverOverlayOwned(true);
      const started = await tapToPayBridge.startTapToPayPayment({ restaurantId, sessionId, backendBaseUrl, terminalLocationId });
      preHandoverInFlightRef.current = false;
      setPreHandoverOverlayOwned(false);
      if (isStaleOwner('native_start_result')) return;
      logContactlessState('stripe_handoff_committed', {
        sessionId,
        ownerId,
        startedStatus: started.status,
        startedCode: started.code || null,
      });
      console.info('[kiosk][tap_to_pay_native_collect_raw_result]', { sessionId, restaurantId, result: started });
      updateReaderHintFromDetail(started.detail);
      const normalizedStartedStatus = normalizeNativeTapToPayState(started.status, { hasReturnedFromNative: true });
      const isNativeSuccessOrProcessing = normalizedStartedStatus === 'succeeded' || normalizedStartedStatus === 'processing';
      logTapStageResult(
        isNativeSuccessOrProcessing ? 'native_process_result' : 'native_collect_result',
        isNativeSuccessOrProcessing ? 'ok' : 'failed',
        started
      );
      if (!isNativeSuccessOrProcessing) {
        const unsupportedDevice = isUnsupportedDeviceResult(started);
        const nativeDetail = started.detail && typeof started.detail === 'object' ? (started.detail as Record<string, unknown>) : null;
        const reasonCategory = typeof nativeDetail?.reasonCategory === 'string' ? nativeDetail.reasonCategory : null;
        const interruptionReasonCode = typeof nativeDetail?.interruptionReasonCode === 'string' ? nativeDetail.interruptionReasonCode : null;
        const terminalCode = typeof nativeDetail?.terminalCode === 'string' ? nativeDetail.terminalCode : null;
        const definitiveCustomerCancelSignal =
          (typeof nativeDetail?.definitiveCustomerCancelSignal === 'boolean' && nativeDetail.definitiveCustomerCancelSignal) ||
          (typeof (started as { definitiveCustomerCancelSignal?: unknown }).definitiveCustomerCancelSignal === 'boolean' &&
            (started as { definitiveCustomerCancelSignal?: boolean }).definitiveCustomerCancelSignal === true);
        const explicitAppCancelRequested = contactlessOwnerRef.current?.id === ownerId && contactlessOwnerRef.current?.cancelRequested === true;
        const nativeReturnedCanceled = normalizedStartedStatus === 'canceled';
        const lifecycleInterrupted =
          !nativeReturnedCanceled &&
          (interruptionReasonCode === 'background_loss_confirmed' ||
            reasonCategory === 'lifecycle_interrupted' ||
            reasonCategory === 'lifecycle_cancelled');
        const customerOrReaderCancel =
          nativeReturnedCanceled ||
          definitiveCustomerCancelSignal ||
          explicitAppCancelRequested ||
          reasonCategory === 'user_canceled' ||
          reasonCategory === 'lifecycle_cancelled' ||
          interruptionReasonCode === 'canceled';
        const ambiguousCanceledDuringHandoff = false;

        logNativeOutcome('start_non_success', {
          started,
          reasonCategory,
          interruptionReasonCode,
          terminalCode,
          definitiveCustomerCancelSignal,
          explicitAppCancelRequested,
          lifecycleInterrupted,
          customerOrReaderCancel,
          ambiguousCanceledDuringHandoff,
        });

        setContactlessUnsupportedDevice(unsupportedDevice);
        if (lifecycleInterrupted) {
          logContactlessState('interruption_classification_received', {
            sessionId,
            source: 'native_lifecycle_inference',
            reasonCategory,
            interruptionReasonCode,
            definitiveCustomerCancelSignal,
            explicitAppCancelRequested,
          });
          if (
            commitNonSuccessOutcome('canceled', 'native_lifecycle_interrupted_assumed_cancel', {
              sessionId,
              reasonCategory,
              interruptionReasonCode,
            }, 'Payment cancelled')
          ) {
            setContactlessDebug('native_lifecycle_interrupted_canceled');
            setContactlessDebugDetail(`Lifecycle interruption treated as canceled. raw=${formatDetail(started)}`);
            await fetch('/api/kiosk/payments/card-present/cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_id: sessionId, restaurant_id: restaurantId, reason: 'Lifecycle interruption during kiosk contactless' }),
            }).catch(() => undefined);
          }
          return;
        }

        logContactlessState('terminal_outcome_committed', {
          sessionId,
          outcome: customerOrReaderCancel ? 'canceled' : 'failed',
          source: customerOrReaderCancel ? 'authoritative_cancel_signal' : 'native_non_success',
          definitiveCustomerCancelSignal,
          explicitAppCancelRequested,
          reasonCategory,
          interruptionReasonCode,
        });
        if (
          !commitNonSuccessOutcome(
            customerOrReaderCancel ? 'canceled' : 'failed',
            customerOrReaderCancel ? 'authoritative_cancel_signal' : 'native_non_success',
            {
              sessionId,
              definitiveCustomerCancelSignal,
              explicitAppCancelRequested,
              reasonCategory,
              interruptionReasonCode,
            }
          )
        ) {
          return;
        }
        logContactlessState(customerOrReaderCancel ? 'kiosk_cancel_received' : 'kiosk_failure_received', {
          sessionId,
          code: started.code || null,
          status: started.status,
        });
        setContactlessError(
          customerOrReaderCancel
            ? 'Payment cancelled'
            : unsupportedDevice
              ? 'This device cannot use Tap to Pay. Please choose another payment method.'
              : 'Payment failed, please try again or choose another payment method.'
        );
        setContactlessDebug(`start_failed:${started.code || normalizedStartedStatus || started.status}`);
        setContactlessDebugDetail(
          started.detail
            ? `${started.message || started.code || started.status} | ${formatDetail(started.detail)}`
            : started.message || started.code || started.status
        );
        if (unsupportedDevice && typeof window !== 'undefined') {
          window.localStorage.setItem(
            TAP_TO_PAY_SETUP_STORAGE_KEY,
            JSON.stringify({
              ready: false,
              checkedAt: new Date().toISOString(),
              unsupportedDevice: true,
              unsupportedDevicePermanent: true,
              reason: started.message || 'Stripe Tap to Pay rejected this device for hardware/security requirements.',
            })
          );
        }
        if (!customerOrReaderCancel) {
          await reconcileSession(sessionId, 'native_start_failed');
        }
        return;
      }

      if (normalizeNativeTapToPayState(started.status, { hasReturnedFromNative: true }) === 'processing') {
        console.info('[kiosk][tap_to_pay_process_start]', { sessionId, restaurantId, started });
        const nativePollDeadline = Date.now() + 180000;
        let nativeResolvedStatus: TapToPayStatus = 'processing';

        while (Date.now() < nativePollDeadline) {
          await new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), 700);
          });
          const polledStatus = await tapToPayBridge.getTapToPayStatus();
          if (isStaleOwner('native_poll_result')) return;
          console.info('[kiosk][tap_to_pay_native_process_raw_result]', { sessionId, restaurantId, polledStatus });
          updateReaderHintFromDetail(polledStatus.detail);
          if (polledStatus.sessionId && polledStatus.sessionId !== sessionId) {
            continue;
          }
          setContactlessDebug(`native_poll:${polledStatus.status}`);
          const normalizedPolledStatus = normalizeNativeTapToPayState(polledStatus.status, { hasReturnedFromNative: true }) as TapToPayStatus;
          if (normalizedPolledStatus === 'succeeded' || normalizedPolledStatus === 'failed' || normalizedPolledStatus === 'canceled') {
            nativeResolvedStatus = normalizedPolledStatus;
            logTapStageResult(
              normalizedPolledStatus === 'succeeded' ? 'native_process_result' : 'native_collect_result',
              normalizedPolledStatus === 'succeeded' ? 'ok' : 'failed',
              { ...polledStatus, status: normalizedPolledStatus }
            );
            break;
          }
        }

        if (nativeResolvedStatus !== 'succeeded') {
          await reconcileSession(sessionId, nativeResolvedStatus === 'processing' ? 'native_poll_timeout' : `native_poll_${nativeResolvedStatus}`);
          if (nativeResolvedStatus === 'processing') {
            if (shouldSuppressDeadRunRevival('native_poll_timeout_processing_fallback', sessionId)) return;
            setContactlessStatus('failed');
            setContactlessTerminalState('failed');
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
      if (isStaleOwner('finalize_result')) return;
      const verifiedPaid = isVerifiedPaidPayload(finalized?.verification);
      if (!finalizeRes.ok || finalized?.session?.state !== 'finalized' || !verifiedPaid) {
        if (shouldSuppressDeadRunRevival('finalize_pending_non_terminal_state', sessionId)) return;
        setContactlessStatus('processing');
        setContactlessError('');
        setContactlessDebug(finalized?.session?.state === 'finalized' && !verifiedPaid ? 'finalize_unverified' : 'finalize_pending');
        if (finalized?.session?.state === 'finalized' && !verifiedPaid) {
          setContactlessStatus('failed');
          setContactlessTerminalState('failed');
          logContactlessState('kiosk_failure_received', { sessionId, reason: 'finalized_but_unverified' });
          setContactlessError('Payment was not completed. Please try again or choose another payment method.');
          setContactlessDebugDetail(
            finalized?.verification?.reason ||
              `Finalized state rejected because PaymentIntent status is ${finalized?.verification?.paymentIntentStatus || 'unknown'}.`
          );
          await reconcileSession(sessionId, 'finalize_unverified');
          return;
        }
        await loadServerSessionTruth(sessionId, 'finalize_pending');
        await reconcileSession(sessionId, 'finalize_pending');
        return;
      }

      commitAuthoritativeSuccess('server_finalize_verified_paid', { sessionId });
      logContactlessState('kiosk_success_received', { sessionId });
      setContactlessDebug('finalized');
      logContactlessState('success_cleanup_completed', { ownerId, sessionId });
      releaseContactlessOwner('success');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
    } catch (error) {
      preHandoverInFlightRef.current = false;
      setPreHandoverOverlayOwned(false);
      if (!isActiveContactlessOwner(ownerId)) {
        logContactlessState('kiosk_stale_callback_ignored', { ownerId, error: error instanceof Error ? error.message : String(error) });
        return;
      }
      commitNonSuccessOutcome('failed', 'tap_to_pay_flow_exception', { ownerId, message: error instanceof Error ? error.message : String(error) });
      logContactlessState('kiosk_failure_received', { ownerId, reason: 'tap_to_pay_flow_exception' });
      setContactlessError('Payment failed, please try again or choose another payment method.');
      setContactlessUnsupportedDevice(false);
      setContactlessDebug('startup_exception');
      setContactlessDebugDetail(error instanceof Error ? error.message : 'Unexpected startup exception');
      console.error('[kiosk] tap to pay flow failed', error);
      logContactlessState('failure_cleanup_completed', { ownerId });
      releaseContactlessOwner('failed');
    } finally {
      preHandoverInFlightRef.current = false;
      setPreHandoverOverlayOwned(false);
      setContactlessBusy(false);
      flowLockRef.current = false;
    }
  }, [
    CONTACTLESS_SESSION_STORAGE_KEY,
    TAP_TO_PAY_SETUP_STORAGE_KEY,
    amountCents,
    establishContactlessOwner,
    contactlessBusy,
    currency,
    enabledMethods.length,
    isActiveContactlessOwner,
    isVerifiedPaidPayload,
    loadServerSessionTruth,
    logContactlessState,
    recheckContactlessEligibility,
    reconcileSession,
    releaseContactlessOwner,
    restaurantId,
    sessionStartContactlessEligible,
    shouldSuppressDeadRunRevival,
    shouldBlockNonTerminalWrite,
    commitAuthoritativeSuccess,
    commitNonSuccessOutcome,
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
    (message: string, outcome: 'failed' | 'canceled' | 'ineligible' = 'failed') => {
      if (authoritativeSuccessRef.current.committed) {
        logContactlessState('terminal_route_commit_suppressed_after_success', {
          attemptedOutcome: outcome,
          firstSuccessSource: authoritativeSuccessRef.current.source,
        });
        return;
      }
      console.info('[payments][contactless_eligibility]', 'terminal_outcome_selected', { entryPoint: 'kiosk', outcome });
      logContactlessState('kiosk_terminal_route_selected', { terminalType: 'cancel_or_failure', destination: 'method_picker' });
      setPaymentNotice(message);
      setContactlessBusy(false);
      setContactlessStatus('idle');
      setContactlessTerminalState('idle');
      setContactlessError('');
      setContactlessUnsupportedDevice(false);
      setContactlessSessionId(null);
      setContactlessDebug('fallback');
      setContactlessDebugDetail('');
      setAutoSubmitAttemptedMethod(null);
      setSuppressStageAutoSubmit(true);
      deadContactlessSessionRef.current = { sessionId: null, outcome: null };
      deadContactlessSessionIdsRef.current.clear();
      flowLockRef.current = false;
      cancelLockRef.current = false;
      releaseContactlessOwner('return_to_method_picker');
      contactlessTerminalRouteCommittedRef.current = true;
      logContactlessState('kiosk_terminal_route_committed', { terminalType: 'cancel_or_failure', destination: 'method_picker' });
      console.info('[payments][contactless_eligibility]', 'terminal_route_committed', {
        entryPoint: 'kiosk',
        outcome,
        destination: 'method_picker',
      });
      console.info('[payments][contactless_eligibility]', 'failure_or_ineligible_returned_to_payment_options', {
        entryPoint: 'kiosk',
        outcome,
      });
      setStage('method_picker');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
    },
    [CONTACTLESS_SESSION_STORAGE_KEY, logContactlessState, releaseContactlessOwner]
  );

  const submitOrderAndRedirect = useCallback(
    async (method: 'cash' | 'pay_at_counter' | 'contactless') => {
      if (!restaurantId || orderSubmitLockRef.current) return;
      if (method === 'contactless' && contactlessTerminalState !== 'success') {
        logContactlessState('kiosk_order_submit_blocked_non_success_terminal_state', {
          method,
          terminalState: contactlessTerminalState,
          contactlessStatus,
        });
        return;
      }
      if (method === 'contactless') {
        logContactlessState('kiosk_order_submit_allowed_success_terminal_state', {
          method,
          terminalState: contactlessTerminalState,
          contactlessStatus,
        });
      }
      orderSubmitLockRef.current = true;
      setCurrentOrderMethod(method);
      if (method !== 'contactless') {
        setOrderSubmitting(true);
      } else {
        logContactlessState('kiosk_old_loading_confirm_payment_modal_blocked', {
          method,
          reason: 'contactless_success_final_route_owns_ui',
        });
      }
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
        if (method === 'contactless') {
          logContactlessState('success_cleanup_completed', { method, orderId: order.id });
          releaseContactlessOwner('order_confirmed');
        }
        await router.replace(`/kiosk/${restaurantId}/confirm?${params.toString()}`);
        if (method === 'contactless') {
          logContactlessState('final_visible_outcome_source_and_route', {
            source: authoritativeSuccessRef.current.source || 'contactless_success',
            destination: `/kiosk/${restaurantId}/confirm`,
            owner: 'contactless_success_terminal_route',
          });
        }
      } catch (error) {
        console.error('[kiosk] failed to submit order from payment entry', error);
        if (orderId) {
          await supabase.from('orders').delete().eq('id', orderId);
        }
        setOrderSubmitError('We could not place your order. Please choose a method and try again.');
        if (method === 'contactless') {
          logContactlessState('failure_cleanup_completed', { method, reason: 'order_submit_failed_after_payment_capture' });
          releaseContactlessOwner('order_submit_failed_after_payment_capture');
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
    [
      amountCents,
      cart.items,
      checkoutContext,
      clearCart,
      contactlessStatus,
      contactlessTerminalState,
      enabledMethods.length,
      logContactlessState,
      releaseContactlessOwner,
      restaurant?.auto_accept_kiosk_orders,
      restaurantId,
      router,
    ]
  );

  const stageLabel = useMemo(() => {
    if (stage === 'method_picker') return 'Choose payment method';
    if (stage === 'contactless') return 'Contactless payment';
    if (stage === 'cash') return 'Cash payment';
    return 'Pay at counter';
  }, [stage]);

  const paymentTheme = useMemo<PaymentTheme>(() => {
    const primary = normalizeHexColor(restaurant?.brand_primary_color) || '#0F172A';
    const secondary = normalizeHexColor(restaurant?.brand_secondary_color) || '#334155';
    return {
      primary,
      secondary,
      primarySoft: hexToRgba(primary, 0.12),
      secondarySoft: hexToRgba(secondary, 0.14),
      ring: hexToRgba(primary, 0.28),
    };
  }, [restaurant?.brand_primary_color, restaurant?.brand_secondary_color]);
  const hasReturnedFromNative = useMemo(
    () =>
      contactlessStatus === 'processing' ||
      contactlessStatus === 'succeeded' ||
      contactlessStatus === 'canceled' ||
      contactlessStatus === 'failed' ||
      terminalVisualState === 'success' ||
      terminalVisualState === 'canceled' ||
      terminalVisualState === 'failed' ||
      successTickVisible,
    [contactlessStatus, successTickVisible, terminalVisualState]
  );
  const contactlessUiPhase = useMemo(
    () => resolveNativeTapToPayUiPhase(contactlessStatus, { hasReturnedFromNative }),
    [contactlessStatus, hasReturnedFromNative]
  );
  const showSharedTransitionOverlay = useMemo(
    () =>
      stage === 'contactless' &&
      (isNativeTapToPayOverlayVisiblePhase(contactlessStatus, { hasReturnedFromNative }) ||
        successTickVisible ||
        terminalVisualState === 'canceled' ||
        terminalVisualState === 'failed' ||
        contactlessTerminalState === 'in_progress' ||
        preHandoverOverlayOwned),
    [
      contactlessStatus,
      contactlessTerminalState,
      hasReturnedFromNative,
      preHandoverOverlayOwned,
      stage,
      successTickVisible,
      terminalVisualState,
    ]
  );
  const canCloseSharedTransitionOverlay = useMemo(
    () => {
      if (stage !== 'contactless') return false;
      return canCloseNativeTapToPayPreHandoverOverlay({
        state: contactlessStatus,
        inCancelTransition: cancelLockRef.current,
        inSuccessTransition: successTickVisible || terminalVisualState === 'canceled' || terminalVisualState === 'failed',
        preHandoverOverlayOwned,
        hasReturnedFromNative,
      });
    },
    [contactlessStatus, hasReturnedFromNative, preHandoverOverlayOwned, stage, successTickVisible, terminalVisualState]
  );
  const transitionLines = useMemo(
    () =>
      contactlessUiPhase === 'processing_returned_result' ||
      contactlessUiPhase === 'verifying_paid_outcome' ||
      contactlessUiPhase === 'finalizing_session'
        ? POST_HANDOVER_PROGRESS_LINES
        : PRE_HANDOVER_PROGRESS_LINES,
    [contactlessUiPhase]
  );

  useEffect(() => {
    if (stage !== 'contactless') {
      if (contactlessOverlayVisibleRef.current) {
        contactlessOverlayVisibleRef.current = false;
        logContactlessState('overlay_hidden', { reason: 'stage_not_contactless' });
      }
      return;
    }
    if (showSharedTransitionOverlay && !contactlessOverlayVisibleRef.current) {
      contactlessOverlayVisibleRef.current = true;
      logContactlessState('overlay_shown', { phase: contactlessUiPhase });
      return;
    }
    if (!showSharedTransitionOverlay && contactlessOverlayVisibleRef.current) {
      contactlessOverlayVisibleRef.current = false;
      logContactlessState('overlay_hidden', { phase: contactlessUiPhase });
      if (contactlessOwnerRef.current?.active === true) {
        logContactlessState('overlay_hidden_while_handover_active', { phase: contactlessUiPhase });
      }
    }
  }, [contactlessUiPhase, logContactlessState, showSharedTransitionOverlay, stage]);

  useEffect(() => {
    const shouldLock =
      stage === 'contactless' &&
      terminalMode === 'real_tap_to_pay' &&
      (contactlessBusy ||
        contactlessStatus === 'idle' ||
        contactlessStatus === 'preparing' ||
        contactlessStatus === 'collecting' ||
        contactlessStatus === 'processing');
    if (typeof window === 'undefined') return;

    const orientationApi = window.screen?.orientation as (ScreenOrientation & { lock?: (orientation: string) => Promise<void>; unlock?: () => void }) | undefined;
    if (shouldLock) {
      orientationApi?.lock?.('portrait').catch(() => undefined);
      void tapToPayBridge.lockPaymentOrientationToPortrait();
      return;
    }

    orientationApi?.unlock?.();
    void tapToPayBridge.unlockPaymentOrientation();
  }, [contactlessBusy, contactlessStatus, stage, terminalMode]);

  useEffect(() => {
    if (stage !== 'contactless' || !restaurantId) return;
    if (terminalMode === 'simulated_terminal') return;
    logContactlessState('old_kiosk_contactless_path_invoked', { action: 'bypassed_to_shared_overlay' });
    const statusPoll = async () => {
      const nativeStatus = await tapToPayBridge.getTapToPayStatus();
      const latestStatus = contactlessStatusRef.current;
      setContactlessDebug(`native:${nativeStatus.status}`);
      if (
        (latestStatus === 'canceled' || latestStatus === 'failed' || latestStatus === 'succeeded') &&
        nativeStatus.sessionId &&
        (shouldSuppressDeadRunRevival('native_status_poll_terminal_guard', nativeStatus.sessionId) ||
          shouldBlockNonTerminalWrite('native_status_poll_terminal_guard', nativeStatus.sessionId))
      ) {
        return;
      }
      if (
        (latestStatus === 'canceled' || latestStatus === 'failed' || latestStatus === 'succeeded') &&
        (!nativeStatus.sessionId || shouldSuppressDeadRunRevival('native_status_poll_terminal_guard_fallback', contactlessSessionId))
      ) {
        return;
      }
      if (
        (nativeStatus.status === 'processing' || nativeStatus.status === 'collecting') &&
        latestStatus !== 'canceled' &&
        latestStatus !== 'failed' &&
        latestStatus !== 'succeeded'
      ) {
        setContactlessStatus(nativeStatus.status);
      }
      if (nativeStatus.sessionId && !contactlessSessionId) {
        setContactlessSessionId(nativeStatus.sessionId);
      }
    };
    void statusPoll();
  }, [contactlessSessionId, logContactlessState, restaurantId, shouldSuppressDeadRunRevival, shouldBlockNonTerminalWrite, stage, terminalMode]);

  useEffect(() => {
    if (stage !== 'contactless') return;
    if (!showSharedTransitionOverlay) return;
    logContactlessState('duplicate_prehandover_render_attempt', {
      phase: contactlessUiPhase,
      status: contactlessStatus,
    });
  }, [contactlessStatus, contactlessUiPhase, logContactlessState, showSharedTransitionOverlay, stage]);

  useEffect(() => {
    if (stage !== 'contactless') return;
    if (!showSharedTransitionOverlay) return;
    logContactlessState('close_affordance_eligibility_evaluated', {
      canCloseSharedTransitionOverlay,
      phase: contactlessUiPhase,
      status: contactlessStatus,
      preHandoverOverlayOwned,
      contactlessBusy,
      terminalVisualState,
    });
  }, [
    canCloseSharedTransitionOverlay,
    contactlessBusy,
    contactlessStatus,
    contactlessUiPhase,
    logContactlessState,
    preHandoverOverlayOwned,
    showSharedTransitionOverlay,
    stage,
    terminalVisualState,
  ]);

  useEffect(() => {
    if (stage !== 'contactless') return;
    if (!showSharedTransitionOverlay) return;
    if (!canCloseSharedTransitionOverlay) return;
    logContactlessState('kiosk_exit_cross_rendered', {
      phase: contactlessUiPhase,
      status: contactlessStatus,
    });
  }, [canCloseSharedTransitionOverlay, contactlessStatus, contactlessUiPhase, logContactlessState, showSharedTransitionOverlay, stage]);

  useEffect(() => {
    if (stage !== 'contactless') return;
    if (contactlessBusy) return;
    if (contactlessStatus !== 'idle') return;
    if (amountCents <= 0) return;
    void runTapToPay();
  }, [amountCents, contactlessBusy, contactlessStatus, runTapToPay, stage]);

  useEffect(() => {
    if (stage !== 'contactless') return;
    if (!contactlessSessionId || !restaurantId) return;
    if (!isNativeTapToPayOverlayVisiblePhase(contactlessStatus, { hasReturnedFromNative })) return;

    const watchdog = window.setTimeout(() => {
      void (async () => {
        await loadServerSessionTruth(contactlessSessionId, 'watchdog');
        await reconcileSession(contactlessSessionId, 'watchdog');
        window.setTimeout(() => {
          setContactlessStatus((current) => {
            if (isNativeTapToPayOverlayVisiblePhase(current, { hasReturnedFromNative: true })) {
              setContactlessError('Payment did not complete. Please choose another payment method and try again.');
              return 'failed';
            }
            return current;
          });
        }, 1400);
      })();
    }, 45000);

    return () => window.clearTimeout(watchdog);
  }, [contactlessSessionId, contactlessStatus, loadServerSessionTruth, reconcileSession, restaurantId, stage]);

  useEffect(() => {
    if (settingsLoading) return;
    if (orderSubmitting) return;
    if (suppressStageAutoSubmit) return;
    if (stage === 'cash' && autoSubmitAttemptedMethod !== 'cash') {
      setAutoSubmitAttemptedMethod('cash');
      void submitOrderAndRedirect('cash');
    } else if (stage === 'pay_at_counter' && autoSubmitAttemptedMethod !== 'pay_at_counter') {
      setAutoSubmitAttemptedMethod('pay_at_counter');
      void submitOrderAndRedirect('pay_at_counter');
    }
  }, [autoSubmitAttemptedMethod, orderSubmitting, settingsLoading, stage, submitOrderAndRedirect, suppressStageAutoSubmit]);

  useEffect(() => {
    if (contactlessStatus !== 'succeeded' || contactlessTerminalState !== 'success' || orderSubmitting || autoSubmitAttemptedMethod === 'contactless') return;
    if (contactlessTerminalRouteCommittedRef.current) return;
    contactlessTerminalRouteCommittedRef.current = true;
    logContactlessState('kiosk_terminal_route_selected', { terminalType: 'success', destination: 'order_confirmation' });
    console.info('[payments][contactless_eligibility]', 'terminal_outcome_selected', { entryPoint: 'kiosk', outcome: 'success' });
    setSuccessTickVisible(true);
    setTerminalVisualState('success');
    const timeout = window.setTimeout(() => {
      setAutoSubmitAttemptedMethod('contactless');
      logContactlessState('kiosk_terminal_route_committed', { terminalType: 'success', destination: 'order_confirmation' });
      console.info('[payments][contactless_eligibility]', 'terminal_route_committed', {
        entryPoint: 'kiosk',
        outcome: 'success',
        destination: 'order_confirmation',
      });
      logContactlessState('kiosk_legacy_post_payment_continuation_blocked', {
        blockedPath: 'resume_checkout_submit_waiting_to_confirm_payment',
      });
      void submitOrderAndRedirect('contactless');
    }, 900);
    return () => {
      window.clearTimeout(timeout);
      setSuccessTickVisible(false);
      setTerminalVisualState(null);
    };
  }, [autoSubmitAttemptedMethod, contactlessStatus, contactlessTerminalState, logContactlessState, orderSubmitting, submitOrderAndRedirect]);

  useEffect(() => {
    if (contactlessStatus === 'succeeded') return;
    if (authoritativeSuccessRef.current.committed) return;
    contactlessTerminalRouteCommittedRef.current = false;
  }, [contactlessStatus]);

  useEffect(() => {
    if (stage !== 'contactless') return;
    if (contactlessBusy) return;
    if (authoritativeSuccessRef.current.committed) return;
    if (contactlessStatus !== 'failed' && contactlessStatus !== 'canceled') return;
    if (terminalTransitionLockRef.current) return;
    terminalTransitionLockRef.current = true;
    const visual = contactlessStatus === 'canceled' ? 'canceled' : 'failed';
    setTerminalVisualState(visual);
    logContactlessState('terminal_visual_state_selected', { terminalType: visual, stage });
    const timeout = window.setTimeout(() => {
      const message =
        contactlessStatus === 'canceled'
          ? 'Payment cancelled'
          : contactlessUnsupportedDevice
            ? 'This kiosk device does not support Tap to Pay on this hardware. Please use another payment method.'
            : contactlessError || 'Payment failed, please try again or choose another payment method.';
      setTerminalVisualState(null);
      terminalTransitionLockRef.current = false;
      returnToFallback(message, contactlessStatus === 'canceled' ? 'canceled' : 'failed');
    }, 900);
    return () => {
      window.clearTimeout(timeout);
      terminalTransitionLockRef.current = false;
    };
  }, [contactlessBusy, contactlessError, contactlessStatus, contactlessUnsupportedDevice, logContactlessState, returnToFallback, stage]);

  useEffect(() => {
    if (stage !== 'contactless' || !restaurantId) return;
    if (typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(CONTACTLESS_SESSION_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { sessionId?: string; restaurantId?: string };
      if (parsed?.sessionId && parsed?.restaurantId === restaurantId) {
        if (shouldSuppressDeadRunRevival('local_restore_processing_resume', parsed.sessionId)) return;
        if (shouldBlockNonTerminalWrite('local_restore_processing_resume', parsed.sessionId)) return;
        setContactlessSessionId(parsed.sessionId);
        if (!suppressLegacyPostSuccessDowngrade('local_restore_processing_resume', { sessionId: parsed.sessionId })) {
          setContactlessStatus('processing');
        }
        setContactlessError('');
        void loadServerSessionTruth(parsed.sessionId, 'local_restore');
      }
    } catch {
      window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
    }
  }, [CONTACTLESS_SESSION_STORAGE_KEY, loadServerSessionTruth, restaurantId, shouldSuppressDeadRunRevival, shouldBlockNonTerminalWrite, stage, suppressLegacyPostSuccessDowngrade]);

  useEffect(() => {
    if (stage !== 'contactless' || !restaurantId || !contactlessSessionId) return;
    if (typeof document === 'undefined') return;

    const onVisibilityChange = () => {
      console.info('[kiosk][tap_to_pay_visibility_telemetry]', {
        sessionId: contactlessSessionId,
        restaurantId,
        visibilityState: document.visibilityState,
        contactlessStatus,
        contactlessBusy,
        at: new Date().toISOString(),
      });
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [contactlessBusy, contactlessSessionId, contactlessStatus, restaurantId, stage]);

  const cancelTapToPay = useCallback(async () => {
    if (!contactlessSessionId || !restaurantId || cancelLockRef.current) return;
    if (authoritativeSuccessRef.current.committed) {
      logContactlessState('late_cancel_received_after_success', {
        sessionId: contactlessSessionId,
        firstSuccessSource: authoritativeSuccessRef.current.source,
      });
      return;
    }
    cancelLockRef.current = true;
    setContactlessBusy(true);
    setContactlessDebug('canceling');
    logContactlessState('exit_cross_clicked', { sessionId: contactlessSessionId });
    logContactlessState('kiosk_exit_cross_clicked', { sessionId: contactlessSessionId });
    if (contactlessOwnerRef.current?.active) {
      contactlessOwnerRef.current = { ...contactlessOwnerRef.current, active: false, cancelRequested: true };
      logContactlessState('cancel_barrier_set', { ownerId: contactlessOwnerRef.current.id, sessionId: contactlessSessionId });
    }
    logContactlessState('kiosk_terminal_route_selected', { terminalType: 'cancel', sessionId: contactlessSessionId });
    if (!commitNonSuccessOutcome('canceled', 'manual_overlay_close_cancel_requested', { sessionId: contactlessSessionId }, 'Payment cancelled')) {
      setContactlessBusy(false);
      cancelLockRef.current = false;
      flowLockRef.current = false;
      return;
    }
    try {
      logContactlessState('native_cancel_attempt_started', { sessionId: contactlessSessionId });
      await tapToPayBridge.cancelTapToPayPayment();
      await fetch('/api/kiosk/payments/card-present/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: contactlessSessionId, restaurant_id: restaurantId, reason: 'Canceled on kiosk' }),
      });
      logContactlessState('native_cancel_confirmed', { sessionId: contactlessSessionId });
      logContactlessState('kiosk_cancel_received', { sessionId: contactlessSessionId, reason: 'manual_overlay_close' });
      setContactlessError('Payment cancelled');
      setContactlessUnsupportedDevice(false);
      logContactlessState('cancel_cleanup_completed', { sessionId: contactlessSessionId });
      releaseContactlessOwner('canceled');
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CONTACTLESS_SESSION_STORAGE_KEY);
      }
    } catch (error) {
      logContactlessState('native_cancel_failed_or_unavailable', {
        sessionId: contactlessSessionId,
        message: error instanceof Error ? error.message : String(error),
      });
      logContactlessState('cancel_outcome_preserved_after_cancel_error', { sessionId: contactlessSessionId });
      setContactlessDebug('cancel_failed_or_unavailable');
    } finally {
      setContactlessBusy(false);
      cancelLockRef.current = false;
      flowLockRef.current = false;
    }
  }, [CONTACTLESS_SESSION_STORAGE_KEY, commitNonSuccessOutcome, contactlessSessionId, logContactlessState, releaseContactlessOwner, restaurantId]);

  const renderMethodPicker = () => (
    <section className="w-full space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Choose payment</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {enabledMethods.map((method) => {
          const meta = PAYMENT_METHOD_META[method];
          const Icon = meta.icon;
          return (
            <button
              key={method}
              type="button"
              onClick={async () => {
                setOrderSubmitError('');
                setAutoSubmitAttemptedMethod(null);
                if (method === 'contactless') {
                  if (!sessionStartContactlessEligible) {
                    setPaymentNotice('Contactless is unavailable right now. Please choose another method.');
                    return;
                  }
                  const eligibilityAtSelection = await recheckContactlessEligibility('selection');
                  if (!eligibilityAtSelection.eligible) {
                    logContactlessState('contactless_selection_blocked_by_eligibility_guard', {
                      checkpoint: 'selection',
                      reason: eligibilityAtSelection.reason,
                    });
                    setPaymentNotice('Contactless is unavailable right now. Please choose another method.');
                    return;
                  }
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
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-5 text-left shadow-sm transition hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-md"
              style={{
                borderColor: paymentTheme.ring,
                backgroundImage: `linear-gradient(135deg, #ffffff 0%, ${paymentTheme.primarySoft} 100%)`,
              }}
            >
              <div
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ background: `linear-gradient(135deg, ${paymentTheme.primary}, ${paymentTheme.secondary})` }}
              >
                <Icon className="h-6 w-6" />
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-900">{meta.title}</p>
              {method !== 'pay_at_counter' ? <p className="mt-1 text-sm text-slate-600">{meta.subtitle}</p> : null}
            </button>
          );
        })}
      </div>
    </section>
  );

  const renderOrderSubmittingOverlay = () => (
    <div
      className="fixed inset-0 z-[74] flex items-center justify-center px-4 backdrop-blur-[2px]"
      style={{
        backgroundImage: `linear-gradient(160deg, ${hexToRgba(paymentTheme.primary, 0.34)}, ${hexToRgba(paymentTheme.secondary, 0.22)})`,
      }}
    >
      <section className="w-full max-w-md rounded-[2rem] border bg-white/95 p-6 text-center shadow-2xl" style={{ borderColor: paymentTheme.ring }}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Finishing checkout</p>
        <div className="mx-auto mt-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200" style={{ borderTopColor: paymentTheme.primary }} />
        <p className="mt-4 text-base font-medium text-slate-800">
          {currentOrderMethod === 'contactless' ? 'Payment captured. Sending your order to the kitchen...' : 'Sending your order to the kitchen...'}
        </p>
      </section>
    </div>
  );

  return (
    <KioskLayout restaurantId={restaurantId} restaurant={restaurant} restaurantLoading={restaurantLoading}>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-4xl space-y-4">
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
                Back
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
          {!settingsLoading && stage === 'contactless' && showOperatorDetails ? (
            <section className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tap to Pay startup diagnostics</p>
              <p className="mt-1">
                <span className="font-semibold">mode:</span> {terminalMode}
              </p>
              <p className="mt-1">
                <span className="font-semibold">debug:</span> {contactlessDebug}
              </p>
              {contactlessDebugDetail ? (
                <p className="mt-1">
                  <span className="font-semibold">detail:</span> {contactlessDebugDetail}
                </p>
              ) : null}
              <div className="mt-2 space-y-1">
                {(Object.keys(STARTUP_TRACE_LABELS) as StartupTraceKey[]).map((key) => (
                  <p key={key}>
                    <span className="font-semibold">{STARTUP_TRACE_LABELS[key]}:</span> {tapStartupTrace[key].status}
                    {tapStartupTrace[key].detail ? ` — ${tapStartupTrace[key].detail}` : ''}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {!settingsLoading && stage === 'method_picker' ? renderMethodPicker() : null}
          {!settingsLoading && stage === 'contactless' ? (
            <NativeTapToPayPreHandoverOverlay
              visible={showSharedTransitionOverlay}
              lines={transitionLines}
              lineIndex={prepMessageIndex}
              showSuccessTick={successTickVisible}
              canClose={canCloseSharedTransitionOverlay}
              onClose={() => {
                void cancelTapToPay();
              }}
              terminalState={terminalVisualState}
            />
          ) : null}
          {!settingsLoading && orderSubmitting ? renderOrderSubmittingOverlay() : null}
        </div>
      </div>
    </KioskLayout>
  );
}
