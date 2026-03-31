import { getStripeConnectionStatus } from './stripeConnectService';

export type RestaurantStripeContext = {
  restaurantId: string;
  connectedAccountId: string;
  terminalLocationId: string | null;
  canProcessCardPayments: boolean;
  tapToPayAvailable: boolean;
};

export const getRestaurantStripeContext = async (restaurantId: string): Promise<RestaurantStripeContext | null> => {
  const { snapshot, readiness } = await getStripeConnectionStatus(restaurantId);
  if (!snapshot.stripe_connected_account_id) return null;

  return {
    restaurantId,
    connectedAccountId: snapshot.stripe_connected_account_id,
    terminalLocationId: snapshot.terminal_location_id,
    canProcessCardPayments: readiness.can_process_card_payments,
    tapToPayAvailable: readiness.tap_to_pay_available,
  };
};
