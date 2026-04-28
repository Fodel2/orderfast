export type NativeTapToPayUiPhase =
  | 'bootstrapping'
  | 'checking_readiness'
  | 'preparing_native'
  | 'handover_to_stripe'
  | 'stripe_live_payment'
  | 'processing_returned_result'
  | 'verifying_paid_outcome'
  | 'finalizing_session'
  | 'completing_success_transition'
  | 'success_destination'
  | 'canceled_destination'
  | 'failed_destination';

const CANCELED_STATE_ALIASES = new Set([
  'canceled',
  'cancelled',
  'canceled_by_user',
  'cancelled_by_user',
  'user_canceled',
  'user_cancelled',
  'payment_canceled',
  'payment_cancelled',
  'cancelled_payment',
  'canceled_payment',
  'customer_cancelled',
  'app_cancelled',
]);

const canonicalizeState = (state: string | null | undefined) =>
  String(state || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

export const normalizeNativeTapToPayState = (
  state: string | null | undefined,
  options?: { hasReturnedFromNative?: boolean }
) => {
  const normalized = canonicalizeState(state);
  if (!normalized) return options?.hasReturnedFromNative ? 'failed' : 'bootstrapping';
  if (CANCELED_STATE_ALIASES.has(normalized)) return 'canceled';
  if (normalized === 'completed') return 'completed';
  if (normalized === 'succeeded') return 'succeeded';
  if (normalized === 'success') return 'succeeded';
  if (normalized === 'preparing_native') return 'preparing';
  if (normalized === 'ready' || normalized === 'idle') return 'bootstrapping';
  if (normalized === 'error') return 'failed';
  if (normalized === 'unknown' || normalized === 'unavailable') {
    return options?.hasReturnedFromNative ? 'failed' : 'bootstrapping';
  }
  if (normalized === 'bootstrapping') return 'bootstrapping';
  if (normalized === 'preparing') return 'preparing';
  if (normalized === 'handover') return 'handover';
  if (normalized === 'collecting') return 'collecting';
  if (normalized === 'processing') return 'processing';
  if (normalized === 'verifying') return 'verifying';
  if (normalized === 'finalizing') return 'finalizing';
  if (normalized === 'completing_success') return 'completing_success';
  if (
    normalized === 'failed' ||
    normalized === 'permission_denied' ||
    normalized === 'unsupported_device' ||
    normalized === 'setup_failed' ||
    normalized === 'location_services_disabled'
  ) {
    return normalized;
  }
  return options?.hasReturnedFromNative ? 'failed' : 'bootstrapping';
};

export const resolveNativeTapToPayUiPhase = (
  state: string,
  options?: { hasReturnedFromNative?: boolean }
): NativeTapToPayUiPhase => {
  const normalized = normalizeNativeTapToPayState(state, options);
  if (normalized === 'bootstrapping') return 'checking_readiness';
  if (normalized === 'preparing') return 'preparing_native';
  if (normalized === 'handover') return 'handover_to_stripe';
  if (normalized === 'collecting') return 'stripe_live_payment';
  if (normalized === 'processing') return 'processing_returned_result';
  if (normalized === 'verifying') return 'verifying_paid_outcome';
  if (normalized === 'finalizing') return 'finalizing_session';
  if (normalized === 'completing_success') return 'completing_success_transition';
  if (normalized === 'completed' || normalized === 'succeeded') return 'success_destination';
  if (normalized === 'canceled') return 'canceled_destination';
  if (
    normalized === 'failed' ||
    normalized === 'permission_denied' ||
    normalized === 'unsupported_device' ||
    normalized === 'setup_failed' ||
    normalized === 'location_services_disabled'
  ) {
    return 'failed_destination';
  }
  return options?.hasReturnedFromNative ? 'failed_destination' : 'bootstrapping';
};

export const isNativeTapToPayOverlayVisiblePhase = (state: string, options?: { hasReturnedFromNative?: boolean }) => {
  const phase = resolveNativeTapToPayUiPhase(state, options);
  return (
    phase === 'checking_readiness' ||
    phase === 'preparing_native' ||
    phase === 'handover_to_stripe' ||
    phase === 'processing_returned_result' ||
    phase === 'verifying_paid_outcome' ||
    phase === 'finalizing_session' ||
    phase === 'completing_success_transition'
  );
};

export const isNativeTapToPayTerminalPhase = (state: string) => {
  const phase = resolveNativeTapToPayUiPhase(state);
  return phase === 'success_destination' || phase === 'canceled_destination' || phase === 'failed_destination';
};

export const isNativeTapToPayCancelableOverlayPhase = (state: string, options?: { hasReturnedFromNative?: boolean }) => {
  const phase = resolveNativeTapToPayUiPhase(state, options);
  return phase !== 'stripe_live_payment' && isNativeTapToPayOverlayVisiblePhase(state, options);
};

export const canCloseNativeTapToPayPreHandoverOverlay = ({
  state,
  inCancelTransition = false,
  inSuccessTransition = false,
  preHandoverOverlayOwned = false,
  hasReturnedFromNative = false,
}: {
  state: string;
  inCancelTransition?: boolean;
  inSuccessTransition?: boolean;
  preHandoverOverlayOwned?: boolean;
  hasReturnedFromNative?: boolean;
}) => {
  if (inCancelTransition || inSuccessTransition) return false;
  if (preHandoverOverlayOwned) return true;
  return isNativeTapToPayCancelableOverlayPhase(state, { hasReturnedFromNative });
};

export const PRE_HANDOVER_PROGRESS_LINES = [
  'Warming up the payment rails…',
  'Calling in the tap-to-pay orchestra…',
  'Polishing the card reader vibes…',
  'Securing a smooth handoff to Stripe…',
];

export const POST_HANDOVER_PROGRESS_LINES = [
  'Verifying the result with Stripe…',
  'Locking in payment confirmation…',
  'Wrapping up the final settlement steps…',
  'Adding the final success sparkle…',
];
