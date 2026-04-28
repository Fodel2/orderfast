import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeftIcon, BackspaceIcon, ClipboardDocumentListIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { tapToPayBridge } from '@/lib/kiosk/tapToPayBridge';
import { formatPrice } from '@/lib/orderDisplay';
import { resolveNativeTapToPayReadiness } from '@/lib/kiosk/tapToPayNativeReadiness';
import { type AppFlowState } from '@/lib/app/launcherBootstrap';
import { internalSettlementActiveRunStore } from '@/lib/payments/internalSettlementActiveRunStore';
import { buildCombinedTapToPayDiagnosticsPayload } from '@/lib/payments/tapToPayDiagnostics';
import {
  resolveContactlessEligibility,
  resolveContactlessPresentation,
  type ContactlessEligibilityResult,
} from '@/lib/payments/contactlessEligibility';
import { resolveStaffTapToPayAvailability } from '@/lib/payments/staffTapToPayAvailability';
import NativeTapToPayPreHandoverOverlay from '@/components/payments/NativeTapToPayPreHandoverOverlay';
import {
  canCloseNativeTapToPayPreHandoverOverlay,
  isNativeTapToPayOverlayVisiblePhase,
  normalizeNativeTapToPayState,
  POST_HANDOVER_PROGRESS_LINES,
  PRE_HANDOVER_PROGRESS_LINES,
  resolveNativeTapToPayUiPhase,
} from '@/lib/payments/nativeTapToPayUiPhases';

type SettlementMode = 'order_payment' | 'quick_charge';
type CollectionState = AppFlowState | 'idle' | 'handover' | 'canceled';
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
  total_price_cents?: number | null;
  created_at: string;
};

const toCurrencyCode = (value?: string | null) => (value || 'GBP').toUpperCase();

