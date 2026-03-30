export const buildKioskPaymentEntryPath = (restaurantId: string) =>
  `/kiosk/${encodeURIComponent(restaurantId)}/payment-entry`;

export const buildPosPaymentEntryPath = (restaurantId: string) =>
  `/pos/${encodeURIComponent(restaurantId)}/payment-entry`;
