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
  channels?: string[] | null;
  order_types?: string[] | null;
  is_recurring?: boolean | null;
  days_of_week?: number[] | null;
  time_window_start?: string | null;
  time_window_end?: string | null;
  max_uses_total?: number | null;
  max_uses_per_customer?: number | null;
  promo_terms?: string | null;
};

export type PromotionTermsData = {
  id: string;
  type: string;
  channels: string[] | null;
  order_types: string[] | null;
  min_subtotal: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_recurring: boolean | null;
  days_of_week: number[] | null;
  time_window_start: string | null;
  time_window_end: string | null;
  new_customer_only: boolean | null;
  max_uses_total: number | null;
  max_uses_per_customer: number | null;
  promo_terms: string | null;
  reward: {
    discount_type?: 'percent' | 'fixed' | string | null;
    discount_value?: number | null;
    max_discount_cap?: number | null;
    delivery_fee_cap?: number | null;
    free_delivery_min_subtotal?: number | null;
  } | null;
};

export type ActivePromotionSelection = {
  promotion_id: string;
  type: string;
  promotion_name?: string | null;
  voucher_code?: string | null;
  selected_at: string;
};

export type VoucherReward = {
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  max_discount_cap?: number | null;
};

export type OwnedVoucher = {
  voucherCodeId: string;
  promotionId: string;
  code: string;
  createdAt?: string;
  reward?: VoucherReward;
};

export type AppliedSelection =
  | { kind: 'promotion'; promotionId: string }
  | { kind: 'voucher'; voucherCodeId: string; promotionId: string };

export type StoredActiveSelection =
  | { kind: 'promotion'; promotionId: string }
  | { kind: 'voucher'; voucherCodeId: string; promotionId: string }
  | null;

export type PromotionValidationResult = {
  valid: boolean;
  reason: string | null;
  discount_amount: number;
  delivery_discount_amount: number;
};


export type VoucherPromotionLookup = {
  voucher_code_id: string;
  voucher_code: string;
  promotion_id: string;
  promotion_name: string | null;
  promotion_type: string | null;
  reward: VoucherReward | null;
};

export type LoyaltyConfig = {
  enabled: boolean;
  points_per_currency_unit: number;
  reward_points_required: number;
  reward_value: number;
};

export type LoyaltyBalance = {
  points: number;
};

const guestKey = (restaurantId: string) => `orderfast_guest_customer_${restaurantId}`;
const activePromoKey = (restaurantId: string) => `orderfast_active_promotion_${restaurantId}`;
const appliedPromoKey = (restaurantId: string) => `orderfast_applied_promotions_${restaurantId}`;
const appliedVoucherCodesKey = (restaurantId: string) => `orderfast_applied_voucher_codes_${restaurantId}`;
const ownedVouchersKey = (restaurantId: string) => `orderfast_owned_vouchers_${restaurantId}`;
const appliedSelectionsKey = (restaurantId: string) => `orderfast_applied_selections_${restaurantId}`;
const activeSelectionV2Key = (restaurantId: string) => `orderfast_active_selection_v2_${restaurantId}`;
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

export function getOwnedVouchers(restaurantId: string): OwnedVoucher[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(ownedVouchersKey(restaurantId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const map = new Map<string, OwnedVoucher>();
    parsed.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const voucherCodeId = String((entry as { voucherCodeId?: string }).voucherCodeId || '').trim();
      const promotionId = String((entry as { promotionId?: string }).promotionId || '').trim();
      const code = String((entry as { code?: string }).code || '').trim();
      if (!voucherCodeId || !promotionId || !code) return;
      const rewardRaw = (entry as { reward?: VoucherReward }).reward;
      const reward = rewardRaw && (rewardRaw.discount_type === 'fixed' || rewardRaw.discount_type === 'percent')
        ? {
            discount_type: rewardRaw.discount_type,
            discount_value: Number(rewardRaw.discount_value || 0),
            max_discount_cap: rewardRaw.max_discount_cap ?? null,
          }
        : undefined;
      map.set(voucherCodeId, {
        voucherCodeId,
        promotionId,
        code,
        createdAt: (entry as { createdAt?: string }).createdAt,
        reward,
      });
    });
    return Array.from(map.values());
  } catch {
    return [];
  }
}

