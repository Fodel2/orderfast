import { formatCurrency } from '@/lib/currency';

type PromotionLike = {
  type?: string | null;
  channels?: string[] | null;
  order_types?: string[] | null;
  min_subtotal?: number | string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_recurring?: boolean | null;
  days_of_week?: number[] | null;
  time_window_start?: string | null;
  time_window_end?: string | null;
  new_customer_only?: boolean | null;
  max_uses_total?: number | string | null;
  max_uses_per_customer?: number | string | null;
};

type RewardPayload = {
  discount_type?: 'percent' | 'fixed' | string | null;
  discount_value?: number | string | null;
  max_discount_cap?: number | string | null;
  delivery_fee_cap?: number | string | null;
  free_delivery_min_subtotal?: number | string | null;
} | null;

type VoucherMeta = {
  max_uses_total?: number | string | null;
  max_uses_per_customer?: number | string | null;
} | null;

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatMoney = (value: unknown): string | null => {
  const parsed = parseNumber(value);
  if (parsed == null) return null;
  return formatCurrency(parsed);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return null;
  const bits = value.split(':');
  if (bits.length < 2) return null;
  const hh = Number(bits[0]);
  const mm = Number(bits[1]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  const date = new Date();
  date.setHours(hh, mm, 0, 0);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const toTitle = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function buildPromotionTermsPreview(
  promo: PromotionLike | null | undefined,
  rewardPayload?: RewardPayload,
  voucherMeta?: VoucherMeta
): string[] {
  const safePromo = promo || {};
  const safeReward = rewardPayload || {};
  const bullets: string[] = [];

  const channels = (safePromo.channels || []).filter(Boolean);
  if (channels.length) {
    bullets.push(`Applies on: ${channels.map((entry) => toTitle(String(entry))).join(', ')}.`);
  }

  const orderTypes = (safePromo.order_types || []).filter(Boolean);
  if (orderTypes.length) {
    bullets.push(`Order types: ${orderTypes.map((entry) => toTitle(String(entry))).join(', ')}.`);
  }

  const minSubtotal = formatMoney(safePromo.min_subtotal);
  if (minSubtotal) {
    bullets.push(`Minimum spend: ${minSubtotal}.`);
  }

  if (safePromo.is_recurring) {
    const dayLabels = (safePromo.days_of_week || [])
      .map((day) => (typeof day === 'number' && day >= 0 && day <= 6 ? DAY_LABELS[day] : null))
      .filter((day): day is string => !!day);
    const start = formatTime(safePromo.time_window_start);
    const end = formatTime(safePromo.time_window_end);
    if (dayLabels.length && start && end) {
      bullets.push(`Runs on ${dayLabels.join(', ')} from ${start} to ${end}.`);
    } else if (dayLabels.length) {
      bullets.push(`Runs on ${dayLabels.join(', ')}.`);
    }
  } else {
    const startsAt = formatDateTime(safePromo.starts_at);
    const endsAt = formatDateTime(safePromo.ends_at);
    if (startsAt && endsAt) bullets.push(`Valid from ${startsAt} to ${endsAt}.`);
    else if (startsAt) bullets.push(`Starts ${startsAt}.`);
    else if (endsAt) bullets.push(`Ends ${endsAt}.`);
  }

  if (safePromo.new_customer_only) {
    bullets.push('New customers only.');
  }

  const maxUsesTotal = parseNumber(safePromo.max_uses_total);
  if (maxUsesTotal != null && maxUsesTotal > 0) {
    bullets.push(`Limited to ${maxUsesTotal} total uses.`);
  }

  const maxUsesPerCustomer = parseNumber(safePromo.max_uses_per_customer);
  if (maxUsesPerCustomer != null && maxUsesPerCustomer > 0) {
    bullets.push(`Limit ${maxUsesPerCustomer} use${maxUsesPerCustomer === 1 ? '' : 's'} per customer.`);
  }

  if (safePromo.type === 'voucher') {
    bullets.push('Voucher code required.');
    const voucherMaxTotal = parseNumber(voucherMeta?.max_uses_total);
    const voucherMaxPerCustomer = parseNumber(voucherMeta?.max_uses_per_customer);
    if (voucherMaxTotal === 1 || voucherMaxPerCustomer === 1) {
      bullets.push('Single-use voucher.');
    }
  }

  const deliveryFeeCap = formatMoney(safeReward.delivery_fee_cap);
  if (deliveryFeeCap) {
    bullets.push(`Delivery discount up to ${deliveryFeeCap}.`);
  }

  const freeDeliveryMin = formatMoney(safeReward.free_delivery_min_subtotal);
  if (freeDeliveryMin) {
    bullets.push(`Free delivery when basket is at least ${freeDeliveryMin}.`);
  }

  const discountType = safeReward.discount_type;
  const discountValue = parseNumber(safeReward.discount_value);
  const maxDiscountCap = formatMoney(safeReward.max_discount_cap);
  if (discountType === 'percent' && discountValue != null) {
    bullets.push(maxDiscountCap ? `${discountValue}% off basket (max ${maxDiscountCap}).` : `${discountValue}% off basket.`);
  }
  if (discountType === 'fixed' && discountValue != null) {
    const formatted = formatMoney(discountValue);
    if (formatted) bullets.push(`${formatted} off basket.`);
  }

  return bullets.slice(0, 7);
}
