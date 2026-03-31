export type StripeConnectionStatus = 'not_connected' | 'setup_incomplete' | 'under_review' | 'restricted' | 'connected';

export type TerminalReadinessStatus =
  | 'not_connected'
  | 'stripe_setup_incomplete'
  | 'terminal_not_configured'
  | 'terminal_pending'
  | 'tap_to_pay_ready'
  | 'temporarily_unavailable';

export type StripeConnectionSnapshot = {
  stripe_connected_account_id: string | null;
  onboarding_status: StripeConnectionStatus;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  card_payments_capability: string | null;
  transfers_capability: string | null;
  requirements_currently_due: string[];
  requirements_eventually_due: string[];
  requirements_past_due: string[];
  requirements_pending_verification: string[];
  disabled_reason: string | null;
  terminal_location_id: string | null;
  stripe_terminal_location_id: string | null;
  stripe_terminal_location_display_name: string | null;
  terminal_readiness_status: TerminalReadinessStatus;
  terminal_readiness_reason: string | null;
  onboarding_completed_at: string | null;
  last_synced_at: string | null;
  terminal_last_checked_at: string | null;
  terminal_last_synced_at: string | null;
};

export type StripeConnectionReadiness = {
  status: StripeConnectionStatus;
  heading: string;
  description: string;
  can_process_card_payments: boolean;
  tap_to_pay_available: boolean;
  primary_action: 'connect' | 'continue_setup' | 'refresh_status' | 'manage_stripe';
};

export type TerminalPaymentReadiness = {
  status: TerminalReadinessStatus;
  heading: string;
  description: string;
  tap_to_pay_available: boolean;
  recommended_action: 'connect_stripe' | 'finish_stripe_setup' | 'prepare_tap_to_pay' | 'refresh_status' | 'temporarily_unavailable';
};

const pendingVerificationReasons = ['pending_verification', 'listed', 'under_review'];
const toHumanField = (value: string) => value.replace(/\./g, ' → ').replace(/_/g, ' ');

const buildRequirementsReason = (snapshot: StripeConnectionSnapshot) => {
  const dueNow = snapshot.requirements_currently_due.slice(0, 2).map(toHumanField);
  const pastDue = snapshot.requirements_past_due.slice(0, 2).map(toHumanField);
  const pending = snapshot.requirements_pending_verification.slice(0, 2).map(toHumanField);

  if (dueNow.length > 0) {
    return `Stripe still needs: ${dueNow.join(', ')}.`;
  }

  if (pastDue.length > 0) {
    return `Stripe marked these items past due: ${pastDue.join(', ')}.`;
  }

  if (pending.length > 0) {
    return `Stripe is reviewing: ${pending.join(', ')}.`;
  }

  if (snapshot.disabled_reason) {
    return 'Stripe has temporarily restricted this account until required updates are completed.';
  }

  return null;
};

export const deriveStripeConnectionStatus = (snapshot: StripeConnectionSnapshot): StripeConnectionStatus => {
  if (!snapshot.stripe_connected_account_id) return 'not_connected';

  if (snapshot.disabled_reason) {
    const looksLikeReview = pendingVerificationReasons.some((reason) =>
      snapshot.disabled_reason?.toLowerCase().includes(reason)
    );
    return looksLikeReview ? 'under_review' : 'restricted';
  }

  if (
    snapshot.charges_enabled &&
    snapshot.payouts_enabled &&
    snapshot.card_payments_capability === 'active' &&
    snapshot.transfers_capability === 'active'
  ) {
    return 'connected';
  }

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
      description: 'Connect Stripe to accept card payments and configure Tap to Pay readiness.',
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
      tap_to_pay_available: false,
      primary_action: 'manage_stripe',
    };
  }

  if (status === 'under_review') {
    const requirementReason = buildRequirementsReason(snapshot);
    return {
      status,
      heading: 'Under review',
      description:
        requirementReason || 'Stripe is reviewing your details. Card payments and Tap to Pay stay locked until approved.',
      can_process_card_payments: false,
      tap_to_pay_available: false,
      primary_action: 'refresh_status',
    };
  }

  if (status === 'restricted') {
    const requirementReason = buildRequirementsReason(snapshot);
    return {
      status,
      heading: 'Restricted',
      description: requirementReason || 'Stripe has restrictions on this account. Complete requested steps to enable payments.',
      can_process_card_payments: false,
      tap_to_pay_available: false,
      primary_action: 'continue_setup',
    };
  }

  return {
    status: 'setup_incomplete',
    heading: 'Setup incomplete',
    description: buildRequirementsReason(snapshot) || 'Finish Stripe setup before card payments and Tap to Pay can be enabled.',
    can_process_card_payments: false,
    tap_to_pay_available: false,
    primary_action: 'continue_setup',
  };
};

export const deriveTerminalPaymentReadiness = (snapshot: StripeConnectionSnapshot): TerminalPaymentReadiness => {
  if (!snapshot.stripe_connected_account_id) {
    return {
      status: 'not_connected',
      heading: 'Not connected to Stripe',
      description: 'Connect Stripe first to start Tap to Pay setup.',
      tap_to_pay_available: false,
      recommended_action: 'connect_stripe',
    };
  }

  if (snapshot.onboarding_status === 'setup_incomplete' || snapshot.onboarding_status === 'under_review') {
    return {
      status: 'stripe_setup_incomplete',
      heading: 'Stripe setup incomplete',
      description: buildRequirementsReason(snapshot) || 'Finish Stripe verification before Tap to Pay setup can be completed.',
      tap_to_pay_available: false,
      recommended_action: 'finish_stripe_setup',
    };
  }

  if (snapshot.onboarding_status === 'restricted' || snapshot.disabled_reason) {
    return {
      status: 'temporarily_unavailable',
      heading: 'Temporarily unavailable',
      description: buildRequirementsReason(snapshot) || 'Tap to Pay is paused until Stripe restrictions are cleared.',
      tap_to_pay_available: false,
      recommended_action: 'temporarily_unavailable',
    };
  }

  if (!snapshot.stripe_terminal_location_id) {
    return {
      status: 'terminal_not_configured',
      heading: 'Terminal not configured',
      description: 'Set up Tap to Pay readiness to create your restaurant terminal location.',
      tap_to_pay_available: false,
      recommended_action: 'prepare_tap_to_pay',
    };
  }

  if (snapshot.terminal_readiness_status === 'terminal_pending') {
    return {
      status: 'terminal_pending',
      heading: 'Terminal readiness pending',
      description: snapshot.terminal_readiness_reason || 'Terminal setup is still syncing. Check again in a moment.',
      tap_to_pay_available: false,
      recommended_action: 'refresh_status',
    };
  }

  if (snapshot.terminal_readiness_status === 'tap_to_pay_ready') {
    return {
      status: 'tap_to_pay_ready',
      heading: 'Ready for Tap to Pay',
      description: 'This restaurant is configured and ready for kiosk Tap to Pay checkout.',
      tap_to_pay_available: true,
      recommended_action: 'refresh_status',
    };
  }

  return {
    status: 'terminal_pending',
    heading: 'Connected and pending Terminal readiness',
    description: snapshot.terminal_readiness_reason || 'We are checking your Terminal setup.',
    tap_to_pay_available: false,
    recommended_action: 'refresh_status',
  };
};
