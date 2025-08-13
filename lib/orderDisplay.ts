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
