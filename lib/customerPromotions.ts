import { supabase } from '@/utils/supabaseClient';

export type PromotionListItem = {
  id: string;
  name: string;
  type: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  min_subtotal: number | null;
  is_currently_valid: boolean;
  next_available_at: string | null;
  invalid_reason: string | null;
};

export type ActivePromotionSelection = {
  promotion_id: string;
  type: string;
  promotion_name?: string | null;
  voucher_code?: string | null;
  selected_at: string;
};

export type PromotionValidationResult = {
  valid: boolean;
  reason: string | null;
  discount_amount: number;
  delivery_discount_amount: number;
};


export type VoucherPromotionLookup = {
  promotion_id: string;
  promotion_name: string | null;
  promotion_type: string | null;
};

const guestKey = (restaurantId: string) => `orderfast_guest_customer_${restaurantId}`;
const activePromoKey = (restaurantId: string) => `orderfast_active_promotion_${restaurantId}`;
const appliedPromoKey = (restaurantId: string) => `orderfast_applied_promotions_${restaurantId}`;
const checkoutBlockKey = (restaurantId: string) => `orderfast_promo_block_${restaurantId}`;

function makeUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getStableGuestCustomerId(restaurantId: string) {
  if (typeof window === 'undefined') return null;
  const key = guestKey(restaurantId);
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = makeUuid();
  window.localStorage.setItem(key, next);
  return next;
}

export function getActivePromotionSelection(restaurantId: string): ActivePromotionSelection | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(activePromoKey(restaurantId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActivePromotionSelection;
  } catch {
    return null;
  }
}

export function getAppliedPromotionIds(restaurantId: string): string[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(appliedPromoKey(restaurantId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function setAppliedPromotionIds(restaurantId: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  const unique = Array.from(new Set(ids.filter(Boolean)));
  window.localStorage.setItem(appliedPromoKey(restaurantId), JSON.stringify(unique));
}

export function addAppliedPromotionId(restaurantId: string, promotionId: string) {
  const next = Array.from(new Set([...getAppliedPromotionIds(restaurantId), promotionId]));
  setAppliedPromotionIds(restaurantId, next);
}

export function removeAppliedPromotionId(restaurantId: string, promotionId: string) {
  const next = getAppliedPromotionIds(restaurantId).filter((id) => id !== promotionId);
  setAppliedPromotionIds(restaurantId, next);
}

export function setActivePromotionSelection(restaurantId: string, selection: ActivePromotionSelection) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(activePromoKey(restaurantId), JSON.stringify(selection));
}

export function clearActivePromotionSelection(restaurantId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(activePromoKey(restaurantId));
}

export function setPromotionCheckoutBlock(
  restaurantId: string,
  payload: { reason: string; details?: string }
) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(checkoutBlockKey(restaurantId), JSON.stringify(payload));
}

export function consumePromotionCheckoutBlock(restaurantId: string): { reason: string; details?: string } | null {
  if (typeof window === 'undefined') return null;
  const key = checkoutBlockKey(restaurantId);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  window.localStorage.removeItem(key);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function fetchCustomerPromotions(params: {
  restaurantId: string;
  customerId: string;
  orderType: string;
  basketSubtotal: number | null;
}) {
  const { data, error } = await supabase.rpc('get_active_promotions_for_customer', {
    p_restaurant_id: params.restaurantId,
    p_customer_id: params.customerId,
    p_now_ts: new Date().toISOString(),
    p_channel: 'website',
    p_order_type: params.orderType,
    p_basket_subtotal: params.basketSubtotal,
  });

  if (error) throw error;
  return (data || []) as PromotionListItem[];
}


export async function resolveVoucherPromotionByCode(params: {
  restaurantId: string;
  code: string;
}) {
  const normalizedCode = params.code.trim().toLowerCase();
  if (!normalizedCode) return null;

  const { data, error } = await supabase
    .from('promotion_voucher_codes')
    .select('promotion_id,promotions!inner(id,restaurant_id,name,type)')
    .eq('code_normalized', normalizedCode)
    .eq('promotions.restaurant_id', params.restaurantId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.promotion_id) return null;

  const promotion = Array.isArray(data.promotions) ? data.promotions[0] : data.promotions;

  return {
    promotion_id: data.promotion_id,
    promotion_name: (promotion?.name as string | undefined) || null,
    promotion_type: (promotion?.type as string | undefined) || null,
  } as VoucherPromotionLookup;
}

export async function validatePromotion(params: {
  restaurantId: string;
  customerId: string;
  promotionId: string;
  voucherCode?: string | null;
  orderType: string;
  basketSubtotal: number;
  deliveryFee: number;
}) {
  const { data, error } = await supabase.rpc('validate_promotion_on_checkout', {
    p_restaurant_id: params.restaurantId,
    p_customer_id: params.customerId,
    p_promotion_id: params.promotionId,
    p_voucher_code: params.voucherCode || null,
    p_channel: 'website',
    p_order_type: params.orderType,
    p_basket_subtotal: params.basketSubtotal,
    p_delivery_fee: params.deliveryFee,
    p_now_ts: new Date().toISOString(),
  });

  if (error) throw error;
  const normalized = (data || {}) as Partial<PromotionValidationResult>;
  return {
    valid: !!normalized.valid,
    reason: normalized.reason || null,
    discount_amount: Number(normalized.discount_amount || 0),
    delivery_discount_amount: Number(normalized.delivery_discount_amount || 0),
  } as PromotionValidationResult;
}

export function describeInvalidReason(reason: string | null) {
  if (!reason) return 'Ready to apply.';
  const map: Record<string, string> = {
    not_started: 'Not started yet.',
    expired: 'This offer has expired.',
    min_subtotal_not_met: 'Increase your plate total to unlock this offer.',
    outside_recurring_window: 'Valid only in a scheduled time window.',
    channel_not_allowed: 'This offer is not available on website.',
    order_type_not_allowed: 'This offer is not available for this order type.',
    max_uses_total_reached: 'This offer has reached its total usage limit.',
    max_uses_per_customer_reached: 'You have reached your usage limit for this offer.',
    voucher_not_found: 'Voucher code not found.',
    voucher_expired: 'Voucher code has expired.',
    voucher_not_started: 'Voucher code is not active yet.',
    voucher_max_uses_total_reached: 'Voucher usage limit reached.',
    voucher_max_uses_per_customer_reached: 'You have used this voucher maximum times.',
    not_implemented: 'Offer logic is coming soon.',
  };
  return map[reason] || 'This offer cannot be applied right now.';
}
