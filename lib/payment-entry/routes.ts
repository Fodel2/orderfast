export const buildKioskPaymentEntryPath = (restaurantId: string) =>
  `/kiosk/${encodeURIComponent(restaurantId)}/payment-entry`;

export const buildPosPaymentEntryPath = (restaurantId: string, source: 'pos' | 'launcher' = 'pos') =>
  `/pos/${encodeURIComponent(restaurantId)}/payment-entry?source=${source}`;
