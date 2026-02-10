export type ExpressMode = 'takeaway' | 'dine_in';

export type ExpressSession = {
  mode: ExpressMode;
  tableNumber?: number | null;
  tableSessionId?: string | null;
  dineInPaymentMode?: 'immediate_pay' | 'open_tab';
  restaurantId?: string | null;
};

const KEY = 'orderfast_express_session';

export function getExpressSession(): ExpressSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExpressSession;
  } catch {
    return null;
  }
}

export function setExpressSession(session: ExpressSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearExpressSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}

export function isExpressDineInForRestaurant(restaurantId?: string | null) {
  const session = getExpressSession();
  return (
    !!session &&
    session.mode === 'dine_in' &&
    !!session.tableNumber &&
    (!restaurantId || !session.restaurantId || session.restaurantId === restaurantId)
  );
}
