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

export const resolveNativeTapToPayUiPhase = (state: string): NativeTapToPayUiPhase => {
  if (state === 'bootstrapping') return 'checking_readiness';
  if (state === 'preparing') return 'preparing_native';
  if (state === 'handover') return 'handover_to_stripe';
  if (state === 'collecting') return 'stripe_live_payment';
  if (state === 'processing') return 'processing_returned_result';
  if (state === 'verifying') return 'verifying_paid_outcome';
  if (state === 'finalizing') return 'finalizing_session';
  if (state === 'completing_success') return 'completing_success_transition';
  if (state === 'completed' || state === 'succeeded') return 'success_destination';
  if (state === 'canceled') return 'canceled_destination';
  if (
    state === 'failed' ||
    state === 'permission_denied' ||
    state === 'unsupported_device' ||
    state === 'setup_failed' ||
    state === 'location_services_disabled'
  ) {
    return 'failed_destination';
  }
  return 'bootstrapping';
};

export const isNativeTapToPayOverlayVisiblePhase = (state: string) => {
  const phase = resolveNativeTapToPayUiPhase(state);
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

export const isNativeTapToPayCancelableOverlayPhase = (state: string) => {
  const phase = resolveNativeTapToPayUiPhase(state);
  return phase !== 'stripe_live_payment' && isNativeTapToPayOverlayVisiblePhase(state);
};

export const canCloseNativeTapToPayPreHandoverOverlay = ({
  state,
  inCancelTransition = false,
  inSuccessTransition = false,
  preHandoverOverlayOwned = false,
}: {
  state: string;
  inCancelTransition?: boolean;
  inSuccessTransition?: boolean;
  preHandoverOverlayOwned?: boolean;
}) => {
  if (inCancelTransition || inSuccessTransition) return false;
  if (preHandoverOverlayOwned) return true;
  return isNativeTapToPayCancelableOverlayPhase(state);
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
