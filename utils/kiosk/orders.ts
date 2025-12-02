const REAL_ORDER_NUMBER_EVENT = 'kiosk:real-order-number';

function orderNumberKey(restaurantId?: string | null) {
  return restaurantId ? `kioskLastRealOrderNumber_${restaurantId}` : null;
}

export function setKioskLastRealOrderNumber(restaurantId: string | null | undefined, orderNumber: number) {
  const key = orderNumberKey(restaurantId);
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(orderNumber));
  } catch {
    // ignore storage failures
  }
  try {
    window.dispatchEvent(
      new CustomEvent(REAL_ORDER_NUMBER_EVENT, {
        detail: { restaurantId, orderNumber },
      })
    );
  } catch {
    // ignore event failures
  }
}

export function getKioskLastRealOrderNumber(restaurantId: string | null | undefined): number | null {
  const key = orderNumberKey(restaurantId);
  if (!key || typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;
    const parsed = Number.parseInt(stored, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export const KIOSK_REAL_ORDER_NUMBER_EVENT = REAL_ORDER_NUMBER_EVENT;