export function setOwnedVouchers(restaurantId: string, vouchers: OwnedVoucher[]) {
  if (typeof window === 'undefined') return;
  const deduped = Array.from(new Map(vouchers.map((voucher) => [voucher.voucherCodeId, voucher])).values());
  window.localStorage.setItem(ownedVouchersKey(restaurantId), JSON.stringify(deduped));
}

export function upsertOwnedVoucher(restaurantId: string, voucher: OwnedVoucher) {
  const existing = getOwnedVouchers(restaurantId);
  const next = existing.filter((entry) => entry.voucherCodeId !== voucher.voucherCodeId);
  next.push(voucher);
  setOwnedVouchers(restaurantId, next.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
}

export function removeOwnedVoucher(restaurantId: string, voucherCodeId: string) {
  const next = getOwnedVouchers(restaurantId).filter((voucher) => voucher.voucherCodeId !== voucherCodeId);
  setOwnedVouchers(restaurantId, next);
}

export function getAppliedSelections(restaurantId: string): AppliedSelection[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(appliedSelectionsKey(restaurantId));
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry) => {
          if (!entry || typeof entry !== 'object') return false;
          if ((entry as AppliedSelection).kind === 'promotion') {
            return typeof (entry as AppliedSelection & { promotionId?: string }).promotionId === 'string';
          }
          if ((entry as AppliedSelection).kind === 'voucher') {
            return (
              typeof (entry as AppliedSelection & { promotionId?: string }).promotionId === 'string'
              && typeof (entry as AppliedSelection & { voucherCodeId?: string }).voucherCodeId === 'string'
            );
          }
          return false;
        }) as AppliedSelection[];
      }
    } catch {
      // ignore and migrate from legacy keys
    }
  }

  const legacyPromotionIds = getAppliedPromotionIds(restaurantId);
  return legacyPromotionIds.map((promotionId) => ({ kind: 'promotion', promotionId } as AppliedSelection));
}

