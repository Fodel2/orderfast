export const KIOSK_CARD_PRESENT_SESSION_STATES = [
  'created',
  'readiness_verified',
  'native_preparing',
  'ready_to_collect',
  'collecting',
  'processing',
  'succeeded',
  'failed',
  'canceled',
  'finalized',
  'needs_reconciliation',
] as const;

export type KioskCardPresentSessionState = (typeof KIOSK_CARD_PRESENT_SESSION_STATES)[number];

export type KioskCardPresentSession = {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  amount_cents: number;
  currency: string;
  state: KioskCardPresentSessionState;
  stripe_connected_account_id: string | null;
  stripe_terminal_location_id: string | null;
  stripe_payment_intent_id: string | null;
  idempotency_key: string;
  kiosk_install_id: string | null;
  failure_code: string | null;
  failure_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
};

export const KIOSK_CARD_PRESENT_ACTIVE_STATES: ReadonlySet<KioskCardPresentSessionState> = new Set([
  'created',
  'readiness_verified',
  'native_preparing',
  'ready_to_collect',
  'collecting',
  'processing',
  'needs_reconciliation',
]);
