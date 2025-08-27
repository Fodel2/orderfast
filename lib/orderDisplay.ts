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

export function formatPrice(amount: number, currency = 'GBP') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `£${Number(amount).toFixed(2)}`;
  }
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