export function setAppliedSelections(restaurantId: string, selections: AppliedSelection[]) {
  if (typeof window === 'undefined') return;
  const seen = new Set<string>();
  const unique = selections.filter((entry) => {
    const key = entry.kind === 'promotion'
      ? `promotion:${entry.promotionId}`
      : `voucher:${entry.voucherCodeId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  window.localStorage.setItem(appliedSelectionsKey(restaurantId), JSON.stringify(unique));
}

export function addAppliedSelection(restaurantId: string, selection: AppliedSelection) {
  const next = [...getAppliedSelections(restaurantId), selection];
  setAppliedSelections(restaurantId, next);
}

export function removeAppliedSelection(restaurantId: string, selection: AppliedSelection) {
  const next = getAppliedSelections(restaurantId).filter((entry) => {
    if (selection.kind === 'promotion' && entry.kind === 'promotion') return entry.promotionId !== selection.promotionId;
    if (selection.kind === 'voucher' && entry.kind === 'voucher') return entry.voucherCodeId !== selection.voucherCodeId;
    return true;
  });
  setAppliedSelections(restaurantId, next);
}

export function getStoredActiveSelection(restaurantId: string): StoredActiveSelection {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(activeSelectionV2Key(restaurantId));
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.kind === 'promotion' && typeof parsed.promotionId === 'string') {
        return { kind: 'promotion', promotionId: parsed.promotionId };
      }
      if (
        parsed?.kind === 'voucher'
        && typeof parsed.promotionId === 'string'
        && typeof parsed.voucherCodeId === 'string'
      ) {
        return { kind: 'voucher', promotionId: parsed.promotionId, voucherCodeId: parsed.voucherCodeId };
      }
    } catch {
      // ignore
    }
  }

  const legacy = getActivePromotionSelection(restaurantId);
  if (!legacy?.promotion_id) return null;
  return { kind: 'promotion', promotionId: legacy.promotion_id };
}

export function setStoredActiveSelection(restaurantId: string, selection: StoredActiveSelection) {
  if (typeof window === 'undefined') return;
  if (!selection) {
    window.localStorage.removeItem(activeSelectionV2Key(restaurantId));
    return;
  }
  window.localStorage.setItem(activeSelectionV2Key(restaurantId), JSON.stringify(selection));
}

export function clearStoredActiveSelection(restaurantId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(activeSelectionV2Key(restaurantId));
}

export function getAppliedVoucherCodes(restaurantId: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(appliedVoucherCodesKey(restaurantId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.entries(parsed).reduce((acc, [promotionId, code]) => {
      if (typeof promotionId === 'string' && typeof code === 'string' && code.trim()) {
        acc[promotionId] = code;
      }
      return acc;
    }, {} as Record<string, string>);
  } catch {
    return {};
  }
}

export function setAppliedVoucherCode(restaurantId: string, promotionId: string, voucherCode: string) {
  if (typeof window === 'undefined') return;
  const next = getAppliedVoucherCodes(restaurantId);
  next[promotionId] = voucherCode;
  window.localStorage.setItem(appliedVoucherCodesKey(restaurantId), JSON.stringify(next));
}

export function setAppliedVoucherCodeByVoucherId(
  restaurantId: string,
  voucherCodeId: string,
  voucherCode: string,
  promotionId?: string
) {
  if (typeof window === 'undefined') return;
  const next = getAppliedVoucherCodes(restaurantId);
  next[voucherCodeId] = voucherCode;
  if (promotionId) next[promotionId] = voucherCode;
  window.localStorage.setItem(appliedVoucherCodesKey(restaurantId), JSON.stringify(next));
}

export function removeAppliedVoucherCode(restaurantId: string, promotionId: string) {
  if (typeof window === 'undefined') return;
  const next = getAppliedVoucherCodes(restaurantId);
  delete next[promotionId];
  window.localStorage.setItem(appliedVoucherCodesKey(restaurantId), JSON.stringify(next));
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

export async function fetchPromotionTermsData(restaurantId: string, promotionIds: string[]) {
  const ids = Array.from(new Set(promotionIds.filter(Boolean)));
  if (!ids.length) return [] as PromotionTermsData[];

  const { data, error } = await supabase
    .from('promotions')
    .select(
      'id,type,channels,order_types,min_subtotal,starts_at,ends_at,is_recurring,days_of_week,time_window_start,time_window_end,new_customer_only,max_uses_total,max_uses_per_customer,promo_terms,promotion_rewards(reward)'
    )
    .eq('restaurant_id', restaurantId)
    .in('id', ids);

  if (error) throw error;

  return ((data || []) as Array<Record<string, unknown>>).map((row) => {
    const rewardRows = Array.isArray(row.promotion_rewards) ? row.promotion_rewards : [];
    const reward = rewardRows[0] && typeof rewardRows[0] === 'object'
      ? ((rewardRows[0] as { reward?: PromotionTermsData['reward'] }).reward || null)
      : null;

    return {
      id: String(row.id || ''),
      type: String(row.type || ''),
      channels: (row.channels as string[] | null) || null,
      order_types: (row.order_types as string[] | null) || null,
      min_subtotal: (row.min_subtotal as number | null) ?? null,
      starts_at: (row.starts_at as string | null) ?? null,
      ends_at: (row.ends_at as string | null) ?? null,
      is_recurring: (row.is_recurring as boolean | null) ?? null,
      days_of_week: (row.days_of_week as number[] | null) || null,
      time_window_start: (row.time_window_start as string | null) ?? null,
      time_window_end: (row.time_window_end as string | null) ?? null,
      new_customer_only: (row.new_customer_only as boolean | null) ?? null,
      max_uses_total: (row.max_uses_total as number | null) ?? null,
      max_uses_per_customer: (row.max_uses_per_customer as number | null) ?? null,
      promo_terms: (row.promo_terms as string | null) ?? null,
      reward,
    } as PromotionTermsData;
  });
}

export async function fetchOwnedVouchersFromDb(restaurantId: string, customerId: string): Promise<OwnedVoucher[]> {
  const { data: redemptionRows, error: redemptionsError } = await supabase
    .from('promotion_redemptions')
    .select('voucher_code_id,order_id,created_at')
    .eq('restaurant_id', restaurantId)
    .eq('customer_id', customerId)
    .not('voucher_code_id', 'is', null)
    .order('created_at', { ascending: false });

  if (redemptionsError) throw redemptionsError;

  const consumed = new Set<string>();
  const unconsumedCreatedAt = new Map<string, string | undefined>();
  (redemptionRows || []).forEach((row) => {
    const voucherCodeId = String(row.voucher_code_id || '').trim();
    if (!voucherCodeId) return;
    if (row.order_id) {
      consumed.add(voucherCodeId);
      return;
    }
    if (!unconsumedCreatedAt.has(voucherCodeId)) {
      unconsumedCreatedAt.set(voucherCodeId, row.created_at || undefined);
    }
  });

  const voucherIds = Array.from(unconsumedCreatedAt.keys()).filter((voucherCodeId) => !consumed.has(voucherCodeId));
  if (!voucherIds.length) return [];

  const { data: voucherRows, error: voucherRowsError } = await supabase
    .from('promotion_voucher_codes')
    .select('id,code,promotion_id')
    .in('id', voucherIds);

  if (voucherRowsError) throw voucherRowsError;
  if (!voucherRows?.length) return [];

  const promotionIds = Array.from(new Set(voucherRows.map((row) => String(row.promotion_id || '').trim()).filter(Boolean)));

  const { data: rewardRows, error: rewardRowsError } = await supabase
    .from('promotion_rewards')
    .select('promotion_id,reward')
    .in('promotion_id', promotionIds);

  if (rewardRowsError) throw rewardRowsError;

  const rewardMap = new Map<string, VoucherReward>();
  (rewardRows || []).forEach((row) => {
    const promotionId = String(row.promotion_id || '').trim();
    if (!promotionId || !row.reward || typeof row.reward !== 'object') return;
    const rewardRaw = row.reward as VoucherReward;
    if (rewardRaw.discount_type !== 'fixed' && rewardRaw.discount_type !== 'percent') return;
    rewardMap.set(promotionId, {
      discount_type: rewardRaw.discount_type,
      discount_value: Number(rewardRaw.discount_value || 0),
      max_discount_cap: rewardRaw.max_discount_cap ?? null,
    });
  });

  return voucherRows
    .map((row) => {
      const voucherCodeId = String(row.id || '').trim();
      const promotionId = String(row.promotion_id || '').trim();
      const code = String(row.code || '').trim();
      if (!voucherCodeId || !promotionId || !code) return null;
      return {
        voucherCodeId,
        promotionId,
        code,
        createdAt: unconsumedCreatedAt.get(voucherCodeId),
        reward: rewardMap.get(promotionId),
      } as OwnedVoucher;
    })
    .filter((row): row is OwnedVoucher => !!row)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function fetchLoyaltyConfig(restaurantId: string) {
  const { data, error } = await supabase
    .from('loyalty_config')
    .select('enabled,points_per_currency_unit,reward_points_required,reward_value')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as LoyaltyConfig | null;
}

export async function upsertLoyaltyConfig(restaurantId: string, config: LoyaltyConfig) {
  const payload = {
    restaurant_id: restaurantId,
    enabled: config.enabled,
    points_per_currency_unit: config.points_per_currency_unit,
    reward_points_required: config.reward_points_required,
    reward_value: config.reward_value,
  };

  const { data, error } = await supabase
    .from('loyalty_config')
    .upsert(payload, { onConflict: 'restaurant_id' })
    .select('enabled,points_per_currency_unit,reward_points_required,reward_value')
    .single();

  if (error) throw error;
  return data as LoyaltyConfig;
}

export async function fetchLoyaltyPointsBalance(params: { restaurantId: string; customerId: string }) {
  const rpcResult = await supabase.rpc('get_loyalty_points_balance', {
    p_restaurant_id: params.restaurantId,
    p_customer_id: params.customerId,
  });

  if (!rpcResult.error) {
    const raw = rpcResult.data;
    if (typeof raw === 'number') return { points: Math.max(0, Math.floor(raw)) } as LoyaltyBalance;
    if (Array.isArray(raw) && raw[0] && typeof raw[0].points === 'number') {
      return { points: Math.max(0, Math.floor(raw[0].points)) } as LoyaltyBalance;
    }
    if (raw && typeof raw === 'object' && typeof (raw as { points?: unknown }).points === 'number') {
      return { points: Math.max(0, Math.floor((raw as { points: number }).points)) } as LoyaltyBalance;
    }
  }

  // QA note: fallback query keeps loyalty functional when RPC is unavailable in older environments.
  const { data, error } = await supabase
    .from('loyalty_ledger')
    .select('points,entry_type')
    .eq('restaurant_id', params.restaurantId)
    .eq('customer_id', params.customerId);

  if (error) throw error;

  const points = (data || []).reduce((sum, entry) => {
    const value = Number(entry.points || 0);
    if (entry.entry_type === 'spend') return sum - Math.abs(value);
    return sum + value;
  }, 0);

  return { points: Math.max(0, Math.floor(points)) } as LoyaltyBalance;
}

export async function redeemLoyaltyPointsToVoucher(params: { restaurantId: string; customerId: string }) {
  const { data, error } = await supabase.rpc('redeem_loyalty_points_to_voucher', {
    p_restaurant_id: params.restaurantId,
    p_customer_id: params.customerId,
  });

  if (error) throw error;
  return data;
}


export async function resolveVoucherPromotionByCode(params: {
  restaurantId: string;
  code: string;
}) {
  const normalizedCode = params.code.trim().toLowerCase();
  if (!normalizedCode) return null;

  const { data, error } = await supabase
    .from('promotion_voucher_codes')
    .select('id,voucher_code_id,code,promotion_id,promotions!inner(id,restaurant_id,name,type),promotion_rewards(discount_type,discount_value,max_discount_cap)')
    .eq('code_normalized', normalizedCode)
    .eq('promotions.restaurant_id', params.restaurantId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.promotion_id) return null;

  const promotion = Array.isArray(data.promotions) ? data.promotions[0] : data.promotions;
  const reward = Array.isArray((data as { promotion_rewards?: VoucherReward[] }).promotion_rewards)
    ? (data as { promotion_rewards?: VoucherReward[] }).promotion_rewards?.[0] || null
    : null;
  const voucherCodeId = String((data as { voucher_code_id?: string; id?: string }).voucher_code_id || (data as { id?: string }).id || '').trim();
  const code = String((data as { code?: string }).code || params.code).trim();

  return {
    voucher_code_id: voucherCodeId,
    voucher_code: code,
    promotion_id: data.promotion_id,
    promotion_name: (promotion?.name as string | undefined) || null,
    promotion_type: (promotion?.type as string | undefined) || null,
    reward: reward
      ? {
          discount_type: reward.discount_type,
          discount_value: Number(reward.discount_value || 0),
          max_discount_cap: reward.max_discount_cap ?? null,
        }
      : null,
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
    archived: 'This promotion is no longer available.',
    expired: 'This offer has expired.',
    min_subtotal_not_met: 'Increase your plate total to unlock this offer.',
    outside_recurring_window: 'Valid only in a scheduled time window.',
    channel_not_allowed: 'This offer is not available on website.',
    order_type_not_allowed: 'This offer is not available for this order type.',
    status_not_active: 'This promotion is not active right now.',
    voucher_required: 'Enter a voucher code to use this promotion.',
    max_uses_total_reached: 'This offer has reached its total usage limit.',
    max_uses_per_customer_reached: 'You have reached your usage limit for this offer.',
    voucher_not_found: 'Voucher code not found.',
    voucher_expired: 'Voucher code has expired.',
    voucher_not_started: 'Voucher code is not active yet.',
    voucher_max_uses_total_reached: 'Voucher usage limit reached.',
    voucher_max_uses_per_customer_reached: 'You have used this voucher maximum times.',
    invalid_reward_payload: 'This promotion is misconfigured. Please try another one.',
    not_implemented: 'This promotion is not available right now.',
  };
  return map[reason] || 'This offer cannot be applied right now.';
}
