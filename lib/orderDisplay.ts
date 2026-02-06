import { DEFAULT_CURRENCY_CODE, formatCurrency } from './currency';

export function displayOrderNo(order: any): string {
  // prefer explicit short/sequence numbers if present
  const n =
    order?.number ??
    order?.display_number ??
    order?.short_number ??
    order?.order_no ??
    order?.sequence ??
    null;
  if (n) return `#${String(n)}`;
  // fallback: derive from id deterministically so it stays stable
  const id = String(order?.id ?? '');
  const tail = id.replace(/[^0-9]/g,'').slice(-4) || id.slice(0,6);
  return `#${tail}`;
}

export function formatShortOrderNumber(value: number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return String(Math.trunc(value)).padStart(4, '0');
  }
  return '—';
}

export function formatStatusLabel(status: string | null | undefined) {
  if (!status) return '';
  return status
    .split('_')
    .map((word) => {
      const lower = word.toLowerCase();
      return lower ? lower[0].toUpperCase() + lower.slice(1) : '';
    })
    .filter(Boolean)
    .join(' ');
}

export function formatPrice(amount: number, currencyCode: string = DEFAULT_CURRENCY_CODE) {
  const normalized = normalizePriceValue(amount);
  return formatCurrency(normalized, currencyCode);
}

export function normalizePriceValue(amount: number) {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount || 0);
  if (!Number.isFinite(numericAmount)) return 0;
  return numericAmount;
}

export function calculateCartTotals(
  cartItems:
    | Array<{
        price: number;
        quantity: number;
        addons?: Array<{ price: number; quantity: number }>;
      }>
    | null
    | undefined
) {
  let itemSubtotal = 0;
  let addonSubtotal = 0;

  for (const item of cartItems || []) {
    const itemPrice = Number(item?.price) || 0;
    const quantity = Number(item?.quantity) || 0;
    itemSubtotal += itemPrice * quantity;

    if (Array.isArray(item?.addons)) {
      for (const addon of item.addons) {
        const addonPrice = Number(addon?.price) || 0;
        const addonQty = Number(addon?.quantity) || 0;
        addonSubtotal += addonPrice * addonQty * quantity;
      }
    }
  }

  const total = itemSubtotal + addonSubtotal;

  return { itemSubtotal, addonSubtotal, total };
}

export function extractCancelReason(order: any): { reason?: string; note?: string } {
  const reason =
    order?.cancel_reason ??
    order?.cancellation_reason ??
    order?.reject_reason ??
    order?.rejection_reason ??
    order?.reason ??
    undefined;
  const note =
    order?.cancel_comment ??
    order?.cancellation_note ??
    order?.reject_comment ??
    order?.rejection_comment ??
    order?.comment ??
    order?.note ??
    undefined;
  return { reason, note };
}
