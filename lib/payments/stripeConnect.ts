export type StripeConnectionStatus = 'not_connected' | 'setup_incomplete' | 'under_review' | 'restricted' | 'connected';

export type StripeConnectionSnapshot = {
  stripe_connected_account_id: string | null;
  onboarding_status: StripeConnectionStatus;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_currently_due: string[];
  requirements_pending_verification: string[];
  disabled_reason: string | null;
  terminal_location_id: string | null;
  onboarding_completed_at: string | null;
  last_synced_at: string | null;
};

export type StripeConnectionReadiness = {
  status: StripeConnectionStatus;
  heading: string;
  description: string;
  can_process_card_payments: boolean;
  tap_to_pay_available: boolean;
  primary_action: 'connect' | 'continue_setup' | 'refresh_status' | 'manage_stripe';
};

const pendingVerificationReasons = ['pending_verification', 'listed', 'under_review'];

export const deriveStripeConnectionStatus = (snapshot: StripeConnectionSnapshot): StripeConnectionStatus => {
  if (!snapshot.stripe_connected_account_id) return 'not_connected';

  if (snapshot.disabled_reason) {
    const looksLikeReview = pendingVerificationReasons.some((reason) =>
      snapshot.disabled_reason?.toLowerCase().includes(reason)
    );
    return looksLikeReview ? 'under_review' : 'restricted';
  }

  if (snapshot.charges_enabled && snapshot.payouts_enabled) return 'connected';

  if (snapshot.requirements_pending_verification.length > 0 && snapshot.requirements_currently_due.length === 0) {
    return 'under_review';
  }

  return 'setup_incomplete';
};

export const deriveStripeReadiness = (snapshot: StripeConnectionSnapshot): StripeConnectionReadiness => {
  const status = deriveStripeConnectionStatus(snapshot);

  if (status === 'not_connected') {
    return {
      status,
      heading: 'Not connected',
      description: 'Connect Stripe to accept card payments and prepare Tap to Pay.',
      can_process_card_payments: false,
      tap_to_pay_available: false,
      primary_action: 'connect',
    };
  }

  if (status === 'connected') {
    return {
      status,
      heading: 'Connected and ready',
      description: 'Your Stripe account is ready for card payments for this restaurant.',
      can_process_card_payments: true,
      tap_to_pay_available: true,
      primary_action: 'manage_stripe',
    };
  }

  if (status === 'under_review') {
    return {
      status,
      heading: 'Under review',
      description: 'Stripe is reviewing your details. Card payments and Tap to Pay stay locked until approved.',
      can_process_card_payments: false,
      tap_to_pay_available: false,
      primary_action: 'refresh_status',
    };
  }

  if (status === 'restricted') {
    return {
      status,
      heading: 'Restricted',
      description: 'Stripe has restrictions on this account. Complete requested steps to enable payments.',
      can_process_card_payments: false,
      tap_to_pay_available: false,
      primary_action: 'continue_setup',
    };
  }

  return {
    status: 'setup_incomplete',
    heading: 'Setup incomplete',
    description: 'Finish Stripe setup before card payments and Tap to Pay can be enabled.',
    can_process_card_payments: false,
    tap_to_pay_available: false,
    primary_action: 'continue_setup',
  };
};