const makeIdempotencyKey = (prefix: string) => `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
const QUICK_CHARGE_MINIMUM_CENTS = 50;
const QUICK_CHIPS = [500, 1000, 2000, 5000];

const formatAmountFromCents = (cents: number) => {
  const resolved = Number.isFinite(cents) ? Math.max(0, Math.floor(cents)) : 0;
  const pounds = Math.floor(resolved / 100);
  const pennies = String(resolved % 100).padStart(2, '0');
  return `${pounds}.${pennies}`;
};

type InternalSettlementModuleProps = {
  title?: string;
  eyebrow?: string;
  restaurantId?: string | null;
  onFlowActivityChange?: (active: boolean) => void;
  entryPoint?: 'pos' | 'take_payment';
  source?: 'pos' | 'launcher';
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
  entryPoint = 'take_payment',
  source = 'pos',
}: InternalSettlementModuleProps) {
  const router = useRouter();
  const [mode, setMode] = useState<SettlementMode>('quick_charge');
  const [orders, setOrders] = useState<UnpaidOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [tapAvailabilityLoading, setTapAvailabilityLoading] = useState(true);
  const [tapAvailabilityReady, setTapAvailabilityReady] = useState(false);
  const [tapAvailabilityReason, setTapAvailabilityReason] = useState('');
  const [contactlessEligibility, setContactlessEligibility] = useState<ContactlessEligibilityResult | null>(null);
  const [nativeReadinessLoading, setNativeReadinessLoading] = useState(false);
  const [nativeReadinessReady, setNativeReadinessReady] = useState(false);
  const [nativeReadinessReason, setNativeReadinessReason] = useState('');

  const [quickAmountDigits, setQuickAmountDigits] = useState('0');
  const [showOrdersSheet, setShowOrdersSheet] = useState(false);

  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<CollectionState>('idle');
  const [message, setMessage] = useState('Ready to collect payment.');
  const [quickChargeFailureSnapshot, setQuickChargeFailureSnapshot] = useState<QuickChargeFailureSnapshot | null>(null);
  const [quickChargeSuccessSnapshot, setQuickChargeSuccessSnapshot] = useState<QuickChargeSuccessSnapshot | null>(null);
  const [quickChargeRawNativePayload, setQuickChargeRawNativePayload] = useState<Record<string, unknown> | null>(null);
  const [quickChargeRawServerVerificationPayload, setQuickChargeRawServerVerificationPayload] = useState<Record<string, unknown> | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTerminalLocationId, setActiveTerminalLocationId] = useState<string | null>(null);
  const [overlayMessageIndex, setOverlayMessageIndex] = useState(0);
  const [cancelInFlight, setCancelInFlight] = useState(false);
  const [showSuccessTick, setShowSuccessTick] = useState(false);
  const [terminalVisualState, setTerminalVisualState] = useState<'success' | 'canceled' | 'failed' | null>(null);
  const [preHandoverOverlayOwned, setPreHandoverOverlayOwned] = useState(false);
  const successRouteCommittedRef = useRef(false);
  const flowActiveRef = useRef(false);
  const flowRunIdRef = useRef<string | null>(null);
  const handoverOwnerRef = useRef<{ flowRunId: string; active: boolean; cancelRequested: boolean } | null>(null);
  const cancelBarrierRef = useRef<{ flowRunId: string; requestedAt: number } | null>(null);
  const suppressRecoveryRef = useRef<{ reason: 'canceled' | 'failed'; at: number } | null>(null);
  const deadRunFlowIdsRef = useRef<Set<string>>(new Set());
  const deadRunLockRef = useRef<{ flowRunId: string | null; reason: 'canceled'; at: number } | null>(null);
  const successAuthorityRef = useRef<{ flowRunId: string | null; source: string; at: number } | null>(null);
  const overlayPhaseEnteredAtMsRef = useRef<number | null>(null);
  const quickChargeAttemptStartMsRef = useRef<number | null>(null);
  const quickChargeAttemptEndMsRef = useRef<number | null>(null);
  const quickChargeEventSequenceRef = useRef(0);
  const quickChargeUiEventHistoryRef = useRef<Record<string, unknown>[]>([]);
  const quickChargePaymentIntentIdRef = useRef<string | null>(null);

  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) || null, [orders, selectedOrderId]);
  const hasReturnedFromNative = useMemo(
    () =>
      state === 'processing' ||
      state === 'finalizing' ||
      state === 'completed' ||
      state === 'canceled' ||
      state === 'failed' ||
      terminalVisualState === 'canceled' ||
      terminalVisualState === 'failed' ||
      showSuccessTick,
    [showSuccessTick, state, terminalVisualState]
  );
  const uiPhase = useMemo(
    () => resolveNativeTapToPayUiPhase(state, { hasReturnedFromNative }),
    [hasReturnedFromNative, state]
  );
  const showTransitionOverlay = useMemo(() => {
    const showTerminalBeat = terminalVisualState === 'canceled' || terminalVisualState === 'failed';
    const showLoader =
      isNativeTapToPayOverlayVisiblePhase(state, { hasReturnedFromNative }) || showSuccessTick || preHandoverOverlayOwned;
    if (deadRunLockRef.current && showLoader) return showTerminalBeat;
    return showLoader || showTerminalBeat;
  }, [hasReturnedFromNative, preHandoverOverlayOwned, showSuccessTick, state, terminalVisualState]);
  const canCloseOverlay = useMemo(
    () =>
      canCloseNativeTapToPayPreHandoverOverlay({
        state,
        inCancelTransition: cancelInFlight,
        inSuccessTransition: showSuccessTick || terminalVisualState === 'canceled' || terminalVisualState === 'failed',
        preHandoverOverlayOwned,
        hasReturnedFromNative,
      }),
    [cancelInFlight, hasReturnedFromNative, preHandoverOverlayOwned, showSuccessTick, state, terminalVisualState]
  );
  const overlayLines = useMemo(
    () =>
      uiPhase === 'processing_returned_result' || uiPhase === 'verifying_paid_outcome' || uiPhase === 'finalizing_session'
        ? POST_HANDOVER_PROGRESS_LINES
        : PRE_HANDOVER_PROGRESS_LINES,
    [uiPhase]
  );

  const quickAmountCents = useMemo(() => {
    const numeric = Number.parseInt(quickAmountDigits || '0', 10);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return numeric;
  }, [quickAmountDigits]);

  const amountCents = useMemo(() => {
    if (mode === 'order_payment') return Math.max(0, Math.floor(Number(selectedOrder?.total_price_cents || 0)));
    return quickAmountCents;
  }, [mode, quickAmountCents, selectedOrder?.total_price_cents]);

  const amountLabel = useMemo(() => formatPrice(amountCents / 100), [amountCents]);
  const isBelowMinimumAmount = amountCents > 0 && amountCents < QUICK_CHARGE_MINIMUM_CENTS;
  const minimumAmountMessage = `Minimum payment amount is ${formatPrice(QUICK_CHARGE_MINIMUM_CENTS / 100)}.`;
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

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoadingOrders(true);
    try {
      const response = await fetch('/api/dashboard/internal-settlement/unpaid-orders');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
      const nextOrders = Array.isArray(payload?.orders) ? (payload.orders as UnpaidOrder[]) : [];
      setOrders(nextOrders);
      if (selectedOrderId && !nextOrders.some((order) => order.id === selectedOrderId)) {
        setSelectedOrderId('');
        setMode('quick_charge');
      }
    } catch (error: any) {
      setMessage(error?.message || 'Failed to load unpaid orders.');
    } finally {
      if (!silent) setLoadingOrders(false);
    }
  }, [selectedOrderId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadOrders(true);
    }, 10000);
    const onFocus = () => {
      void loadOrders(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void loadOrders(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadOrders]);

  const resolveStaffContactlessAvailability = useCallback(
    async (checkpoint: 'screen_entry' | 'selection' | 'before_native_start') =>
      resolveStaffTapToPayAvailability({
        checkpoint,
        entryPoint,
        source: 'internal_settlement',
      }),
    [entryPoint]
  );

  useEffect(() => {
    let active = true;

    const loadAvailability = async () => {
      setTapAvailabilityLoading(true);
      console.info('[payments][contactless_eligibility]', 'eligibility_checked_at_app_launch', {
        entryPoint,
      });
      try {
        const availability = await resolveStaffContactlessAvailability('screen_entry');
        if (!active) return;
        if (tapAvailabilityReady && !availability.serverAvailable) {
          console.info('[payments][contactless_eligibility]', 'cached_result_rejected_in_favor_of_live_check', {
            entryPoint,
            checkpoint: 'screen_entry',
            cachedAvailable: true,
            liveAvailable: false,
          });
        }
        console.info('[payments][contactless_eligibility]', 'eligibility_checked_at_page_render', {
          entryPoint,
          tapToPayAvailable: availability.serverAvailable,
          reason: availability.serverReason || null,
        });
        setTapAvailabilityReady(availability.serverAvailable);
        setTapAvailabilityReason(availability.serverReason);
        setContactlessEligibility(availability.resolved);
      } catch (error: any) {
        if (!active) return;
        setTapAvailabilityReady(false);
        setTapAvailabilityReason(error?.message || 'Tap to Pay availability could not be confirmed.');
        const eligibilityResolved = await resolveContactlessEligibility({
          checkpoint: 'screen_entry',
          audience: 'staff',
          entryPoint,
          restaurantAllowsContactless: false,
          entryPointSupportsContactless: true,
        });
        if (!active) return;
        setContactlessEligibility(eligibilityResolved);
      } finally {
        if (active) setTapAvailabilityLoading(false);
      }
    };

    void loadAvailability();
    return () => {
      active = false;
    };
  }, [entryPoint, resolveStaffContactlessAvailability, tapAvailabilityReady]);

  useEffect(() => {
    console.info('[payments][contactless_eligibility]', 'rendered_payment_methods', {
      entryPoint,
      runtime: contactlessEligibility?.runtime || null,
      eligible: contactlessEligibility?.eligible === true,
      reason: contactlessEligibility?.reason || null,
      methods: contactlessEligibility?.eligible ? ['contactless'] : [],
    });
  }, [contactlessEligibility, entryPoint]);

  useEffect(() => {
    const presentation = contactlessEligibility ? resolveContactlessPresentation(contactlessEligibility) : null;
    console.info('[payments][contactless_eligibility]', 'pos_take_payment_contactless_presentation_resolved_from_live_availability', {
      entryPoint,
      presentation: presentation?.presentation || null,
      eligible: contactlessEligibility?.eligible === true,
      reason: presentation?.detail || null,
    });
  }, [contactlessEligibility, entryPoint]);


  const applyBootstrapState = useCallback((readiness: Awaited<ReturnType<typeof resolveNativeTapToPayReadiness>>) => {
    if (!readiness.supported) {
      setState('unsupported_device');
      return;
    }
    if (readiness.state === 'permission_not_requested') {
      setState('setup_failed');
      return;
    }
    if (readiness.state === 'nfc_disabled') {
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
    async (promptIfNeeded: boolean, options?: { suppressStateUpdates?: boolean }) => {
      const suppressStateUpdates = options?.suppressStateUpdates === true;
      if (deadRunLockRef.current) {
        console.info('[internal-settlement][take-payment][quick-charge][tap-to-pay]', 'readiness_refresh_blocked_dead_run', {
          flowRunId: deadRunLockRef.current.flowRunId,
          reason: deadRunLockRef.current.reason,
          promptIfNeeded,
        });
        return null;
      }
      if (!nativeRestaurantId) {
        setNativeReadinessReady(false);
        setNativeReadinessReason('Restaurant context is missing. Return to launcher and open Take Payment again.');
        if (!suppressStateUpdates) {
          setState('failed');
        }
        return null;
      }

      setNativeReadinessLoading(true);
      try {
        const readiness = await resolveNativeTapToPayReadiness({ promptIfNeeded });
        if (!readiness.supported || !readiness.ready) {
          setNativeReadinessReady(false);
          setNativeReadinessReason(readiness.reason);
          if (!suppressStateUpdates) {
            applyBootstrapState(readiness);
          }
          return readiness;
        }
        setNativeReadinessReady(true);
        setNativeReadinessReason('');
        if (!suppressStateUpdates) {
          setState('ready');
        }
        return readiness;
      } catch (error: any) {
        const reason = error?.message || 'Tap to Pay setup check failed.';
        setNativeReadinessReady(false);
        setNativeReadinessReason(reason);
        if (!suppressStateUpdates) {
          setState('failed');
        }
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
        if (deadRunLockRef.current) {
          console.info(
            '[internal-settlement][take-payment][quick-charge][tap-to-pay]',
            'readiness_refresh_blocked_dead_run',
            {
              flowRunId: deadRunLockRef.current.flowRunId,
              reason: deadRunLockRef.current.reason,
              stage: 'foreground',
            }
          );
          return;
        }
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

  const commitAuthoritativeSuccess = useCallback(
    (source: string, flowRunId: string | null, payload?: Record<string, unknown>) => {
      const existing = successAuthorityRef.current;
      if (!existing) {
        const committedAt = Date.now();
        logCollectionEvent('first_authoritative_terminal_signal_received', {
          flowRunId: flowRunId || flowRunIdRef.current,
          source,
          ...payload,
        });
        successAuthorityRef.current = { flowRunId: flowRunId || flowRunIdRef.current || null, source, at: committedAt };
        logCollectionEvent('success_lock_committed', {
          flowRunId: successAuthorityRef.current.flowRunId,
          source,
          committedAt,
        });
        return;
      }
      logCollectionEvent('authoritative_success_signal_observed_after_lock', {
        flowRunId: existing.flowRunId,
        originalSource: existing.source,
        latestSource: source,
      });
    },
    [logCollectionEvent]
  );

  const shouldSuppressNonSuccess = useCallback(
    (outcome: 'canceled' | 'failed', source: string, flowRunId?: string | null) => {
      const lock = successAuthorityRef.current;
      const candidateFlowRunId = flowRunId ?? flowRunIdRef.current;
      if (!lock) return false;
      if (lock.flowRunId && candidateFlowRunId && lock.flowRunId !== candidateFlowRunId) return false;
      logCollectionEvent('non_success_commit_attempted_after_success', {
        attemptedOutcome: outcome,
        source,
        flowRunId: candidateFlowRunId || lock.flowRunId,
        successSource: lock.source,
        successCommittedAt: lock.at,
      });
      logCollectionEvent(
        outcome === 'canceled' ? 'canceled_commit_attempted_after_success' : 'failed_commit_attempted_after_success',
        {
          source,
          flowRunId: candidateFlowRunId || lock.flowRunId,
          successSource: lock.source,
          successCommittedAt: lock.at,
        }
      );
      logCollectionEvent(outcome === 'canceled' ? 'canceled_suppressed_after_success' : 'failure_suppressed_after_success', {
        source,
        flowRunId: candidateFlowRunId || lock.flowRunId,
      });
      return true;
    },
    [logCollectionEvent]
  );

  const establishHandoverOwner = useCallback(
    (flowRunId: string, reason: string) => {
      if (deadRunFlowIdsRef.current.has(flowRunId)) {
        logCollectionEvent('owner_recreate_blocked_dead_run', { flowRunId, reason });
        logCollectionEvent('dead_run_guard_triggered', { flowRunId, guard: 'owner_recreate', reason });
        return false;
      }
      if (suppressRecoveryRef.current) {
        logCollectionEvent('owner_recreated_after_terminal_cancel', {
          flowRunId,
          reason,
          priorTerminalReason: suppressRecoveryRef.current.reason,
          priorTerminalAt: suppressRecoveryRef.current.at,
        });
      }
      handoverOwnerRef.current = { flowRunId, active: true, cancelRequested: false };
      cancelBarrierRef.current = null;
      setPreHandoverOverlayOwned(true);
      logCollectionEvent('handover_owner_established', { flowRunId, reason });
      logCollectionEvent('take_payment_overlay_owner_established', { flowRunId, reason });
      return true;
    },
    [logCollectionEvent]
  );

  const releaseHandoverOwner = useCallback(
    (reason: string) => {
      const owner = handoverOwnerRef.current;
      if (owner) {
        logCollectionEvent('handover_owner_released', { flowRunId: owner.flowRunId, reason });
        logCollectionEvent('take_payment_overlay_owner_released', { flowRunId: owner.flowRunId, reason });
        if (reason.includes('stripe_handover') || reason.includes('verified_finalized') || reason === 'completed') {
          logCollectionEvent('owner_released_due_to_stripe_takeover', { flowRunId: owner.flowRunId, reason });
        } else if (reason.includes('cancel')) {
          logCollectionEvent('owner_released_due_to_cancel', { flowRunId: owner.flowRunId, reason });
        } else {
          logCollectionEvent('owner_released_due_to_failure', { flowRunId: owner.flowRunId, reason });
        }
      }
      handoverOwnerRef.current = null;
      setPreHandoverOverlayOwned(false);
    },
    [logCollectionEvent]
  );

  const shouldBlockRunContinuation = useCallback(
    (
      flowRunId: string | null | undefined,
      label: string,
      phase: 'pre_handover' | 'post_handover_confirmation' = 'pre_handover'
    ) => {
      if (!flowRunId) return true;
      if (deadRunFlowIdsRef.current.has(flowRunId)) {
        logCollectionEvent('late_callback_ignored_dead_run', { flowRunId, label });
        logCollectionEvent('stripe_handover_blocked_dead_run', { flowRunId, label });
        logCollectionEvent('dead_run_guard_triggered', { flowRunId, guard: 'run_continuation', label });
        return true;
      }
      const owner = handoverOwnerRef.current;
      const barrier = cancelBarrierRef.current;
      const blockedByCancelBarrier = barrier != null && barrier.flowRunId === flowRunId;
      const blockedByOwner =
        phase === 'pre_handover' &&
        (!owner || owner.flowRunId !== flowRunId || owner.active !== true || owner.cancelRequested === true);
      const blocked = blockedByOwner || blockedByCancelBarrier;
      if (blocked) {
        if ((owner?.cancelRequested === true && owner.flowRunId === flowRunId) || barrier?.flowRunId === flowRunId) {
          logCollectionEvent('late_handover_callback_ignored_after_cancel', { flowRunId, label });
        } else {
          logCollectionEvent('stripe_handover_attempt_blocked_due_to_cancel', { flowRunId, label });
        }
        logCollectionEvent('post_stripe_confirmation_blocked', {
          flowRunId,
          label,
          phase,
          blockedByOwner,
          blockedByCancelBarrier,
        });
      }
      return blocked;
    },
    [logCollectionEvent]
  );

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

  useEffect(() => {
    logCollectionEvent('phase_entered', { phase: uiPhase, state });
    return () => {
      logCollectionEvent('phase_exited', { phase: uiPhase, state });
    };
  }, [logCollectionEvent, state, uiPhase]);

  useEffect(() => {
    if (!showTransitionOverlay) {
      if (
        deadRunLockRef.current &&
        (isNativeTapToPayOverlayVisiblePhase(state, { hasReturnedFromNative }) || showSuccessTick || preHandoverOverlayOwned)
      ) {
        logCollectionEvent('overlay_show_blocked_dead_run', {
          flowRunId: deadRunLockRef.current.flowRunId,
          reason: deadRunLockRef.current.reason,
        });
        logCollectionEvent('dead_run_guard_triggered', {
          flowRunId: deadRunLockRef.current.flowRunId,
          guard: 'overlay_show_hidden_branch',
          reason: deadRunLockRef.current.reason,
        });
      }
      setOverlayMessageIndex(0);
      overlayPhaseEnteredAtMsRef.current = null;
      logCollectionEvent('overlay_hidden', { phase: uiPhase });
      if (preHandoverOverlayOwned) {
        logCollectionEvent('overlay_hidden_while_handover_active', { phase: uiPhase, state });
        logCollectionEvent('take_payment_overlay_hidden_while_handover_active', { phase: uiPhase, state });
      }
      return;
    }
    overlayPhaseEnteredAtMsRef.current = Date.now();
    if (
      deadRunLockRef.current &&
      (isNativeTapToPayOverlayVisiblePhase(state, { hasReturnedFromNative }) || showSuccessTick || preHandoverOverlayOwned)
    ) {
      logCollectionEvent('overlay_show_blocked_dead_run', {
        flowRunId: deadRunLockRef.current.flowRunId,
        reason: deadRunLockRef.current.reason,
      });
      logCollectionEvent('dead_run_guard_triggered', {
        flowRunId: deadRunLockRef.current.flowRunId,
        guard: 'overlay_show',
        reason: deadRunLockRef.current.reason,
      });
      return;
    }
    logCollectionEvent('overlay_shown', { phase: uiPhase });
    if (suppressRecoveryRef.current) {
      logCollectionEvent('overlay_shown_after_terminal_cancel', {
        phase: uiPhase,
        terminalReason: suppressRecoveryRef.current.reason,
        terminalAt: suppressRecoveryRef.current.at,
      });
    }
    const interval = window.setInterval(() => {
      setOverlayMessageIndex((previous) => {
        const next = previous + 1;
        logCollectionEvent('joke_line_changed', { index: next % overlayLines.length, phase: uiPhase });
        return next;
      });
    }, 3600);
    return () => window.clearInterval(interval);
  }, [hasReturnedFromNative, logCollectionEvent, overlayLines.length, preHandoverOverlayOwned, showTransitionOverlay, state, uiPhase]);

  useEffect(() => {
    if (!isNativeTapToPayOverlayVisiblePhase(state, { hasReturnedFromNative })) return;
    const timeout = window.setTimeout(() => {
      if (!isNativeTapToPayOverlayVisiblePhase(state, { hasReturnedFromNative })) return;
      logCollectionEvent('watchdog_triggered', { phase: uiPhase, state });
      setState('failed');
      setMessage('Payment transition took too long. Please close and try again.');
    }, 60000);
    return () => window.clearTimeout(timeout);
  }, [hasReturnedFromNative, logCollectionEvent, state, uiPhase]);

  useEffect(() => {
    if (state === 'idle' || state === 'ready' || state === 'failed' || state === 'canceled' || state === 'completed') {
      releaseHandoverOwner(`state_${state}`);
    }
  }, [releaseHandoverOwner, state]);

  useEffect(() => {
    if (state !== 'completed' && state !== 'canceled' && state !== 'failed') return;
    const successLock = successAuthorityRef.current;
    const finalUiSource =
      state === 'completed'
        ? successLock?.source || 'completed_without_explicit_lock'
        : state === 'canceled'
          ? 'explicit_or_verified_cancel'
          : 'verified_or_native_failure';
    logCollectionEvent('final_ui_outcome_source', {
      state,
      finalUiSource,
      flowRunId: flowRunIdRef.current,
      successLockFlowRunId: successLock?.flowRunId || null,
    });
  }, [logCollectionEvent, state]);

  useEffect(() => {
    if (state !== 'canceled' && state !== 'failed') return;
    suppressRecoveryRef.current = { reason: state, at: Date.now() };
    if (state === 'canceled') {
      const flowRunId = flowRunIdRef.current;
      const committedAt = Date.now();
      deadRunLockRef.current = { flowRunId, reason: 'canceled', at: committedAt };
      if (flowRunId) deadRunFlowIdsRef.current.add(flowRunId);
      logCollectionEvent('terminal_cancel_committed', { flowRunId, committedAt, source: 'state_effect' });
    }
    logCollectionEvent('cancel_terminal_committed', { reason: state });
  }, [logCollectionEvent, state]);

  useEffect(() => {
    if ((state === 'idle' || state === 'ready') && handoverOwnerRef.current?.active) {
      logCollectionEvent('payment_options_revealed_while_handover_active', {
        state,
        flowRunId: handoverOwnerRef.current.flowRunId,
      });
      logCollectionEvent('take_payment_payment_options_revealed_while_handover_active', {
        state,
        flowRunId: handoverOwnerRef.current.flowRunId,
      });
    }
  }, [logCollectionEvent, state]);

  useEffect(() => {
    if (!showTransitionOverlay || !preHandoverOverlayOwned) return;
    logCollectionEvent('duplicate_prehandover_render_attempt', {
      state,
      phase: uiPhase,
      flowRunId: handoverOwnerRef.current?.flowRunId || null,
    });
    logCollectionEvent('take_payment_duplicate_prehandover_render_attempt', {
      state,
      phase: uiPhase,
      flowRunId: handoverOwnerRef.current?.flowRunId || null,
    });
  }, [logCollectionEvent, preHandoverOverlayOwned, showTransitionOverlay, state, uiPhase]);

  useEffect(() => {
    if (!showTransitionOverlay) return;
    logCollectionEvent('close_affordance_eligibility_evaluated', {
      entryPoint,
      phase: uiPhase,
      canCloseOverlay,
      preHandoverOverlayOwned,
      cancelInFlight,
      showSuccessTick,
      terminalVisualState,
    });
    if (canCloseOverlay) {
      if (entryPoint === 'pos') {
        logCollectionEvent('kiosk_close_affordance_rendered', { phase: uiPhase });
      } else {
        logCollectionEvent('take_payment_close_affordance_rendered', { phase: uiPhase });
      }
    }
  }, [cancelInFlight, canCloseOverlay, entryPoint, logCollectionEvent, preHandoverOverlayOwned, showSuccessTick, showTransitionOverlay, terminalVisualState, uiPhase]);

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
    const normalizedStatus = normalizeNativeTapToPayState(nativeResult.status, { hasReturnedFromNative: true });
    const normalizedCode = normalizeNativeTapToPayState(nativeResult.code, { hasReturnedFromNative: true });
    const canceled = normalizedStatus === 'canceled' || normalizedCode === 'canceled';
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
    successAuthorityRef.current = null;
    deadRunLockRef.current = null;
    suppressRecoveryRef.current = null;
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
      console.info('[payments][contactless_eligibility]', 'cached_result_rejected_in_favor_of_live_check', {
        entryPoint,
        checkpoint: 'selection',
        cachedAvailable: false,
        liveCheckRequested: true,
      });
    }
    const selectionAvailability = await resolveStaffContactlessAvailability('selection').catch((error: any) => {
      const reason = error?.message || 'Tap to Pay availability could not be confirmed.';
      setTapAvailabilityReady(false);
      setTapAvailabilityReason(reason);
      console.info('[payments][contactless_eligibility]', 'contactless_start_blocked_by_eligibility_guard', {
        entryPoint,
        checkpoint: 'selection',
        reason: 'live_availability_request_failed',
        detail: reason,
      });
      return null;
    });
    if (!selectionAvailability) {
      setState('failed');
      setMessage(tapAvailabilityReason || 'Tap to Pay availability could not be confirmed.');
      return;
    }
    if (tapAvailabilityReady !== selectionAvailability.serverAvailable) {
      console.info('[payments][contactless_eligibility]', 'cached_result_rejected_in_favor_of_live_check', {
        entryPoint,
        checkpoint: 'selection',
        cachedAvailable: tapAvailabilityReady,
        liveAvailable: selectionAvailability.serverAvailable,
      });
    }
    setTapAvailabilityReady(selectionAvailability.serverAvailable);
    setTapAvailabilityReason(selectionAvailability.serverReason);
    const selectionEligibility = selectionAvailability.resolved;
    setContactlessEligibility(selectionEligibility);
    if (!selectionEligibility.eligible) {
      setState('failed');
      setMessage(selectionEligibility.detail || 'Tap to Pay is not available for this account/device.');
      console.info('[payments][contactless_eligibility]', 'contactless_start_blocked_by_eligibility_guard', {
        entryPoint,
        checkpoint: 'selection',
        reason: selectionEligibility.reason,
      });
      console.info('[payments][contactless_eligibility]', 'ui_disabled_or_blocked_due_to_live_unavailability', {
        entryPoint,
        checkpoint: 'selection',
        reason: selectionEligibility.reason,
      });
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
    cancelBarrierRef.current = null;
    setState('bootstrapping');
    setMessage('Checking Tap to Pay readiness…');

    let sessionIdForCleanup: string | null = null;
    let keepFlowActiveAfterError = false;
    const flowRunId = flowRunIdRef.current;
    if (flowRunId) {
      const ownerEstablished = establishHandoverOwner(flowRunId, 'collect_contactless_started');
      if (!ownerEstablished) {
        setBusy(false);
        flowActiveRef.current = false;
        flowRunIdRef.current = null;
        setState('canceled');
        setMessage('Payment canceled.');
        return;
      }
    }
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
      if (flowRunId && deadRunFlowIdsRef.current.has(flowRunId)) {
        logCollectionEvent('readiness_refresh_blocked_dead_run', { flowRunId, stage: 'before_server_refresh' });
        logCollectionEvent('dead_run_guard_triggered', { flowRunId, guard: 'readiness_refresh' });
        if (!shouldSuppressNonSuccess('canceled', 'readiness_refresh_blocked_dead_run', flowRunId)) {
          setState('canceled');
          setMessage('Payment canceled.');
        }
        return;
      }
      const readinessRes = await fetch('/api/dashboard/internal-settlement/tap-to-pay-availability', { cache: 'no-store' });
      const readinessPayload = await readinessRes.json().catch(() => ({}));
      if (!readinessRes.ok || !readinessPayload?.tap_to_pay_available) {
        logCollectionEvent('readiness_refresh.result', {
          ok: false,
          httpStatus: readinessRes.status,
          reason: readinessPayload?.reason || null,
        });
        setState('failed');
        setMessage(readinessPayload?.reason || 'Tap to Pay is not available for this restaurant.');
        releaseHandoverOwner('readiness_unavailable');
        return;
      }
      logCollectionEvent('readiness_refresh.result', {
        ok: true,
        terminalLocationId: readinessPayload?.terminal_location_id || null,
      });

      const nativeReadiness = await refreshNativeReadiness(false, { suppressStateUpdates: true });
      if (shouldBlockRunContinuation(flowRunId, 'after_native_readiness')) {
        releaseHandoverOwner('readiness_refresh_blocked_dead_run');
        return;
      }
      if (!nativeReadiness || !nativeReadiness.supported || !nativeReadiness.ready) {
        setState('failed');
        setMessage(nativeReadiness?.reason || 'Tap to Pay setup is incomplete on this device.');
        releaseHandoverOwner('native_readiness_unavailable');
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
        }),
      });
      const createPayload = await createRes.json().catch(() => ({}));
      if (shouldBlockRunContinuation(flowRunId, 'after_create_session')) {
        releaseHandoverOwner('create_session_blocked_dead_run');
        return;
      }
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
      if (shouldBlockRunContinuation(flowRunId, 'after_payment_intent_prepare')) {
        releaseHandoverOwner('payment_intent_prepare_blocked_dead_run');
        return;
      }
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
      if (shouldBlockRunContinuation(flowRunId, 'after_native_prepare')) {
        releaseHandoverOwner('native_prepare_blocked_dead_run');
        return;
      }
      if (prepared.status === 'failed' || prepared.status === 'unavailable') {
        logCollectionEvent('prepare_result', { stage: 'native_prepare', ok: false, sessionId, result: prepared });
        setState(isUnsupportedDeviceError(prepared.code) ? 'unsupported_device' : 'failed');
        setMessage(prepared.message || 'Tap to Pay reader setup failed. Retry to reconnect the reader.');
        await persistFlowOutcome({ sessionId, outcome: 'failed', reason: 'Native Tap to Pay preparation failed.', failureCode: 'native_prepare_failed' });
        setActiveSessionId(null);
        setActiveTerminalLocationId(null);
        internalSettlementActiveRunStore.clear();
        releaseHandoverOwner('native_prepare_failed');
        return;
      }
      logCollectionEvent('prepare_result', { stage: 'native_prepare', ok: true, sessionId, result: prepared });

      const readinessRecheckRes = await fetch('/api/dashboard/internal-settlement/tap-to-pay-availability', { cache: 'no-store' });
      const readinessRecheckPayload = await readinessRecheckRes.json().catch(() => ({}));
      if (shouldBlockRunContinuation(flowRunId, 'after_readiness_recheck')) {
        releaseHandoverOwner('readiness_recheck_blocked_dead_run');
        return;
      }
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
        releaseHandoverOwner('readiness_changed_before_handover');
        return;
      }
      const beforeStartAvailability = await resolveStaffContactlessAvailability('before_native_start');
      if (tapAvailabilityReady !== beforeStartAvailability.serverAvailable) {
        console.info('[payments][contactless_eligibility]', 'cached_result_rejected_in_favor_of_live_check', {
          entryPoint,
          checkpoint: 'before_native_start',
          cachedAvailable: tapAvailabilityReady,
          liveAvailable: beforeStartAvailability.serverAvailable,
        });
      }
      setTapAvailabilityReady(beforeStartAvailability.serverAvailable);
      setTapAvailabilityReason(beforeStartAvailability.serverReason);
      setContactlessEligibility(beforeStartAvailability.resolved);
      if (!beforeStartAvailability.resolved.eligible) {
        logCollectionEvent('contactless_start_blocked_by_eligibility_guard', {
          checkpoint: 'before_native_start',
          reason: beforeStartAvailability.resolved.reason,
          detail: beforeStartAvailability.resolved.detail,
        });
        setState('failed');
        setMessage(beforeStartAvailability.resolved.detail || 'Tap to Pay is unavailable right now.');
        console.info('[payments][contactless_eligibility]', 'contactless_start_blocked_by_live_unavailability', {
          entryPoint,
          checkpoint: 'before_native_start',
          source: 'live_server_and_native',
          reason: beforeStartAvailability.resolved.reason,
          detail: beforeStartAvailability.resolved.detail,
        });
        console.info('[payments][contactless_eligibility]', 'ui_disabled_or_blocked_due_to_live_unavailability', {
          entryPoint,
          checkpoint: 'before_native_start',
          reason: beforeStartAvailability.resolved.reason,
        });
        releaseHandoverOwner('before_native_start_live_unavailable');
        return;
      }

      setState('handover');
      setMessage('Handing over to Stripe Tap to Pay…');
      logCollectionEvent('native_collect.start', { sessionId });
      if (shouldBlockRunContinuation(flowRunId, 'before_stripe_handover')) {
        releaseHandoverOwner('stripe_handover_blocked_due_to_cancel');
        return;
      }

      logCollectionEvent('stripe_takeover_started', { sessionId, flowRunId });
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
      releaseHandoverOwner('stripe_handover_returned');
      logCollectionEvent('post_stripe_status_confirmation_entered', {
        sessionId,
        flowRunId,
        nativeStatus: nativeResult.status,
        nativeCode: nativeResult.code || null,
      });
      setState('processing');
      setMessage('Confirming payment status…');
      if (shouldBlockRunContinuation(flowRunId, 'after_stripe_handover_result', 'post_handover_confirmation')) {
        if (!shouldSuppressNonSuccess('canceled', 'after_stripe_handover_result', flowRunId)) {
          setState('canceled');
          setMessage('Payment canceled.');
        }
        setActiveSessionId(null);
        setActiveTerminalLocationId(null);
        internalSettlementActiveRunStore.clear();
        cancelBarrierRef.current = null;
        return;
      }
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
          const verificationPaid = verifyPayload?.verification?.verifiedPaid === true;
          if (!verificationPaid) {
            if (!shouldSuppressNonSuccess('failed', 'verification_finalized_not_paid', flowRunId)) {
              setState('failed');
              setMessage(
                verifyPayload?.verification?.reason ||
                  'Payment did not complete successfully. Please retry or choose another method.'
              );
            }
            setActiveSessionId(null);
            setActiveTerminalLocationId(null);
            internalSettlementActiveRunStore.clear();
            return;
          }
          commitAuthoritativeSuccess('server_verify_finalized_paid', flowRunId, {
            sessionId,
            verifiedState,
          });
          if (mode === 'quick_charge') {
            quickChargeAttemptEndMsRef.current = Date.now();
          }
          setState('completed');
          setMessage(mode === 'order_payment' ? 'Order payment collected successfully.' : 'Quick charge collected successfully.');
          setActiveSessionId(null);
          setActiveTerminalLocationId(null);
          internalSettlementActiveRunStore.clear();
          releaseHandoverOwner('verified_finalized');
          await loadOrders();
          return;
        }

        if (!shouldSuppressNonSuccess('failed', 'native_failure_verified_non_paid', flowRunId)) {
          setState(isUnsupportedDeviceError(nativeResult.code) ? 'unsupported_device' : 'failed');
        }
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
        releaseHandoverOwner('native_failure_terminal');
        return;
      }

      commitAuthoritativeSuccess('native_collect_succeeded', flowRunId, {
        sessionId,
        paymentIntentId: nativeResult.paymentIntentId || null,
        paymentIntentStatus: nativeResult.paymentIntentStatus || null,
      });
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
      commitAuthoritativeSuccess('server_finalize_success', flowRunId, {
        sessionId,
        finalState: finalizePayload?.session?.state || null,
      });

      setState('completed');
      if (mode === 'quick_charge') {
        quickChargeAttemptEndMsRef.current = Date.now();
      }
      setMessage(mode === 'order_payment' ? 'Order payment collected successfully.' : 'Quick charge collected successfully.');
      setQuickChargeFailureSnapshot(null);
      setActiveSessionId(null);
      setActiveTerminalLocationId(null);
      internalSettlementActiveRunStore.clear();
      releaseHandoverOwner('completed');

      if (mode === 'quick_charge') {
        setQuickAmountDigits('0');
      }

      await loadOrders();
    } catch (error: any) {
      logCollectionEvent('collection_exception', { message: error?.message || 'unknown_exception' });
      if (shouldBlockRunContinuation(flowRunId, 'collection_exception')) {
        logCollectionEvent('late_callback_ignored_dead_run', {
          flowRunId,
          label: 'collection_exception',
          message: error?.message || 'unknown_exception',
        });
        releaseHandoverOwner('collection_exception_blocked_dead_run');
        return;
      }
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
      if (shouldSuppressNonSuccess('failed', 'collection_exception', flowRunId)) {
        releaseHandoverOwner('collection_exception_suppressed_after_success');
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
      releaseHandoverOwner('collection_exception');
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
    refreshNativeReadiness,
    resolveStaffContactlessAvailability,
    releaseHandoverOwner,
    commitAuthoritativeSuccess,
    selectedOrderId,
    shouldBlockRunContinuation,
    shouldSuppressNonSuccess,
    tapAvailabilityReady,
    tapAvailabilityReason,
    entryPoint,
    establishHandoverOwner,
  ]);



  useEffect(() => {
    if (!nativeRestaurantId) return;
    const recover = async (source: 'mount' | 'resume') => {
      if (deadRunLockRef.current) {
        logCollectionEvent('late_callback_ignored_dead_run', {
          flowRunId: deadRunLockRef.current.flowRunId,
          label: `recover_${source}`,
        });
        return;
      }
      if (suppressRecoveryRef.current) {
        logCollectionEvent('overlay_recovery_blocked_after_terminal_cancel', {
          source,
          reason: suppressRecoveryRef.current.reason,
          suppressedAt: suppressRecoveryRef.current.at,
        });
        return;
      }
      if (source === 'resume' && flowActiveRef.current) {
        logCollectionEvent('app_resume_recovery_skipped_local_active_run', { source });
        return;
      }
      const activeRun = internalSettlementActiveRunStore.get();
      if (activeRun?.flowRunId && deadRunFlowIdsRef.current.has(activeRun.flowRunId)) {
        logCollectionEvent('owner_recreate_blocked_dead_run', {
          flowRunId: activeRun.flowRunId,
          reason: `recover_${source}`,
        });
        logCollectionEvent('dead_run_guard_triggered', {
          flowRunId: activeRun.flowRunId,
          guard: 'recover_owner_recreate',
          source,
        });
        return;
      }
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

  useEffect(() => {
    if (state !== 'completed' || successRouteCommittedRef.current) return;
    successRouteCommittedRef.current = true;
    setShowSuccessTick(true);
    setTerminalVisualState('success');
    logCollectionEvent('terminal_route_selected', {
      terminalType: 'success',
      entryPoint,
      restaurantId: nativeRestaurantId,
    });
    console.info('[payments][contactless_eligibility]', 'terminal_outcome_selected', { entryPoint, outcome: 'success' });
    const timeout = window.setTimeout(() => {
      const target = nativeRestaurantId
        ? `/pos/${nativeRestaurantId}?stage=paymentComplete&source=${entryPoint === 'pos' ? 'pos-contactless' : 'take-payment'}${
            source === 'launcher' ? '&origin=launcher' : ''
          }`
        : null;
      logCollectionEvent('success_tick_shown', { entryPoint, restaurantId: nativeRestaurantId, target });
      setShowSuccessTick(false);
      setTerminalVisualState(null);
      if (!target) {
        logCollectionEvent('terminal_route_committed', {
          terminalType: 'success',
          entryPoint,
          route: 'stay_on_take_payment_reset_to_ready',
        });
        console.info('[payments][contactless_eligibility]', 'terminal_route_committed', {
          entryPoint,
          outcome: 'success',
          destination: 'reset_to_ready',
        });
        setState('idle');
        setMessage('Ready to collect payment.');
        return;
      }
      logCollectionEvent('terminal_route_committed', { terminalType: 'success', entryPoint, route: target });
      console.info('[payments][contactless_eligibility]', 'terminal_route_committed', {
        entryPoint,
        outcome: 'success',
        destination: target,
      });
      router.push(target).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [entryPoint, logCollectionEvent, nativeRestaurantId, router, source, state]);

  useEffect(() => {
    if (state === 'completed') return;
    setShowSuccessTick(false);
    if (terminalVisualState === 'success') {
      setTerminalVisualState(null);
    }
    successRouteCommittedRef.current = false;
  }, [state, terminalVisualState]);

  useEffect(() => {
    if (state !== 'canceled' && state !== 'failed') return;
    if (!shouldSuppressNonSuccess(state, 'state_guard_effect', flowRunIdRef.current)) return;
    logCollectionEvent('route_commit_source_suppressed_after_success', {
      source: 'state_guard_effect',
      attemptedOutcome: state,
      restoredOutcome: 'completed',
      flowRunId: flowRunIdRef.current,
    });
    setState('completed');
    setMessage(mode === 'order_payment' ? 'Order payment collected successfully.' : 'Quick charge collected successfully.');
  }, [logCollectionEvent, mode, shouldSuppressNonSuccess, state]);

  useEffect(() => {
    if (state !== 'canceled' && state !== 'failed') return;
    if (shouldSuppressNonSuccess(state, 'terminal_route_effect', flowRunIdRef.current)) {
      logCollectionEvent('route_commit_source_suppressed_after_success', {
        source: 'terminal_route_effect',
        attemptedOutcome: state,
        flowRunId: flowRunIdRef.current,
      });
      return;
    }
    const visualState = state === 'canceled' ? 'canceled' : 'failed';
    setTerminalVisualState(visualState);
    logCollectionEvent('terminal_route_selected', {
      terminalType: visualState,
      entryPoint,
      restaurantId: nativeRestaurantId,
    });
    console.info('[payments][contactless_eligibility]', 'terminal_outcome_selected', {
      entryPoint,
      outcome: visualState === 'canceled' ? 'canceled' : 'failed',
    });
    const timeout = window.setTimeout(() => {
      logCollectionEvent('terminal_route_committed', {
        terminalType: visualState,
        entryPoint,
        route: 'stay_on_take_payment_reset_to_ready',
      });
      console.info('[payments][contactless_eligibility]', 'terminal_route_committed', {
        entryPoint,
        outcome: visualState === 'canceled' ? 'canceled' : 'failed',
        destination: 'reset_to_ready',
      });
      console.info('[payments][contactless_eligibility]', 'failure_or_ineligible_returned_to_payment_options', {
        entryPoint,
        outcome: visualState === 'canceled' ? 'canceled' : 'failed',
      });
      if (successAuthorityRef.current) {
        logCollectionEvent('fallback_canceled_branch_blocked_after_success', {
          source: 'terminal_route_commit_timeout',
          attemptedOutcome: visualState,
          flowRunId: flowRunIdRef.current,
          successSource: successAuthorityRef.current.source,
        });
        logCollectionEvent('route_commit_source_suppressed_after_success', {
          source: 'terminal_route_commit_timeout',
          attemptedOutcome: visualState,
          flowRunId: flowRunIdRef.current,
        });
        setState('completed');
        setMessage(mode === 'order_payment' ? 'Order payment collected successfully.' : 'Quick charge collected successfully.');
        setTerminalVisualState(null);
        return;
      }
      setTerminalVisualState(null);
      setState('idle');
      setMessage('Ready to collect payment.');
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [entryPoint, logCollectionEvent, mode, nativeRestaurantId, shouldSuppressNonSuccess, state]);

  const handleCancel = useCallback(async () => {
    if (cancelInFlight) return;
    if (shouldSuppressNonSuccess('canceled', 'handle_cancel_invoked', flowRunIdRef.current)) {
      logCollectionEvent('route_commit_source_suppressed_after_success', {
        source: 'handle_cancel_invoked',
        attemptedOutcome: 'canceled',
        flowRunId: flowRunIdRef.current,
      });
      return;
    }
    logCollectionEvent('exit_cross_clicked', { sessionId: activeSessionId });
    if (!activeSessionId) {
      logCollectionEvent('native_cancel_failed_or_unavailable', { reason: 'no_active_session' });
      return;
    }
    const activeFlowRunId = flowRunIdRef.current;
    if (activeFlowRunId) {
      cancelBarrierRef.current = { flowRunId: activeFlowRunId, requestedAt: Date.now() };
      if (handoverOwnerRef.current?.flowRunId === activeFlowRunId) {
        handoverOwnerRef.current = { ...handoverOwnerRef.current, active: false, cancelRequested: true };
      }
      logCollectionEvent('cancel_barrier_set', { flowRunId: activeFlowRunId, sessionId: activeSessionId });
    }
    setCancelInFlight(true);
    setBusy(true);
    let cancelCompleted = false;
    logCollectionEvent('cancel_requested', { sessionId: activeSessionId });
    try {
      logCollectionEvent('native_cancel_attempt_started', { sessionId: activeSessionId });
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
      logCollectionEvent('native_cancel_confirmed', { sessionId: activeSessionId });
      logCollectionEvent('cancel_succeeded', { sessionId: activeSessionId });
      if (activeFlowRunId) {
        deadRunFlowIdsRef.current.add(activeFlowRunId);
      }
      deadRunLockRef.current = { flowRunId: activeFlowRunId || null, reason: 'canceled', at: Date.now() };
      logCollectionEvent('terminal_cancel_committed', { flowRunId: activeFlowRunId || null, source: 'handle_cancel_success' });
      setState('canceled');
      quickChargeAttemptEndMsRef.current = Date.now();
      setMessage('Payment canceled.');
      setQuickChargeFailureSnapshot(null);
      setQuickChargeSuccessSnapshot(null);
      setQuickChargeRawNativePayload(null);
      setQuickChargeRawServerVerificationPayload(null);
      setActiveSessionId(null);
      setActiveTerminalLocationId(null);
      internalSettlementActiveRunStore.clear();
      releaseHandoverOwner('cancel_confirmed');
      cancelBarrierRef.current = activeFlowRunId ? { flowRunId: activeFlowRunId, requestedAt: Date.now() } : null;
      flowRunIdRef.current = null;
      flowActiveRef.current = false;
      cancelCompleted = true;
      await loadOrders();
    } catch (error: any) {
      logCollectionEvent('cancel_blocked_or_failed', { sessionId: activeSessionId, error: error?.message || 'unknown_error' });
      logCollectionEvent('native_cancel_failed_or_unavailable', { sessionId: activeSessionId, error: error?.message || 'unknown_error' });
      setMessage('Unable to cancel right now. Please wait for the current payment phase.');
      setState('handover');
    } finally {
      setCancelInFlight(false);
      if (cancelCompleted) {
        setBusy(false);
      } else if (cancelBarrierRef.current?.flowRunId === flowRunIdRef.current) {
        setBusy(true);
        flowActiveRef.current = true;
      } else {
        setBusy(false);
        flowActiveRef.current = false;
        flowRunIdRef.current = null;
      }
    }
  }, [activeSessionId, cancelInFlight, loadOrders, logCollectionEvent, releaseHandoverOwner, shouldSuppressNonSuccess]);

  const setQuickAmountCents = useCallback((nextCents: number) => {
    setQuickAmountDigits(String(Math.max(0, Math.floor(nextCents))));
    setSelectedOrderId('');
    setMode('quick_charge');
  }, []);

  const appendAmountDigit = useCallback(
    (digit: string) => {
      setQuickAmountCents(Number.parseInt(`${quickAmountDigits === '0' ? '' : quickAmountDigits}${digit}`, 10) || 0);
    },
    [quickAmountDigits, setQuickAmountCents]
  );

  const backspaceAmountDigit = useCallback(() => {
    const next = quickAmountDigits.length <= 1 ? '0' : quickAmountDigits.slice(0, -1);
    setQuickAmountCents(Number.parseInt(next, 10) || 0);
  }, [quickAmountDigits, setQuickAmountCents]);

  const clearQuickAmount = useCallback(() => {
    setQuickAmountCents(0);
  }, [setQuickAmountCents]);

  const handleSelectOrder = useCallback(
    (orderId: string) => {
      setSelectedOrderId(orderId);
      if (orderId) {
        setMode('order_payment');
        setShowOrdersSheet(false);
        return;
      }
      setMode('quick_charge');
    },
    []
  );

  const handleBack = useCallback(() => {
    if (flowActiveRef.current || busy) return;
    if (!nativeRestaurantId) {
      router.push('/dashboard/launcher').catch(() => undefined);
      return;
    }
    if (source === 'launcher') {
      router.push(`/dashboard/launcher?restaurant_id=${encodeURIComponent(nativeRestaurantId)}`).catch(() => undefined);
      return;
    }
    router.push(`/pos/${nativeRestaurantId}`).catch(() => undefined);
  }, [busy, nativeRestaurantId, router, source]);

  return (
    <section className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-white sm:min-h-0 sm:rounded-3xl sm:border sm:border-gray-200 sm:shadow-sm">
      <NativeTapToPayPreHandoverOverlay
        visible={showTransitionOverlay}
        lines={overlayLines}
        lineIndex={overlayMessageIndex}
        showSuccessTick={showSuccessTick}
        terminalState={terminalVisualState}
        canClose={canCloseOverlay}
        onClose={() => {
          void handleCancel();
        }}
      />
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={handleBack}
          disabled={busy}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Back"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowOrdersSheet(true)}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Open unpaid orders"
        >
          <ClipboardDocumentListIcon className="h-5 w-5" />
          {orders.length > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-semibold text-white">
              {orders.length > 99 ? '99+' : orders.length}
            </span>
          ) : null}
        </button>
      </header>

      <div className="grid min-h-[calc(100dvh-10rem)] gap-4 px-3 py-4 sm:min-h-0 sm:p-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-3xl bg-gray-900 px-6 py-5 text-white">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gray-300">{toCurrencyCode('gbp')}</p>
            <p className="mt-2 text-5xl font-semibold tracking-tight sm:text-[54px]">{amountLabel}</p>
            {selectedOrder ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white">
                <span>#{selectedOrder.short_order_number ?? '—'} · {selectedOrder.customer_name || 'Guest'}</span>
                <button type="button" onClick={() => handleSelectOrder('')} className="inline-flex rounded-full p-0.5 text-gray-200 hover:bg-white/20 hover:text-white" aria-label="Clear selected order">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-3.5">
            <div className="grid grid-cols-4 gap-2">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={busy}
                  onClick={() => setQuickAmountCents(chip)}
                  className="rounded-lg bg-gray-100 px-2 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {formatPrice(chip / 100)}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={busy}
                  onClick={() => appendAmountDigit(digit)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-lg font-semibold text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={backspaceAmountDigit}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Backspace"
              >
                <BackspaceIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={clearQuickAmount}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="pt-1">
            {(() => {
              const presentation = contactlessEligibility ? resolveContactlessPresentation(contactlessEligibility) : null;
              const unavailable = presentation?.presentation === 'disabled';
              return (
                <button
                  type="button"
                  disabled={
                    unavailable ||
                    busy ||
                    tapAvailabilityLoading ||
                    nativeReadinessLoading ||
                    !tapAvailabilityReady ||
                    amountCents <= 0 ||
                    isBelowMinimumAmount ||
                    (mode === 'order_payment' && !selectedOrderId)
                  }
                  onClick={handleCollectContactless}
                  className="w-full rounded-2xl bg-gray-900 px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {busy ? 'Collecting…' : unavailable ? 'Contactless unavailable' : state === 'setup_failed' ? 'Resolve setup & collect' : 'Collect contactless'}
                </button>
              );
            })()}
            {!tapAvailabilityLoading && !tapAvailabilityReady ? (
              <p className="mt-2 text-xs text-amber-700">{tapAvailabilityReason || 'Tap to Pay is not ready on this account/device.'}</p>
            ) : null}
            {!nativeReadinessLoading && !nativeReadinessReady ? (
              <p className="mt-2 text-xs text-amber-700">{nativeReadinessReason || 'Location permission and location services are required.'}</p>
            ) : null}
            {isBelowMinimumAmount ? <p className="mt-2 text-xs text-rose-700">{minimumAmountMessage}</p> : null}
            {state === 'failed' || state === 'canceled' ? <p className="mt-2 text-xs text-rose-700">{message}</p> : null}
            {busy ? (
              <button
                type="button"
                disabled={!activeSessionId}
                onClick={handleCancel}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel session
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {showOrdersSheet ? (
        <div className="absolute inset-0 z-20 flex items-start justify-end bg-gray-900/20 p-3 sm:p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
              <p className="text-sm font-semibold text-gray-900">Unpaid orders</p>
              <button
                type="button"
                onClick={() => setShowOrdersSheet(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close unpaid orders"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2 max-h-[56vh] space-y-2 overflow-y-auto pr-1">
              {loadingOrders ? <p className="px-1 py-2 text-xs text-gray-500">Loading orders…</p> : null}
              {!loadingOrders && orders.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  No unpaid active orders right now.
                </p>
              ) : null}
              {orders.map((order) => {
                const active = selectedOrderId === order.id;
                return (
                  <button
                    key={order.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handleSelectOrder(order.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      active ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">#{order.short_order_number ?? '—'} · {order.customer_name || 'Guest'}</p>
                      <p className="text-sm font-semibold text-gray-900">{formatPrice(Number(order.total_price_cents || 0) / 100)}</p>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.08em] text-gray-500">{order.status}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
