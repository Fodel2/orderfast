import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tapToPayBridge } from '@/lib/kiosk/tapToPayBridge';
import { formatPrice } from '@/lib/orderDisplay';
import { resolveNativeTapToPayReadiness } from '@/lib/kiosk/tapToPayNativeReadiness';
import { type AppFlowState } from '@/lib/app/launcherBootstrap';
import { internalSettlementActiveRunStore } from '@/lib/payments/internalSettlementActiveRunStore';
import { buildCombinedTapToPayDiagnosticsPayload } from '@/lib/payments/tapToPayDiagnostics';

type SettlementMode = 'order_payment' | 'quick_charge';
type CollectionState = AppFlowState | 'idle';
type CollectionFailureCategory =
  | 'customer_cancelled'
  | 'app_cancelled'
  | 'timeout'
  | 'process_failed'
  | 'collect_failed'
  | 'ambiguous_canceled_after_takeover'
  | 'unknown_native_error';

type UnpaidOrder = {
  id: string;
  short_order_number: number | null;
  customer_name: string | null;
  order_type: string | null;
  status: string;
  total_price: number | null;
  created_at: string;
};

const toCurrencyCode = (value?: string | null) => (value || 'GBP').toUpperCase();

const makeIdempotencyKey = (prefix: string) => `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
const QUICK_CHARGE_MINIMUM_CENTS = 50;

type InternalSettlementModuleProps = {
  title?: string;
  eyebrow?: string;
  restaurantId?: string | null;
  onFlowActivityChange?: (active: boolean) => void;
};

type QuickChargeFailureSnapshot = {
  mode: 'quick_charge';
  runtimeDebuggable: boolean | null;
  paymentIntentId: string | null;
  retrieveSucceeded: boolean | null;
  collectInvoked: boolean | null;
  collectCallbackStatus: string | null;
  collectReturnedUpdatedIntent: boolean | null;
  collectReturnedPaymentMethodAttached: string | null;
  processInvoked: boolean | null;
  processCallbackStatus: string | null;
  processFailureCode: string | null;
  processFailureMessage: string | null;
  processFailureExceptionClass: string | null;
  processFailureReasonCategory: string | null;
  rawProcessCallbackPayload: Record<string, unknown> | null;
  processFailureStackTop: string | null;
  processFailureDetailReason: string | null;
  processFailureTerminalCode: string | null;
  processFailureNativeStage: string | null;
  pluginInFlight: boolean | null;
  pluginStatus: string | null;
  stripeTakeoverObserved: boolean | null;
  backgroundInterruptionCandidate: boolean | null;
  confirmedBackgroundInterruption: boolean | null;
  lifecyclePausedDuringActiveFlow: boolean | null;
  lastPauseAtMs: number | null;
  lastStopAtMs: number | null;
  lastResumeAtMs: number | null;
  lastLifecycleEvents: string[] | null;
  hostActivityRequestedOrientation: string | null;
  hostActivityCurrentOrientation: string | null;
  hostActivityChangingConfigurations: boolean | null;
  hostActivityWindowFocus: boolean | null;
  hostActivityWasPaused: boolean | null;
  hostActivityWasStopped: boolean | null;
  hostActivityWasDestroyed: boolean | null;
  appInBackgroundAtFailure: boolean | null;
  immersiveModeActive: boolean | null;
  immersiveReappliedDuringPayment: boolean | null;
  orientationChangedDuringPayment: boolean | null;
  windowFocusChangedDuringPayment: boolean | null;
  processDeferredForForegroundFocus: boolean | null;
  timedEventTrail: string[] | null;
  appResumedDuringProcessInFlight: boolean | null;
  nativeFailurePoint: string | null;
  finalServerVerifiedStatus: string | null;
  finalFailureReason: string | null;
};

type QuickChargeSuccessSnapshot = {
  mode: 'quick_charge';
  paymentIntentId: string | null;
  retrieveCallbackCount: number | null;
  collectSuccessCallbackCount: number | null;
  collectFailureCallbackCount: number | null;
  processInvocationCount: number | null;
  processSuccessCallbackCount: number | null;
  processFailureCallbackCount: number | null;
  processCallbackCount: number | null;
  retrievedPaymentIntentId: string | null;
  lastCollectCallbackPaymentIntentId: string | null;
  lastProcessCallbackPaymentIntentId: string | null;
  samePaymentIntentIdAcrossRetrieveCollectProcess: boolean | null;
  collectIntentReferenceChanged: boolean | null;
  intermediateCallbackObserved: boolean | null;
  repeatedCollectSignalDetected: boolean | null;
  suspectedSecondPresentment: boolean | null;
  paymentStatusChangeCountBeforeCollectSuccess: number | null;
  paymentStatusWaitingForInputCountBeforeCollectSuccess: number | null;
  paymentStatusProcessingCountBeforeCollectSuccess: number | null;
  paymentStatusReadyCountBeforeCollectSuccess: number | null;
  paymentStatusTrailBeforeCollectSuccess: string[] | null;
  repeatedWaitingForInputBeforeCollectSuccess: boolean | null;
  repeatedReadyBeforeCollectSuccess: boolean | null;
  repeatedProcessingBeforeCollectSuccess: boolean | null;
  nativeStatusBouncedBackToInputWaitingBeforeCollectSuccess: boolean | null;
  timedEventTrail: string[] | null;
};

export default function InternalSettlementModule({
  title = 'Internal collection',
  eyebrow = 'Internal settlement module',
  restaurantId = null,
  onFlowActivityChange,
}: InternalSettlementModuleProps) {
  const [mode, setMode] = useState<SettlementMode>('order_payment');
  const [orders, setOrders] = useState<UnpaidOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [tapAvailabilityLoading, setTapAvailabilityLoading] = useState(true);
  const [tapAvailabilityReady, setTapAvailabilityReady] = useState(false);
  const [tapAvailabilityReason, setTapAvailabilityReason] = useState('');
  const [nativeReadinessLoading, setNativeReadinessLoading] = useState(false);
  const [nativeReadinessReady, setNativeReadinessReady] = useState(false);
  const [nativeReadinessReason, setNativeReadinessReason] = useState('');

  const [quickAmount, setQuickAmount] = useState('0.00');
  const [quickNote, setQuickNote] = useState('');
  const [quickReference, setQuickReference] = useState('');

  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<CollectionState>('idle');
  const [message, setMessage] = useState('Ready to collect payment.');
  const [quickChargeFailureSnapshot, setQuickChargeFailureSnapshot] = useState<QuickChargeFailureSnapshot | null>(null);
  const [quickChargeSuccessSnapshot, setQuickChargeSuccessSnapshot] = useState<QuickChargeSuccessSnapshot | null>(null);
  const [quickChargeRawNativePayload, setQuickChargeRawNativePayload] = useState<Record<string, unknown> | null>(null);
  const [quickChargeRawServerVerificationPayload, setQuickChargeRawServerVerificationPayload] = useState<Record<string, unknown> | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTerminalLocationId, setActiveTerminalLocationId] = useState<string | null>(null);
  const flowActiveRef = useRef(false);
  const flowRunIdRef = useRef<string | null>(null);
  const quickChargeAttemptStartMsRef = useRef<number | null>(null);
  const quickChargeAttemptEndMsRef = useRef<number | null>(null);
  const quickChargeEventSequenceRef = useRef(0);
  const quickChargeUiEventHistoryRef = useRef<Record<string, unknown>[]>([]);
  const quickChargePaymentIntentIdRef = useRef<string | null>(null);

  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) || null, [orders, selectedOrderId]);

  const amountCents = useMemo(() => {
    if (mode === 'order_payment') return Number(selectedOrder?.total_price || 0);
    const numeric = Number(quickAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.round(numeric * 100);
  }, [mode, quickAmount, selectedOrder?.total_price]);

  const amountLabel = useMemo(() => formatPrice(amountCents / 100), [amountCents]);
  const nativeRestaurantId = useMemo(() => {
    const value = restaurantId?.trim();
    return value ? value : null;
  }, [restaurantId]);
  const quickChargeAttemptDiagnosticsPayload = useMemo(() => {
    if (mode !== 'quick_charge') return null;
    const attemptSummary =
      state === 'completed' && quickChargeSuccessSnapshot
        ? quickChargeSuccessSnapshot
        : state === 'failed' && quickChargeFailureSnapshot
          ? quickChargeFailureSnapshot
          : null;
    if (!attemptSummary) return null;
    return buildCombinedTapToPayDiagnosticsPayload({
      attemptSummary: attemptSummary as unknown as Record<string, unknown>,
      rawNativePayload: quickChargeRawNativePayload,
      rawServerVerificationPayload: quickChargeRawServerVerificationPayload,
      uiEventHistory: quickChargeUiEventHistoryRef.current,
      uiContext: {
        collectionState: state,
        message,
        sessionId: activeSessionId,
        flowRunId: flowRunIdRef.current,
        paymentIntentId: quickChargePaymentIntentIdRef.current,
        terminalLocationId: activeTerminalLocationId,
        restaurantId: nativeRestaurantId,
        attemptStartTimestampMs: quickChargeAttemptStartMsRef.current,
        attemptEndTimestampMs: quickChargeAttemptEndMsRef.current,
      },
    });
  }, [
    mode,
    state,
    message,
    activeSessionId,
    activeTerminalLocationId,
    nativeRestaurantId,
    quickChargeSuccessSnapshot,
    quickChargeFailureSnapshot,
    quickChargeRawNativePayload,
    quickChargeRawServerVerificationPayload,
  ]);
  const quickChargeAttemptDiagnosticsSerialized = useMemo(
    () => (quickChargeAttemptDiagnosticsPayload ? JSON.stringify(quickChargeAttemptDiagnosticsPayload, null, 2) : null),
    [quickChargeAttemptDiagnosticsPayload]
  );

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const response = await fetch('/api/dashboard/internal-settlement/unpaid-orders');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
      const nextOrders = Array.isArray(payload?.orders) ? (payload.orders as UnpaidOrder[]) : [];
      setOrders(nextOrders);
      if (nextOrders.length > 0 && !nextOrders.some((order) => order.id === selectedOrderId)) {
        setSelectedOrderId(nextOrders[0].id);
      }
    } catch (error: any) {
      setMessage(error?.message || 'Failed to load unpaid orders.');
      setState('failed');
    } finally {
      setLoadingOrders(false);
    }
  }, [selectedOrderId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    let active = true;

    const loadAvailability = async () => {
      setTapAvailabilityLoading(true);
      try {
        const response = await fetch('/api/dashboard/internal-settlement/tap-to-pay-availability');
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
        const available = payload?.tap_to_pay_available === true;
        setTapAvailabilityReady(available);
        setTapAvailabilityReason(available ? '' : String(payload?.reason || 'Tap to Pay is not available for this restaurant.'));
      } catch (error: any) {
        if (!active) return;
        setTapAvailabilityReady(false);
        setTapAvailabilityReason(error?.message || 'Tap to Pay availability could not be confirmed.');
      } finally {
        if (active) setTapAvailabilityLoading(false);
      }
    };

    void loadAvailability();
    return () => {
      active = false;
    };
  }, []);

  const applyBootstrapState = useCallback((readiness: Awaited<ReturnType<typeof resolveNativeTapToPayReadiness>>) => {
    if (!readiness.supported) {
      setState('unsupported_device');
      return;
    }
    if (readiness.state === 'permission_not_requested') {
      setState('setup_failed');
      return;
    }
    if (readiness.state === 'permission_denied') {
      setState('permission_denied');
      return;
    }
    if (readiness.state === 'location_services_disabled') {
      setState('location_services_disabled');
      return;
    }
    if (readiness.ready) {
      setState('ready');
      return;
    }
    setState('failed');
  }, []);

  const refreshNativeReadiness = useCallback(
    async (promptIfNeeded: boolean) => {
      if (!nativeRestaurantId) {
        setNativeReadinessReady(false);
        setNativeReadinessReason('Restaurant context is missing. Return to launcher and open Take Payment again.');
        setState('failed');
        return null;
      }

      setNativeReadinessLoading(true);
      try {
        const readiness = await resolveNativeTapToPayReadiness({ promptIfNeeded });
        if (!readiness.supported || !readiness.ready) {
          setNativeReadinessReady(false);
          setNativeReadinessReason(readiness.reason);
          applyBootstrapState(readiness);
          return readiness;
        }
        setNativeReadinessReady(true);
        setNativeReadinessReason('');
        setState('ready');
        return readiness;
      } catch (error: any) {
        const reason = error?.message || 'Tap to Pay setup check failed.';
        setNativeReadinessReady(false);
        setNativeReadinessReason(reason);
        setState('failed');
        return null;
      } finally {
        setNativeReadinessLoading(false);
      }
    },
    [applyBootstrapState, nativeRestaurantId]
  );

  useEffect(() => {
    void refreshNativeReadiness(false);
  }, [refreshNativeReadiness]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onForeground = () => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        const nativeState = await tapToPayBridge.getActivePaymentRunState().catch(() => null);
        const nativeFlowInFlight = nativeState != null && (nativeState.activeRun === true || nativeState.inFlight === true);
        if (nativeFlowInFlight) {
          console.info('[internal-settlement][take-payment][quick-charge][tap-to-pay]', 'foreground_readiness_refresh_skipped_native_flow_in_flight', {
            nativeStatus: nativeState?.status || null,
            nativeActiveRun: nativeState?.activeRun === true,
            nativeInFlight: nativeState?.inFlight === true,
          });
          return;
        }
        if (flowActiveRef.current) return;
        await refreshNativeReadiness(false);
      })();
    };

    window.addEventListener('focus', onForeground);
    document.addEventListener('visibilitychange', onForeground);
    return () => {
      window.removeEventListener('focus', onForeground);
      document.removeEventListener('visibilitychange', onForeground);
    };
  }, [refreshNativeReadiness]);

  const isUnsupportedDeviceError = (code?: string) => code === 'unsupported' || code === 'unsupported_device';

  const logCollectionEvent = useCallback((event: string, payload?: Record<string, unknown>) => {
    const prefix = '[internal-settlement][take-payment][quick-charge][tap-to-pay]';
    if (mode === 'quick_charge' && quickChargeAttemptStartMsRef.current != null) {
      const now = Date.now();
      quickChargeEventSequenceRef.current += 1;
      const context = payload && typeof payload === 'object' ? payload : {};
      quickChargeUiEventHistoryRef.current.push({
        sequence: quickChargeEventSequenceRef.current,
        absoluteTimestamp: new Date(now).toISOString(),
        timestampMs: now,
        elapsedMsSinceAttemptStart: Math.max(0, now - (quickChargeAttemptStartMsRef.current || now)),
        eventName: `ui.${event}`,
        sessionId: activeSessionId,
        flowRunId: flowRunIdRef.current,
        paymentIntentId: quickChargePaymentIntentIdRef.current,
        processName: typeof context?.processName === 'string' ? context.processName : null,
        activityIdentityHash: null,
        context,
      });
    }
    if (event.includes('error') || event.includes('exception')) {
      console.error(prefix, event, payload);
      return;
    }
    if (
      event.includes('native_') ||
      event.includes('payment_intent') ||
      event.includes('finalize') ||
      event.includes('verification') ||
      event.includes('process') ||
      event.includes('collect')
    ) {
      console.info(prefix, event, payload);
    }
  }, [activeSessionId, mode]);

  const logQuickChargeSequenceEvent = useCallback(
    (
      event:
        | 'quick_charge_payment_intent_created'
        | 'quick_charge_native_result_returned_to_js'
        | 'quick_charge_server_verify_result'
        | 'quick_charge_final_failure_reason',
      payload: Record<string, unknown>
    ) => {
      if (mode !== 'quick_charge') return;
      console.info('[internal-settlement][quick-charge][sequence]', event, payload);
    },
    [mode]
  );

  useEffect(() => {
    onFlowActivityChange?.(busy || flowActiveRef.current);
  }, [busy, onFlowActivityChange]);

  const classifyNativeFailure = useCallback((nativeResult: Awaited<ReturnType<typeof tapToPayBridge.startTapToPayPayment>>) => {
    const detail =
      nativeResult.detail && typeof nativeResult.detail === 'object'
        ? (nativeResult.detail as { reasonCategory?: unknown; interruptionReasonCode?: unknown })
        : null;
    const reasonCategoryRaw =
      typeof (nativeResult as { reasonCategory?: unknown }).reasonCategory === 'string'
        ? String((nativeResult as { reasonCategory?: string }).reasonCategory)
        : typeof detail?.reasonCategory === 'string'
          ? String(detail.reasonCategory)
        : null;
    if (reasonCategoryRaw === 'customer_cancelled' || reasonCategoryRaw === 'app_cancelled') return reasonCategoryRaw;
    if (reasonCategoryRaw === 'lifecycle_interrupted') return 'ambiguous_canceled_after_takeover';
    const canceled = nativeResult.status === 'canceled' || nativeResult.code === 'canceled';
    if (canceled) {
      const interruptionReasonCode =
        typeof (nativeResult as { interruptionReasonCode?: unknown }).interruptionReasonCode === 'string'
          ? String((nativeResult as { interruptionReasonCode?: string }).interruptionReasonCode)
          : typeof detail?.interruptionReasonCode === 'string'
            ? String(detail.interruptionReasonCode)
            : null;
      if (interruptionReasonCode === 'background_loss_confirmed') {
        return 'ambiguous_canceled_after_takeover';
      }
      return 'customer_cancelled';
    }
    if (nativeResult.code === 'processing_error' && String(nativeResult.message || '').toLowerCase().includes('timed out')) return 'timeout';
    if (nativeResult.status === 'failed' && nativeResult.code === 'processing_error') return 'process_failed';
    if (nativeResult.status === 'failed') return 'collect_failed';
    return 'unknown_native_error';
  }, []);

  const failureMessageForCategory = useCallback((category: CollectionFailureCategory, fallback?: string) => {
    if (category === 'customer_cancelled') return 'Customer cancelled payment at the reader.';
    if (category === 'app_cancelled') return 'Payment was cancelled by this app.';
    if (category === 'ambiguous_canceled_after_takeover') return 'Tap to Pay ended as canceled after app takeover/backgrounding. Outcome is ambiguous until Stripe verification.';
    if (category === 'timeout') return 'Payment timed out before completion. Please retry.';
    if (category === 'process_failed') return fallback || 'Payment processing failed after card presentation.';
    if (category === 'collect_failed') return fallback || 'Payment collection failed before completion.';
    return fallback || 'Unknown Tap to Pay error. Please retry.';
  }, []);

  const handleCollectContactless = useCallback(async () => {
    if (busy) return;
    setQuickChargeFailureSnapshot(null);
    setQuickChargeSuccessSnapshot(null);
    setQuickChargeRawNativePayload(null);
    setQuickChargeRawServerVerificationPayload(null);
    if (mode === 'quick_charge') {
      const now = Date.now();
      quickChargeAttemptStartMsRef.current = now;
      quickChargeAttemptEndMsRef.current = null;
      quickChargeEventSequenceRef.current = 0;
      quickChargeUiEventHistoryRef.current = [];
      quickChargePaymentIntentIdRef.current = null;
    }
    if (!tapAvailabilityReady) {
      setState('failed');
      setMessage(tapAvailabilityReason || 'Tap to Pay is not available for this restaurant.');
      return;
    }
    if (mode === 'order_payment' && !selectedOrderId) {
      setState('failed');
      setMessage('Select an unpaid order first.');
      return;
    }
    if (amountCents <= 0) {
      setState('failed');
      setMessage('Amount must be greater than zero.');
      return;
    }
    if (mode === 'quick_charge' && amountCents < QUICK_CHARGE_MINIMUM_CENTS) {
      setState('failed');
      setMessage(`Quick charge must be at least ${formatPrice(QUICK_CHARGE_MINIMUM_CENTS / 100)}.`);
      return;
    }
    if (!nativeRestaurantId) {
      setState('failed');
      setMessage('Restaurant context is missing. Return to launcher and open Take Payment again.');
      return;
    }

    setBusy(true);
    flowActiveRef.current = true;
    flowRunIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setState('bootstrapping');
    setMessage('Checking Tap to Pay readiness…');

    let sessionIdForCleanup: string | null = null;
    let keepFlowActiveAfterError = false;
    const flowRunId = flowRunIdRef.current;
    const persistFlowOutcome = async (input: {
      sessionId: string;
      outcome: 'canceled' | 'failed' | 'needs_reconciliation';
      reason: string;
      failureCode?: string;
    }) => {
      await fetch('/api/dashboard/internal-settlement/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: input.sessionId,
          outcome: input.outcome,
          reason: input.reason,
          failure_code: input.failureCode,
          flow_run_id: flowRunId,
        }),
      }).catch(() => undefined);
    };
    try {
      logCollectionEvent('readiness_refresh.start');
      const readinessRes = await fetch('/api/dashboard/internal-settlement/tap-to-pay-availability');
      const readinessPayload = await readinessRes.json().catch(() => ({}));
      if (!readinessRes.ok || !readinessPayload?.tap_to_pay_available) {
        logCollectionEvent('readiness_refresh.result', {
          ok: false,
          httpStatus: readinessRes.status,
          reason: readinessPayload?.reason || null,
        });
        setState('failed');
        setMessage(readinessPayload?.reason || 'Tap to Pay is not available for this restaurant.');
        return;
      }
      logCollectionEvent('readiness_refresh.result', {
        ok: true,
        terminalLocationId: readinessPayload?.terminal_location_id || null,
      });

      const nativeReadiness = await refreshNativeReadiness(false);
      if (!nativeReadiness || !nativeReadiness.supported || !nativeReadiness.ready) {
        setState('failed');
        setMessage(nativeReadiness?.reason || 'Tap to Pay setup is incomplete on this device.');
        return;
      }

      logCollectionEvent('session_create.start');
      const createRes = await fetch('/api/dashboard/internal-settlement/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          idempotency_key: makeIdempotencyKey('internal_settlement'),
          flow_run_id: flowRunId,
          order_id: mode === 'order_payment' ? selectedOrderId : null,
          amount_cents: mode === 'quick_charge' ? amountCents : undefined,
          currency: 'gbp',
          note: mode === 'quick_charge' ? quickNote : undefined,
          reference: mode === 'quick_charge' ? quickReference : undefined,
        }),
      });
      const createPayload = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        logCollectionEvent('session_create.error', {
          httpStatus: createRes.status,
          message: createPayload?.message || null,
        });
        throw new Error(createPayload?.message || `Failed to create payment session (${createRes.status})`);
      }
      logCollectionEvent('session_create.success', { ok: createRes.ok, sessionId: createPayload?.session?.id || null });

      const sessionId = createPayload?.session?.id ? String(createPayload.session.id) : '';
      const terminalLocationId = createPayload?.session?.stripe_terminal_location_id
        ? String(createPayload.session.stripe_terminal_location_id)
        : '';

      if (!sessionId || !terminalLocationId) throw new Error('Missing payment session context.');
      sessionIdForCleanup = sessionId;
      setActiveSessionId(sessionId);
      setActiveTerminalLocationId(terminalLocationId);
      internalSettlementActiveRunStore.create({
        flowRunId: flowRunId || `${Date.now()}`,
        sessionId,
        terminalLocationId,
        restaurantId: nativeRestaurantId,
        mode,
        amountCents,
      });
      logCollectionEvent('active_run_created', { sessionId, terminalLocationId, flowRunId });

      logCollectionEvent('prepare_start', { stage: 'create_payment_intent' });
      const intentRes = await fetch('/api/dashboard/internal-settlement/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, flow_run_id: flowRunId }),
      });
      const intentPayload = await intentRes.json().catch(() => ({}));
      if (!intentRes.ok) {
        logCollectionEvent('process_error', {
          stage: 'create_payment_intent',
          httpStatus: intentRes.status,
          message: intentPayload?.message || null,
        });
        throw new Error(intentPayload?.message || `Failed to prepare payment intent (${intentRes.status})`);
      }
      logCollectionEvent('prepare_result', { stage: 'create_payment_intent', ok: intentRes.ok, sessionId, paymentIntentId: intentPayload?.paymentIntentId || null });
      logQuickChargeSequenceEvent('quick_charge_payment_intent_created', {
        sessionId,
        flowRunId,
        paymentIntentId: intentPayload?.paymentIntentId || null,
        paymentIntentStatus: intentPayload?.status || null,
        webStripeLayerInvolved: false,
      });
      const paymentIntentClientSecret = intentPayload?.clientSecret ? String(intentPayload.clientSecret) : '';
      const paymentIntentId = intentPayload?.paymentIntentId ? String(intentPayload.paymentIntentId) : '';
      const paymentIntentStatus = intentPayload?.status ? String(intentPayload.status) : '';
      quickChargePaymentIntentIdRef.current = paymentIntentId || null;
      if (!paymentIntentClientSecret) {
        throw new Error('Payment intent client secret missing from settlement response.');
      }

      setState('preparing');
      setMessage('Preparing Tap to Pay reader…');
      logCollectionEvent('prepare_start', { stage: 'native_prepare', sessionId });
      const backendBaseUrl = window.location.origin;
      const prepared = await tapToPayBridge.prepareTapToPay({
        restaurantId: nativeRestaurantId,
        sessionId,
        backendBaseUrl,
        terminalLocationId,
        flowRunId: flowRunId || undefined,
      });
      if (prepared.status === 'failed' || prepared.status === 'unavailable') {
        logCollectionEvent('prepare_result', { stage: 'native_prepare', ok: false, sessionId, result: prepared });
        setState(isUnsupportedDeviceError(prepared.code) ? 'unsupported_device' : 'failed');
        setMessage(prepared.message || 'Tap to Pay reader setup failed. Retry to reconnect the reader.');
        await persistFlowOutcome({ sessionId, outcome: 'failed', reason: 'Native Tap to Pay preparation failed.', failureCode: 'native_prepare_failed' });
        setActiveSessionId(null);
        setActiveTerminalLocationId(null);
        internalSettlementActiveRunStore.clear();
        return;
      }
      logCollectionEvent('prepare_result', { stage: 'native_prepare', ok: true, sessionId, result: prepared });

      const readinessRecheckRes = await fetch('/api/dashboard/internal-settlement/tap-to-pay-availability');
      const readinessRecheckPayload = await readinessRecheckRes.json().catch(() => ({}));
      if (!readinessRecheckRes.ok || !readinessRecheckPayload?.tap_to_pay_available) {
        setState('failed');
        setMessage(readinessRecheckPayload?.reason || 'Tap to Pay availability changed. Retry to start a new payment session.');
        await persistFlowOutcome({
          sessionId,
          outcome: 'needs_reconciliation',
          reason: readinessRecheckPayload?.reason || 'Tap to Pay availability changed during active collection setup.',
          failureCode: 'availability_changed_mid_flow',
        });
        setActiveSessionId(null);
        setActiveTerminalLocationId(null);
        internalSettlementActiveRunStore.clear();
        return;
      }

      setState('collecting');
      setMessage('Present card/phone to collect payment…');
      logCollectionEvent('native_collect.start', { sessionId });

      let nativeResult = await tapToPayBridge.startTapToPayPayment({
        restaurantId: nativeRestaurantId,
        sessionId,
        backendBaseUrl,
        terminalLocationId,
        flowRunId: flowRunId || undefined,
        paymentIntentClientSecret,
        paymentIntentId: paymentIntentId || undefined,
        paymentIntentStatus: paymentIntentStatus || undefined,
      });
      logCollectionEvent('native_result_payload_from_bridge', {
        sessionId,
        flowRunId,
        nativeStatus: nativeResult.status,
        nativeCode: nativeResult.code || null,
        nativeMessage: nativeResult.message || null,
        paymentIntentId: nativeResult.paymentIntentId || null,
        paymentIntentStatus: nativeResult.paymentIntentStatus || null,
        paymentIntentSource: nativeResult.paymentIntentSource || null,
        nativeStage: nativeResult.nativeStage || null,
      });
      logQuickChargeSequenceEvent('quick_charge_native_result_returned_to_js', {
        sessionId,
        flowRunId,
        paymentIntentId: nativeResult.paymentIntentId || null,
        paymentIntentStatus: nativeResult.paymentIntentStatus || null,
        processPaymentIntentInvoked:
          (nativeResult.detail && typeof nativeResult.detail === 'object'
            ? (nativeResult.detail as { processInvoked?: unknown }).processInvoked === true
            : false) || nativeResult.nativeStage === 'native_process_result',
        usedPostCollectPaymentIntent:
          nativeResult.detail && typeof nativeResult.detail === 'object'
            ? (nativeResult.detail as { usedPostCollectPaymentIntent?: unknown }).usedPostCollectPaymentIntent === true
            : null,
        webStripeLayerInvolved: false,
      });
      const nativeTraceSnapshot =
        nativeResult && typeof nativeResult === 'object' && (nativeResult as { quickChargeTraceSnapshot?: unknown }).quickChargeTraceSnapshot
          ? ((nativeResult as { quickChargeTraceSnapshot?: unknown }).quickChargeTraceSnapshot as Record<string, unknown>)
          : null;
      if (mode === 'quick_charge') {
        setQuickChargeRawNativePayload(nativeResult && typeof nativeResult === 'object' ? (nativeResult as Record<string, unknown>) : null);
      }
      if (nativeResult.paymentIntentId) {
        quickChargePaymentIntentIdRef.current = nativeResult.paymentIntentId;
      }
      logCollectionEvent(nativeResult.status === 'succeeded' ? 'native_collect.success' : 'native_collect.error', { sessionId, result: nativeResult });
      logCollectionEvent(nativeResult.status === 'succeeded' ? 'native_process.success' : 'native_process.error', {
        sessionId,
        status: nativeResult.status,
        code: nativeResult.code || null,
      });

      if (nativeResult.status !== 'succeeded') {
        const category = classifyNativeFailure(nativeResult);
        const nativeResultDetail = nativeResult.detail && typeof nativeResult.detail === 'object' ? (nativeResult.detail as Record<string, unknown>) : null;
        logCollectionEvent('native_collect_or_process_failed', {
          sessionId,
          category,
          result: nativeResult,
        });

        let verifyRes: Response | null = null;
        let verifyPayload: any = {};
        let verifyRequestError: string | null = null;
        try {
          verifyRes = await fetch('/api/dashboard/internal-settlement/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              flow_run_id: flowRunId,
              outcome:
                category === 'customer_cancelled' || category === 'app_cancelled'
                  ? 'canceled'
                  : category === 'ambiguous_canceled_after_takeover'
                    ? 'needs_reconciliation'
                    : 'failed',
              reason: failureMessageForCategory(category, nativeResult.message),
              failure_code: category,
              source_stage: 'collect_or_process',
              native_result: {
                status: nativeResult.status,
                code: nativeResult.code || null,
                message: nativeResult.message || null,
                terminal_code: nativeResultDetail?.terminalCode ?? null,
                native_stage: nativeResult.nativeStage || nativeResultDetail?.nativeStage || null,
                stripe_takeover_active: (nativeResult as { stripeTakeoverActive?: unknown }).stripeTakeoverActive === true,
                app_backgrounded: (nativeResult as { appBackgrounded?: unknown }).appBackgrounded === true,
                definitive_customer_cancel_signal:
                  (nativeResult as { definitiveCustomerCancelSignal?: unknown }).definitiveCustomerCancelSignal === true,
                payment_intent_id: nativeResult.paymentIntentId || null,
                payment_intent_status: nativeResult.paymentIntentStatus || null,
                payment_intent_source: nativeResult.paymentIntentSource || null,
              },
            }),
          });
          verifyPayload = await verifyRes.json().catch(() => ({}));
        } catch (verifyError: any) {
          verifyRequestError = verifyError?.message || 'verification_request_failed';
        }

        const verifiedState = verifyPayload?.session?.state
          ? String(verifyPayload.session.state)
          : verifyRequestError
            ? 'verification_unavailable'
            : '';
        const verifiedReason = verifyPayload?.session?.failure_message
          ? String(verifyPayload.session.failure_message)
          : verifyPayload?.verification?.resolvedReason
            ? String(verifyPayload.verification.resolvedReason)
            : verifyRequestError
              ? `Server verification unavailable: ${verifyRequestError}`
              : failureMessageForCategory(category, nativeResult.message);

        logCollectionEvent('server_verification_result_from_stripe_before_final_db_write', {
          sessionId,
          ok: verifyRes?.ok === true,
          verifiedState: verifiedState || null,
          verifiedReason,
          correctedByVerification: verifyPayload?.verification?.correctedByVerification === true,
          decisionMode: verifyPayload?.verification?.decisionMode || null,
          verifyRequestError,
          nativeResult,
        });
        logQuickChargeSequenceEvent('quick_charge_server_verify_result', {
          sessionId,
          flowRunId,
          paymentIntentId: nativeResult.paymentIntentId || null,
          paymentIntentStatus: verifyPayload?.verification?.stripePaymentIntentStatus || nativeResult.paymentIntentStatus || null,
          verificationDecisionMode: verifyPayload?.verification?.decisionMode || null,
          correctedByVerification: verifyPayload?.verification?.correctedByVerification === true,
        });
        if (mode === 'quick_charge') {
          setQuickChargeRawServerVerificationPayload(
            verifyPayload && typeof verifyPayload === 'object' ? (verifyPayload as Record<string, unknown>) : null
          );
          const nativeDetail = nativeResult.detail && typeof nativeResult.detail === 'object' ? (nativeResult.detail as Record<string, unknown>) : null;
          const runtimeDebuggable =
            typeof nativeTraceSnapshot?.runtimeDebuggable === 'boolean'
              ? nativeTraceSnapshot.runtimeDebuggable
              : typeof nativeDetail?.runtimeDebuggable === 'boolean'
                ? nativeDetail.runtimeDebuggable
                : null;
          const rawProcessCallbackPayload =
            nativeTraceSnapshot?.rawProcessCallbackPayload && typeof nativeTraceSnapshot.rawProcessCallbackPayload === 'object'
              ? (nativeTraceSnapshot.rawProcessCallbackPayload as Record<string, unknown>)
              : nativeResult.detail && typeof nativeResult.detail === 'object'
                ? (nativeResult.detail as Record<string, unknown>)
                : null;
          const failureSnapshot: QuickChargeFailureSnapshot = {
            mode: 'quick_charge',
            runtimeDebuggable,
            paymentIntentId: nativeResult.paymentIntentId || (typeof nativeTraceSnapshot?.paymentIntentId === 'string' ? nativeTraceSnapshot.paymentIntentId : null),
            retrieveSucceeded: typeof nativeTraceSnapshot?.retrieveSucceeded === 'boolean' ? nativeTraceSnapshot.retrieveSucceeded : null,
            collectInvoked: typeof nativeTraceSnapshot?.collectInvoked === 'boolean' ? nativeTraceSnapshot.collectInvoked : null,
            collectCallbackStatus: typeof nativeTraceSnapshot?.collectCallbackStatus === 'string' ? nativeTraceSnapshot.collectCallbackStatus : null,
            collectReturnedUpdatedIntent:
              typeof nativeTraceSnapshot?.collectReturnedUpdatedIntent === 'boolean' ? nativeTraceSnapshot.collectReturnedUpdatedIntent : null,
            collectReturnedPaymentMethodAttached:
              typeof nativeTraceSnapshot?.collectReturnedPaymentMethodAttached === 'string' ? nativeTraceSnapshot.collectReturnedPaymentMethodAttached : null,
            processInvoked: typeof nativeTraceSnapshot?.processInvoked === 'boolean' ? nativeTraceSnapshot.processInvoked : null,
            processCallbackStatus: typeof nativeTraceSnapshot?.processCallbackStatus === 'string' ? nativeTraceSnapshot.processCallbackStatus : null,
            processFailureCode: typeof nativeTraceSnapshot?.processFailureCode === 'string' ? nativeTraceSnapshot.processFailureCode : null,
            processFailureMessage: typeof nativeTraceSnapshot?.processFailureMessage === 'string' ? nativeTraceSnapshot.processFailureMessage : null,
            processFailureExceptionClass:
              typeof nativeTraceSnapshot?.processFailureExceptionClass === 'string' ? nativeTraceSnapshot.processFailureExceptionClass : null,
            processFailureReasonCategory:
              typeof nativeTraceSnapshot?.processFailureReasonCategory === 'string' ? nativeTraceSnapshot.processFailureReasonCategory : null,
            rawProcessCallbackPayload,
            processFailureStackTop:
              typeof nativeTraceSnapshot?.processFailureStackTop === 'string'
                ? nativeTraceSnapshot.processFailureStackTop
                : typeof (nativeResult.detail as { stackTop?: unknown })?.stackTop === 'string'
                  ? String((nativeResult.detail as { stackTop?: string }).stackTop)
                  : null,
            processFailureDetailReason:
              typeof nativeTraceSnapshot?.processFailureDetailReason === 'string'
                ? nativeTraceSnapshot.processFailureDetailReason
                : typeof (nativeResult.detail as { reason?: unknown })?.reason === 'string'
                  ? String((nativeResult.detail as { reason?: string }).reason)
                  : null,
            processFailureTerminalCode:
              typeof nativeTraceSnapshot?.processFailureTerminalCode === 'string'
                ? nativeTraceSnapshot.processFailureTerminalCode
                : typeof nativeDetail?.terminalCode === 'string'
                  ? String(nativeDetail.terminalCode)
                  : null,
            processFailureNativeStage:
              typeof nativeTraceSnapshot?.processFailureNativeStage === 'string'
                ? nativeTraceSnapshot.processFailureNativeStage
                : typeof nativeResult.nativeStage === 'string'
                  ? nativeResult.nativeStage
                  : typeof nativeDetail?.nativeStage === 'string'
                    ? String(nativeDetail.nativeStage)
                    : null,
            pluginInFlight: typeof nativeTraceSnapshot?.pluginInFlight === 'boolean' ? nativeTraceSnapshot.pluginInFlight : null,
            pluginStatus: typeof nativeTraceSnapshot?.pluginStatus === 'string' ? nativeTraceSnapshot.pluginStatus : null,
            stripeTakeoverObserved:
              typeof nativeTraceSnapshot?.stripeTakeoverObserved === 'boolean'
                ? nativeTraceSnapshot.stripeTakeoverObserved
                : (nativeResult as { stripeTakeoverActive?: unknown }).stripeTakeoverActive === true,
            backgroundInterruptionCandidate:
              typeof nativeTraceSnapshot?.backgroundInterruptionCandidate === 'boolean' ? nativeTraceSnapshot.backgroundInterruptionCandidate : null,
            confirmedBackgroundInterruption:
              typeof nativeTraceSnapshot?.confirmedBackgroundInterruption === 'boolean' ? nativeTraceSnapshot.confirmedBackgroundInterruption : null,
            lifecyclePausedDuringActiveFlow:
              typeof nativeTraceSnapshot?.lifecyclePausedDuringActiveFlow === 'boolean' ? nativeTraceSnapshot.lifecyclePausedDuringActiveFlow : null,
            lastPauseAtMs: typeof nativeTraceSnapshot?.lastPauseAtMs === 'number' ? nativeTraceSnapshot.lastPauseAtMs : null,
            lastStopAtMs: typeof nativeTraceSnapshot?.lastStopAtMs === 'number' ? nativeTraceSnapshot.lastStopAtMs : null,
            lastResumeAtMs: typeof nativeTraceSnapshot?.lastResumeAtMs === 'number' ? nativeTraceSnapshot.lastResumeAtMs : null,
            lastLifecycleEvents:
              Array.isArray(nativeTraceSnapshot?.lastLifecycleEvents) && nativeTraceSnapshot.lastLifecycleEvents.every((event) => typeof event === 'string')
                ? (nativeTraceSnapshot.lastLifecycleEvents as string[])
                : null,
            hostActivityRequestedOrientation:
              typeof nativeTraceSnapshot?.hostActivityRequestedOrientation === 'string' ? nativeTraceSnapshot.hostActivityRequestedOrientation : null,
            hostActivityCurrentOrientation:
              typeof nativeTraceSnapshot?.hostActivityCurrentOrientation === 'string' ? nativeTraceSnapshot.hostActivityCurrentOrientation : null,
            hostActivityChangingConfigurations:
              typeof nativeTraceSnapshot?.hostActivityChangingConfigurations === 'boolean'
                ? nativeTraceSnapshot.hostActivityChangingConfigurations
                : null,
            hostActivityWindowFocus: typeof nativeTraceSnapshot?.hostActivityWindowFocus === 'boolean' ? nativeTraceSnapshot.hostActivityWindowFocus : null,
            hostActivityWasPaused: typeof nativeTraceSnapshot?.hostActivityWasPaused === 'boolean' ? nativeTraceSnapshot.hostActivityWasPaused : null,
            hostActivityWasStopped: typeof nativeTraceSnapshot?.hostActivityWasStopped === 'boolean' ? nativeTraceSnapshot.hostActivityWasStopped : null,
            hostActivityWasDestroyed:
              typeof nativeTraceSnapshot?.hostActivityWasDestroyed === 'boolean' ? nativeTraceSnapshot.hostActivityWasDestroyed : null,
            appInBackgroundAtFailure:
              typeof nativeTraceSnapshot?.appInBackgroundAtFailure === 'boolean'
                ? nativeTraceSnapshot.appInBackgroundAtFailure
                : (nativeResult as { appBackgrounded?: unknown }).appBackgrounded === true,
            immersiveModeActive: typeof nativeTraceSnapshot?.immersiveModeActive === 'boolean' ? nativeTraceSnapshot.immersiveModeActive : null,
            immersiveReappliedDuringPayment:
              typeof nativeTraceSnapshot?.immersiveReappliedDuringPayment === 'boolean'
                ? nativeTraceSnapshot.immersiveReappliedDuringPayment
                : null,
            orientationChangedDuringPayment:
              typeof nativeTraceSnapshot?.orientationChangedDuringPayment === 'boolean'
                ? nativeTraceSnapshot.orientationChangedDuringPayment
                : null,
            windowFocusChangedDuringPayment:
              typeof nativeTraceSnapshot?.windowFocusChangedDuringPayment === 'boolean'
                ? nativeTraceSnapshot.windowFocusChangedDuringPayment
                : null,
            processDeferredForForegroundFocus:
              typeof nativeTraceSnapshot?.processDeferredForForegroundFocus === 'boolean'
                ? nativeTraceSnapshot.processDeferredForForegroundFocus
                : null,
            timedEventTrail:
              Array.isArray(nativeTraceSnapshot?.timedEventTrail) && nativeTraceSnapshot.timedEventTrail.every((event) => typeof event === 'string')
                ? (nativeTraceSnapshot.timedEventTrail as string[])
                : null,
            appResumedDuringProcessInFlight:
              typeof nativeTraceSnapshot?.appResumedDuringProcessInFlight === 'boolean'
                ? nativeTraceSnapshot.appResumedDuringProcessInFlight
                : typeof (nativeResult as { appResumedDuringProcessInFlight?: unknown }).appResumedDuringProcessInFlight === 'boolean'
                  ? Boolean((nativeResult as { appResumedDuringProcessInFlight?: unknown }).appResumedDuringProcessInFlight)
                  : null,
            nativeFailurePoint:
              (typeof nativeTraceSnapshot?.nativeFailurePoint === 'string' && nativeTraceSnapshot.nativeFailurePoint) || nativeResult.nativeStage || null,
            finalServerVerifiedStatus: verifiedState || null,
            finalFailureReason:
              verifiedReason ||
              (typeof nativeTraceSnapshot?.finalFailureReason === 'string' ? nativeTraceSnapshot.finalFailureReason : null) ||
              nativeResult.message ||
              null,
          };
          setQuickChargeFailureSnapshot(failureSnapshot);
          console.info('[internal-settlement][quick-charge][failure-snapshot]', {
            sessionId,
            flowRunId,
            ...failureSnapshot,
          });
        }

        if (verifyRes?.ok === true && verifiedState === 'finalized') {
          if (mode === 'quick_charge') {
            quickChargeAttemptEndMsRef.current = Date.now();
          }
          setState('completed');
          setMessage(mode === 'order_payment' ? 'Order payment collected successfully.' : 'Quick charge collected successfully.');
          setActiveSessionId(null);
          setActiveTerminalLocationId(null);
          internalSettlementActiveRunStore.clear();
          await loadOrders();
          return;
        }

        setState(isUnsupportedDeviceError(nativeResult.code) ? 'unsupported_device' : 'failed');
        if (mode === 'quick_charge') {
          quickChargeAttemptEndMsRef.current = Date.now();
        }
        setMessage(verifiedReason);
        logCollectionEvent('final_persisted_outcome_and_reason', {
          sessionId,
          state: verifiedState || null,
          reason: verifiedReason,
          outcomeSource: verifyPayload?.verification?.correctedByVerification ? 'verification_corrected' : 'immediate_native_or_fallback',
        });
        logQuickChargeSequenceEvent('quick_charge_final_failure_reason', {
          sessionId,
          flowRunId,
          paymentIntentId: nativeResult.paymentIntentId || null,
          paymentIntentStatus: verifyPayload?.verification?.stripePaymentIntentStatus || nativeResult.paymentIntentStatus || null,
          failureReason: verifiedReason,
          finalState: verifiedState || null,
          verifyRequestError,
        });
        setActiveSessionId(null);
        setActiveTerminalLocationId(null);
        internalSettlementActiveRunStore.clear();
        return;
      }

      if (mode === 'quick_charge') {
        const paymentStatusWaitingForInputCountBeforeCollectSuccess =
          typeof nativeTraceSnapshot?.paymentStatusWaitingForInputCountBeforeCollectSuccess === 'number'
            ? nativeTraceSnapshot.paymentStatusWaitingForInputCountBeforeCollectSuccess
            : null;
        const paymentStatusProcessingCountBeforeCollectSuccess =
          typeof nativeTraceSnapshot?.paymentStatusProcessingCountBeforeCollectSuccess === 'number'
            ? nativeTraceSnapshot.paymentStatusProcessingCountBeforeCollectSuccess
            : null;
        const paymentStatusReadyCountBeforeCollectSuccess =
          typeof nativeTraceSnapshot?.paymentStatusReadyCountBeforeCollectSuccess === 'number'
            ? nativeTraceSnapshot.paymentStatusReadyCountBeforeCollectSuccess
            : null;
        const paymentStatusTrailBeforeCollectSuccess =
          Array.isArray(nativeTraceSnapshot?.paymentStatusTrailBeforeCollectSuccess) &&
          nativeTraceSnapshot.paymentStatusTrailBeforeCollectSuccess.every((event) => typeof event === 'string')
            ? (nativeTraceSnapshot.paymentStatusTrailBeforeCollectSuccess as string[])
            : null;
        const repeatedWaitingForInputBeforeCollectSuccess =
          paymentStatusWaitingForInputCountBeforeCollectSuccess != null
            ? paymentStatusWaitingForInputCountBeforeCollectSuccess > 1
            : null;
        const repeatedReadyBeforeCollectSuccess =
          paymentStatusReadyCountBeforeCollectSuccess != null ? paymentStatusReadyCountBeforeCollectSuccess > 1 : null;
        const repeatedProcessingBeforeCollectSuccess =
          paymentStatusProcessingCountBeforeCollectSuccess != null
            ? paymentStatusProcessingCountBeforeCollectSuccess > 1
            : null;
        const nativeStatusBouncedBackToInputWaitingBeforeCollectSuccess =
          repeatedWaitingForInputBeforeCollectSuccess === null
            ? null
            : repeatedWaitingForInputBeforeCollectSuccess && (paymentStatusReadyCountBeforeCollectSuccess ?? 0) > 0;
        const successSnapshot: QuickChargeSuccessSnapshot = {
          mode: 'quick_charge',
          paymentIntentId:
            nativeResult.paymentIntentId ||
            (typeof nativeTraceSnapshot?.paymentIntentId === 'string' ? nativeTraceSnapshot.paymentIntentId : null),
          retrieveCallbackCount: typeof nativeTraceSnapshot?.retrieveCallbackCount === 'number' ? nativeTraceSnapshot.retrieveCallbackCount : null,
          collectSuccessCallbackCount:
            typeof nativeTraceSnapshot?.collectSuccessCallbackCount === 'number' ? nativeTraceSnapshot.collectSuccessCallbackCount : null,
          collectFailureCallbackCount:
            typeof nativeTraceSnapshot?.collectFailureCallbackCount === 'number' ? nativeTraceSnapshot.collectFailureCallbackCount : null,
          processInvocationCount: typeof nativeTraceSnapshot?.processInvocationCount === 'number' ? nativeTraceSnapshot.processInvocationCount : null,
          processSuccessCallbackCount:
            typeof nativeTraceSnapshot?.processSuccessCallbackCount === 'number' ? nativeTraceSnapshot.processSuccessCallbackCount : null,
          processFailureCallbackCount:
            typeof nativeTraceSnapshot?.processFailureCallbackCount === 'number' ? nativeTraceSnapshot.processFailureCallbackCount : null,
          processCallbackCount: typeof nativeTraceSnapshot?.processCallbackCount === 'number' ? nativeTraceSnapshot.processCallbackCount : null,
          retrievedPaymentIntentId:
            typeof nativeTraceSnapshot?.retrievedPaymentIntentId === 'string' ? nativeTraceSnapshot.retrievedPaymentIntentId : null,
          lastCollectCallbackPaymentIntentId:
            typeof nativeTraceSnapshot?.lastCollectCallbackPaymentIntentId === 'string' ? nativeTraceSnapshot.lastCollectCallbackPaymentIntentId : null,
          lastProcessCallbackPaymentIntentId:
            typeof nativeTraceSnapshot?.lastProcessCallbackPaymentIntentId === 'string' ? nativeTraceSnapshot.lastProcessCallbackPaymentIntentId : null,
          samePaymentIntentIdAcrossRetrieveCollectProcess:
            typeof nativeTraceSnapshot?.samePaymentIntentIdAcrossRetrieveCollectProcess === 'boolean'
              ? nativeTraceSnapshot.samePaymentIntentIdAcrossRetrieveCollectProcess
              : null,
          collectIntentReferenceChanged:
            typeof nativeTraceSnapshot?.collectIntentReferenceChanged === 'boolean' ? nativeTraceSnapshot.collectIntentReferenceChanged : null,
          intermediateCallbackObserved:
            typeof nativeTraceSnapshot?.intermediateCallbackObserved === 'boolean' ? nativeTraceSnapshot.intermediateCallbackObserved : null,
          repeatedCollectSignalDetected:
            typeof nativeTraceSnapshot?.repeatedCollectSignalDetected === 'boolean' ? nativeTraceSnapshot.repeatedCollectSignalDetected : null,
          suspectedSecondPresentment:
            typeof nativeTraceSnapshot?.suspectedSecondPresentment === 'boolean' ? nativeTraceSnapshot.suspectedSecondPresentment : null,
          paymentStatusChangeCountBeforeCollectSuccess:
            typeof nativeTraceSnapshot?.paymentStatusChangeCountBeforeCollectSuccess === 'number'
              ? nativeTraceSnapshot.paymentStatusChangeCountBeforeCollectSuccess
              : null,
          paymentStatusWaitingForInputCountBeforeCollectSuccess,
          paymentStatusProcessingCountBeforeCollectSuccess,
          paymentStatusReadyCountBeforeCollectSuccess,
          paymentStatusTrailBeforeCollectSuccess,
          repeatedWaitingForInputBeforeCollectSuccess,
          repeatedReadyBeforeCollectSuccess,
          repeatedProcessingBeforeCollectSuccess,
          nativeStatusBouncedBackToInputWaitingBeforeCollectSuccess,
          timedEventTrail:
            Array.isArray(nativeTraceSnapshot?.timedEventTrail) && nativeTraceSnapshot.timedEventTrail.every((event) => typeof event === 'string')
              ? (nativeTraceSnapshot.timedEventTrail as string[])
              : null,
        };
        setQuickChargeSuccessSnapshot(successSnapshot);
      }

      setState('processing');
      setMessage('Finalizing settlement…');
      setState('finalizing');
      logCollectionEvent('finalize.start', { sessionId });

      const finalizeRes = await fetch('/api/dashboard/internal-settlement/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, flow_run_id: flowRunId }),
      });
      const finalizePayload = await finalizeRes.json().catch(() => ({}));
      if (mode === 'quick_charge') {
        setQuickChargeRawServerVerificationPayload(
          finalizePayload && typeof finalizePayload === 'object' ? (finalizePayload as Record<string, unknown>) : null
        );
      }
      if (!finalizeRes.ok) {
        logCollectionEvent('finalize.error', { sessionId, httpStatus: finalizeRes.status, message: finalizePayload?.message || null });
        throw new Error(finalizePayload?.message || `Failed to finalize settlement (${finalizeRes.status})`);
      }
      logCollectionEvent('server_finalize_called', { sessionId, ok: finalizeRes.ok });
      logCollectionEvent('finalize.success', { sessionId, ok: finalizeRes.ok });

      setState('completed');
      if (mode === 'quick_charge') {
        quickChargeAttemptEndMsRef.current = Date.now();
      }
      setMessage(mode === 'order_payment' ? 'Order payment collected successfully.' : 'Quick charge collected successfully.');
      setQuickChargeFailureSnapshot(null);
      setActiveSessionId(null);
      setActiveTerminalLocationId(null);
      internalSettlementActiveRunStore.clear();

      if (mode === 'quick_charge') {
        setQuickAmount('0.00');
        setQuickNote('');
        setQuickReference('');
      }

      await loadOrders();
    } catch (error: any) {
      logCollectionEvent('collection_exception', { message: error?.message || 'unknown_exception' });
      let nativeRunStillActive = false;
      let nativeRunStatus: string | null = null;
      if (sessionIdForCleanup) {
        try {
          const nativeState = await tapToPayBridge.getActivePaymentRunState();
          nativeRunStillActive = nativeState.activeRun === true || nativeState.inFlight === true;
          nativeRunStatus = typeof nativeState.status === 'string' ? nativeState.status : null;
          logCollectionEvent('collection_exception_native_state_check', {
            sessionId: sessionIdForCleanup,
            activeRun: nativeState.activeRun,
            inFlight: nativeState.inFlight,
            status: nativeState.status,
          });
        } catch {
          nativeRunStillActive = false;
        }
      }
      if (nativeRunStillActive) {
        keepFlowActiveAfterError = true;
        const processingInFlight = nativeRunStatus === 'processing';
        setState(processingInFlight ? 'processing' : 'collecting');
        setMessage(
          processingInFlight
            ? 'Tap to Pay is still processing on device. Waiting for native process callback…'
            : 'Tap to Pay remains active on device. Waiting for native completion callback…'
        );
        return;
      }
      setState('failed');
      if (mode === 'quick_charge') {
        quickChargeAttemptEndMsRef.current = Date.now();
      }
      setMessage(error?.message || 'Payment failed.');
      if (sessionIdForCleanup) {
        await persistFlowOutcome({
          sessionId: sessionIdForCleanup,
          outcome: 'failed',
          reason: `Flow exception before finalize: ${error?.message || 'unknown_exception'}`,
          failureCode: 'flow_exception',
        });
      }
      setActiveSessionId(null);
      setActiveTerminalLocationId(null);
    } finally {
      if (keepFlowActiveAfterError) {
        setBusy(true);
        flowActiveRef.current = true;
      } else {
        setBusy(false);
        flowActiveRef.current = false;
        flowRunIdRef.current = null;
      }
    }
  }, [
    classifyNativeFailure,
    failureMessageForCategory,
    amountCents,
    busy,
    logCollectionEvent,
    loadOrders,
    mode,
    nativeRestaurantId,
    quickNote,
    quickReference,
    refreshNativeReadiness,
    selectedOrderId,
    tapAvailabilityReady,
    tapAvailabilityReason,
  ]);



  useEffect(() => {
    if (!nativeRestaurantId) return;
    const recover = async (source: 'mount' | 'resume') => {
      if (source === 'resume' && flowActiveRef.current) {
        logCollectionEvent('app_resume_recovery_skipped_local_active_run', { source });
        return;
      }
      const activeRun = internalSettlementActiveRunStore.get();
      const nativeState = await tapToPayBridge.getActivePaymentRunState();
      if (source === 'resume' && nativeState.inFlight === true && nativeState.status === 'processing') {
        logCollectionEvent('app_resume_recovery_skipped_process_in_flight', {
          source,
          nativeStatus: nativeState.status,
          nativeActiveRun: nativeState.activeRun,
          nativeInFlight: nativeState.inFlight,
        });
        return;
      }
      if (source === 'resume' && flowActiveRef.current) {
        logCollectionEvent('app_resume_recovery_skipped_after_native_check', {
          source,
          nativeActiveRun: nativeState.activeRun,
          nativeInFlight: nativeState.inFlight,
        });
        return;
      }
      if (nativeState.activeRun && activeRun?.sessionId) {
        const processingInFlight = nativeState.status === 'processing';
        logCollectionEvent('app_resume_rehydrated_active_run', {
          source,
          sessionId: activeRun.sessionId,
          nativeStatus: nativeState.status,
          nativeFlowRunId: nativeState.flowRunId || null,
          processStageInFlight: processingInFlight,
        });
        setBusy(true);
        flowActiveRef.current = true;
        setActiveSessionId(activeRun.sessionId);
        setActiveTerminalLocationId(activeRun.terminalLocationId);
        setState(processingInFlight ? 'processing' : 'collecting');
        setMessage(
          processingInFlight
            ? 'Rehydrated active Tap to Pay run while processPaymentIntent is in progress.'
            : 'Rehydrated active Tap to Pay run after resume.'
        );
      }
      const cached = (nativeState.cachedFinalResult as Record<string, unknown> | undefined) || null;
      if (cached && activeRun?.sessionId) {
        logCollectionEvent('ui_recovered_final_result', { sessionId: activeRun.sessionId, cachedStatus: cached.status || null });
      }
    };
    void recover('mount');
    const onResume = () => {
      if (document.visibilityState !== 'visible') return;
      void recover('resume');
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [logCollectionEvent, nativeRestaurantId]);

  const handleCancel = useCallback(async () => {
    if (!activeSessionId) return;
    setBusy(true);
    try {
      await tapToPayBridge.cancelTapToPayPayment().catch(() => undefined);
      await fetch('/api/dashboard/internal-settlement/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSessionId,
          outcome: 'canceled',
          reason: 'Canceled by app operator',
          failure_code: 'app_cancelled',
          flow_run_id: flowRunIdRef.current,
        }),
      });
      logCollectionEvent('app_cancel_requested', { sessionId: activeSessionId });
      setState('failed');
      quickChargeAttemptEndMsRef.current = Date.now();
      setMessage('Payment canceled.');
      setQuickChargeFailureSnapshot(null);
      setQuickChargeSuccessSnapshot(null);
      setQuickChargeRawNativePayload(null);
      setQuickChargeRawServerVerificationPayload(null);
      setActiveSessionId(null);
      setActiveTerminalLocationId(null);
      internalSettlementActiveRunStore.clear();
      await loadOrders();
    } finally {
      setBusy(false);
      flowActiveRef.current = false;
      flowRunIdRef.current = null;
    }
  }, [activeSessionId, loadOrders, logCollectionEvent]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>

      <div className="mt-6 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('order_payment')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            mode === 'order_payment' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Order payment
        </button>
        <button
          type="button"
          onClick={() => setMode('quick_charge')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            mode === 'quick_charge' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Quick charge
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Amount</h2>
          {mode === 'order_payment' ? (
            <>
              <label className="block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Unpaid order</label>
              <select
                value={selectedOrderId}
                onChange={(event) => setSelectedOrderId(event.target.value)}
                disabled={loadingOrders || busy}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {orders.length === 0 ? <option value="">No unpaid orders</option> : null}
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{order.short_order_number ?? '—'} · {order.customer_name || 'Guest'} · {formatPrice(Number(order.total_price || 0) / 100)}
                  </option>
                ))}
              </select>
              {loadingOrders ? <p className="text-xs text-slate-500">Loading unpaid orders…</p> : null}
              {!loadingOrders && orders.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  No unpaid pending/prepared orders are ready for collection right now.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <label className="block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Custom amount ({toCurrencyCode('gbp')})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={quickAmount}
                onChange={(event) => setQuickAmount(event.target.value)}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={quickReference}
                onChange={(event) => setQuickReference(event.target.value)}
                disabled={busy}
                placeholder="Reference (optional)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <textarea
                value={quickNote}
                onChange={(event) => setQuickNote(event.target.value)}
                disabled={busy}
                placeholder="Note (optional)"
                className="min-h-[84px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </>
          )}
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Amount to collect</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{amountLabel}</p>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Payment method</h2>
          <p className="text-sm text-slate-600">Contactless card-present via Tap to Pay</p>
          {tapAvailabilityLoading ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Checking Tap to Pay availability…
            </p>
          ) : null}
          {!tapAvailabilityLoading && !tapAvailabilityReady ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Tap to Pay unavailable: {tapAvailabilityReason || 'Tap to Pay is not ready on this account/device.'}
            </p>
          ) : null}
          {nativeReadinessLoading ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Checking device Tap to Pay prerequisites…
            </p>
          ) : null}
          {!nativeReadinessLoading && !nativeReadinessReady ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Device setup required:{' '}
              {nativeReadinessReason || 'Location permission and location services are required.'}
            </p>
          ) : null}

          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              state === 'completed'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : state === 'failed' || state === 'permission_denied'
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : state === 'unsupported_device' || state === 'location_services_disabled' || state === 'setup_failed' || state === 'interrupted'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <p className="font-semibold">Collection state: {state.replace('_', ' ')}</p>
            <p className="mt-1 text-xs">{message}</p>
            {quickChargeAttemptDiagnosticsSerialized ? (
              <div
                className={`mt-3 rounded-xl border bg-white/90 p-3 text-[11px] ${
                  state === 'completed' ? 'border-emerald-300 text-emerald-900' : 'border-rose-300 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold uppercase tracking-[0.08em]">
                    Tap to Pay {state === 'completed' ? 'success' : 'failure'} diagnostics
                  </p>
                  <button
                    type="button"
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                      state === 'completed'
                        ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border border-rose-300 bg-rose-50 text-rose-800'
                    }`}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(quickChargeAttemptDiagnosticsSerialized);
                      } catch {
                        // no-op: snapshot remains visible on screen for manual copy.
                      }
                    }}
                  >
                    Copy
                  </button>
                </div>
                <pre
                  className={`mt-2 whitespace-pre-wrap break-all rounded-md p-2 font-mono text-[10px] leading-4 ${
                    state === 'completed' ? 'bg-emerald-50' : 'bg-rose-50'
                  }`}
                >
                  {quickChargeAttemptDiagnosticsSerialized}
                </pre>
              </div>
            ) : null}
            {activeSessionId ? <p className="mt-2 text-[11px] text-slate-500">Session: {activeSessionId}</p> : null}
            {activeTerminalLocationId ? (
              <p className="mt-1 text-[11px] text-slate-500">Terminal location: {activeTerminalLocationId}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={
                busy ||
                tapAvailabilityLoading ||
                nativeReadinessLoading ||
                !tapAvailabilityReady ||
                amountCents <= 0 ||
                (mode === 'order_payment' && !selectedOrderId)
              }
              onClick={handleCollectContactless}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? 'Collecting…' : state === 'setup_failed' ? 'Resolve setup & collect' : 'Collect contactless'}
            </button>
            <button
              type="button"
              disabled={busy || !activeSessionId}
              onClick={handleCancel}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel session
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
