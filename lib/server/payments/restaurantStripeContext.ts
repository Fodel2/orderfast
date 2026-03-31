import { getStripeConnectionStatus } from './stripeConnectService';

export type RestaurantStripeContext = {
  restaurantId: string;
  connectedAccountId: string;
  terminalLocationId: string | null;
  canProcessCardPayments: boolean;
  tapToPayAvailable: boolean;
  paymentReadinessStatus:
    | 'not_connected'
    | 'stripe_setup_incomplete'
    | 'terminal_not_configured'
    | 'terminal_pending'
    | 'tap_to_pay_ready'
    | 'temporarily_unavailable';
  paymentReadinessReason: string;
};

export const getRestaurantStripeContext = async (restaurantId: string): Promise<RestaurantStripeContext | null> => {
  const { snapshot, readiness, paymentReadiness } = await getStripeConnectionStatus(restaurantId);
  if (!snapshot.stripe_connected_account_id) return null;

  return {
    restaurantId,
    connectedAccountId: snapshot.stripe_connected_account_id,
    terminalLocationId: snapshot.stripe_terminal_location_id ?? snapshot.terminal_location_id,
    canProcessCardPayments: readiness.can_process_card_payments,
    tapToPayAvailable: paymentReadiness.tap_to_pay_available,
    paymentReadinessStatus: paymentReadiness.status,
    paymentReadinessReason: paymentReadiness.description,
  };
};

export const isTapToPayAvailableForRestaurant = async (restaurantId: string): Promise<boolean> => {
  const context = await getRestaurantStripeContext(restaurantId);
  return !!context?.tapToPayAvailable;
};
