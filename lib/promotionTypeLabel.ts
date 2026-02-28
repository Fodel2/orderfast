const PROMOTION_TYPE_LABELS: Record<string, string> = {
  basket_discount: 'Basket Discount',
  delivery_promo: 'Free Delivery',
  voucher: 'Voucher',
};

export function formatPromotionTypeLabel(type: string | null | undefined) {
  const value = String(type || '').trim();
  if (!value) return 'Promotion';
  if (PROMOTION_TYPE_LABELS[value]) return PROMOTION_TYPE_LABELS[value];

  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
