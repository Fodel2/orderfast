type NativePreHandoverPhase =
  | 'bootstrapping'
  | 'checking_readiness'
  | 'preparing_native'
  | 'handover_to_stripe'
  | 'stripe_live_payment'
  | 'success'
  | 'canceled'
  | 'failed';

export const resolveNativeTapToPayUiPhase = (state: string): NativePreHandoverPhase => {
  if (state === 'bootstrapping') return 'checking_readiness';
  if (state === 'preparing') return 'preparing_native';
  if (state === 'handover') return 'handover_to_stripe';
  if (state === 'collecting' || state === 'processing' || state === 'finalizing') return 'stripe_live_payment';
  if (state === 'completed' || state === 'succeeded') return 'success';
  if (state === 'canceled') return 'canceled';
  if (state === 'failed' || state === 'permission_denied' || state === 'unsupported_device' || state === 'setup_failed' || state === 'location_services_disabled') {
    return 'failed';
  }
  return 'bootstrapping';
};

export const isNativeTapToPayPreHandoverPhase = (state: string) => {
  const phase = resolveNativeTapToPayUiPhase(state);
  return phase === 'checking_readiness' || phase === 'preparing_native' || phase === 'handover_to_stripe';
};
