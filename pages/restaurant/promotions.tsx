import { useEffect, useMemo, useState } from 'react';
import PromotionTermsModal from '@/components/promotions/PromotionTermsModal';
import { buildPromotionTermsPreview } from '@/lib/promotionTerms';
import CustomerLayout from '@/components/CustomerLayout';
import { useCart } from '@/context/CartContext';
import { useOrderType } from '@/context/OrderTypeContext';
import { useSession } from '@supabase/auth-helpers-react';
import { useRestaurant } from '@/lib/restaurant-context';
import {
  addAppliedSelection,
  AppliedSelection,
  clearStoredActiveSelection,
  describeInvalidReason,
  fetchCustomerPromotions,
  fetchLoyaltyConfig,
  fetchPromotionTermsData,
  fetchLoyaltyPointsBalance,
  getAppliedSelections,
  getStoredActiveSelection,
  getStableGuestCustomerId,
  getOwnedVouchers,
  LoyaltyConfig,
  OwnedVoucher,
  PromotionListItem,
  redeemLoyaltyPointsToVoucher,
  removeAppliedSelection,
  setAppliedSelections,
  setAppliedVoucherCodeByVoucherId,
  setStoredActiveSelection,
  upsertOwnedVoucher,
  validatePromotion,
  VoucherReward,
  PromotionTermsData,
} from '@/lib/customerPromotions';

const LOYALTY_LINES = [
  'Economics, defeated.',
  'The system trembles.',
  'ROI: delicious.',
  'Inflation fears you.',
  'Margins? Improved by snacks.',
  'Accountancy meets appetite.',
  'Value extracted.',
  'Fiscal strategy: one more plate.',
  'This is what efficient spending looks like.',
  'Procurement: elite.',
  'Coupons are temporary, aura is forever.',
  'Your loyalty curve is trending upward.',
  'Optimisation, now edible.',
  'Spreadsheet energy, plate edition.',
  'Monetary policy just got tastier.',
  'The ledger approves this plate.',
  'Performance marketing, but crispy.',
  'Cashflow with extra sauce.',
  'Cost control through good decisions.',
  'The value engine is warm.',
  'Your points portfolio is maturing nicely.',
  'Budget discipline, gourmet outcomes.',
  'Tactical dining executed.',
  'Your loyalty momentum is undeniable.',
  'Market forces: deliciously contained.',
  'This plate has strategic upside.',
  'KPIs are looking seasoned.',
  'Reward efficiency: online.',
  'Savings have entered the chat.',
  'Professional plate economics at work.',
];

const IS_DEV = process.env.NODE_ENV !== 'production';

type DisplayItem = {
  promotionTerms?: PromotionTermsData | null;
  key: string;
  kind: 'promotion' | 'voucher';
  promotionId: string;
  voucherCodeId?: string;
  name: string;
  subtitle: string;
  type: string;
  isCurrentlyValid: boolean;
  status: string;
  nextAvailableAt?: string | null;
  invalidReason?: string | null;
  minSubtotal?: number | null;
  code?: string;
  createdAt?: string;
  reward?: VoucherReward | null;
};

const formatVoucherTitle = (reward?: VoucherReward | null, fallbackValue?: number | null) => {
  if (reward?.discount_type === 'fixed') return `£${Number(reward.discount_value || 0).toLocaleString()} Voucher`;
  if (reward?.discount_type === 'percent') return `${Number(reward.discount_value || 0).toLocaleString()}% Voucher`;
  if (typeof fallbackValue === 'number') return `£${fallbackValue.toLocaleString()} Voucher`;
  return 'Voucher';
};

export default function CustomerPromotionsPage() {
  const { cart, subtotal } = useCart();
  const { orderType } = useOrderType();
  const session = useSession();
  const { restaurantId, loading: restaurantLoading } = useRestaurant();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PromotionListItem[]>([]);
  const [appliedSelections, setAppliedSelectionsState] = useState<AppliedSelection[]>([]);
  const [activeSelection, setActiveSelectionState] = useState<AppliedSelection | null>(null);
  const [ownedVouchers, setOwnedVouchersState] = useState<OwnedVoucher[]>([]);
  const [promotionTermsMap, setPromotionTermsMap] = useState<Record<string, PromotionTermsData>>({});
  const [termsItem, setTermsItem] = useState<DisplayItem | null>(null);

  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [loyaltyRedeeming, setLoyaltyRedeeming] = useState(false);
  const [loyaltyBanner, setLoyaltyBanner] = useState('');
  const [lastRedeemedVoucherCode, setLastRedeemedVoucherCode] = useState<string | null>(null);
  const [loyaltyError, setLoyaltyError] = useState('');
  const [loyaltyLineIndex] = useState(() => Math.floor(Math.random() * LOYALTY_LINES.length));

  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const currentOrderType = orderType || 'delivery';

  useEffect(() => {
    if (!restaurantId) return;
    const resolved = session?.user?.id || getStableGuestCustomerId(restaurantId);
    setCustomerId(resolved || null);
    setAppliedSelectionsState(getAppliedSelections(restaurantId));
    setActiveSelectionState(getStoredActiveSelection(restaurantId));
    setOwnedVouchersState(getOwnedVouchers(restaurantId));
  }, [restaurantId, session?.user?.id]);

  const persistAppliedSelections = (next: AppliedSelection[]) => {
    if (!restaurantId) return;
    setAppliedSelections(restaurantId, next);
    setAppliedSelectionsState(next);
  };

  const persistActiveSelection = (next: AppliedSelection | null) => {
    if (!restaurantId) return;
    setStoredActiveSelection(restaurantId, next);
    setActiveSelectionState(next);
  };

  const loadPromotions = async () => {
    if (!restaurantId || !customerId) return;
    setLoading(true);
    try {
      const data = await fetchCustomerPromotions({
        restaurantId,
        customerId,
        orderType: currentOrderType,
        basketSubtotal: cart.items.length ? subtotal : null,
      });
      setItems(data);
      const termRows = await fetchPromotionTermsData(restaurantId, data.map((item) => item.id));
      const nextTermsMap = termRows.reduce((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {} as Record<string, PromotionTermsData>);
      setPromotionTermsMap(nextTermsMap);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLoyalty = async () => {
    if (!restaurantId || !customerId) return;
    setLoyaltyLoading(true);
    setLoyaltyError('');
    try {
      const [config, balance] = await Promise.all([
        fetchLoyaltyConfig(restaurantId),
        fetchLoyaltyPointsBalance({ restaurantId, customerId }),
      ]);
      setLoyaltyConfig(config);
      setLoyaltyPoints(balance.points);
    } catch {
      setLoyaltyError('Could not load loyalty details right now.');
    } finally {
      setLoyaltyLoading(false);
    }
  };

  useEffect(() => {
    loadPromotions();
    loadLoyalty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, customerId, currentOrderType, subtotal, cart.items.length]);

  const nonVoucherItems = useMemo(() => items.filter((promotion) => promotion.type !== 'voucher'), [items]);

  const voucherDisplayItems = useMemo<DisplayItem[]>(() => {
    return ownedVouchers
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map((voucher) => {
        const promotion = items.find((item) => item.id === voucher.promotionId);
        return {
          key: `voucher:${voucher.voucherCodeId}`,
          kind: 'voucher',
          promotionTerms: promotionTermsMap[voucher.promotionId] || null,
          promotionId: voucher.promotionId,
          voucherCodeId: voucher.voucherCodeId,
          name: formatVoucherTitle(voucher.reward, loyaltyConfig?.reward_value ?? null),
          subtitle: voucher.code ? `Voucher code: ${voucher.code}` : 'Enter code at checkout',
          type: 'voucher',
          isCurrentlyValid: promotion?.is_currently_valid ?? true,
          status: promotion?.status || 'active',
          nextAvailableAt: promotion?.next_available_at ?? null,
          invalidReason: promotion?.invalid_reason ?? null,
          minSubtotal: promotion?.min_subtotal ?? null,
          code: voucher.code,
          createdAt: voucher.createdAt,
          reward: voucher.reward || null,
        } as DisplayItem;
      });
  }, [items, ownedVouchers, loyaltyConfig?.reward_value, promotionTermsMap]);

  const promotionDisplayMap = useMemo(() => {
    const map = new Map<string, DisplayItem>();
    nonVoucherItems.forEach((promotion) => {
      map.set(promotion.id, {
        key: `promotion:${promotion.id}`,
        kind: 'promotion',
        promotionTerms: promotionTermsMap[promotion.id] || null,
        promotionId: promotion.id,
        name: promotion.name,
        subtitle: '',
        type: promotion.type,
        isCurrentlyValid: promotion.is_currently_valid,
        status: promotion.status,
        nextAvailableAt: promotion.next_available_at,
        invalidReason: promotion.invalid_reason,
        minSubtotal: promotion.min_subtotal,
      });
    });
    return map;
  }, [nonVoucherItems, promotionTermsMap]);

  const appliedItems = useMemo<DisplayItem[]>(() => {
    const resolved = appliedSelections
      .map((selection) => {
        if (selection.kind === 'promotion') return promotionDisplayMap.get(selection.promotionId) || null;
        return voucherDisplayItems.find((voucher) => voucher.voucherCodeId === selection.voucherCodeId) || null;
      })
      .filter((entry): entry is DisplayItem => !!entry);

    return resolved.sort((a, b) => {
      const isAActive = activeSelection?.kind === 'voucher'
        ? a.kind === 'voucher' && a.voucherCodeId === activeSelection.voucherCodeId
        : a.kind === 'promotion' && a.promotionId === activeSelection?.promotionId;
      const isBActive = activeSelection?.kind === 'voucher'
        ? b.kind === 'voucher' && b.voucherCodeId === activeSelection.voucherCodeId
        : b.kind === 'promotion' && b.promotionId === activeSelection?.promotionId;
      if (isAActive !== isBActive) return isAActive ? -1 : 1;
      return 0;
    });
  }, [appliedSelections, promotionDisplayMap, voucherDisplayItems, activeSelection]);

  const availablePromotions = useMemo<DisplayItem[]>(() => {
    const appliedPromotionIds = new Set(appliedSelections.filter((item) => item.kind === 'promotion').map((item) => item.promotionId));
    const appliedVoucherIds = new Set(appliedSelections.filter((item) => item.kind === 'voucher').map((item) => item.voucherCodeId));

    const availableVouchers = voucherDisplayItems.filter((voucher) => !appliedVoucherIds.has(voucher.voucherCodeId || ''));
    const availableNonVoucherPromotions = nonVoucherItems
      .filter((promotion) => !appliedPromotionIds.has(promotion.id))
      .map((promotion) => promotionDisplayMap.get(promotion.id))
      .filter((item): item is DisplayItem => !!item);

    return [...availableVouchers, ...availableNonVoucherPromotions];
  }, [appliedSelections, nonVoucherItems, promotionDisplayMap, voucherDisplayItems]);

  const activeItem = useMemo(() => {
    if (!activeSelection) return null;
    if (activeSelection.kind === 'promotion') {
      return appliedItems.find((entry) => entry.kind === 'promotion' && entry.promotionId === activeSelection.promotionId) || null;
    }
    return appliedItems.find((entry) => entry.kind === 'voucher' && entry.voucherCodeId === activeSelection.voucherCodeId) || null;
  }, [activeSelection, appliedItems]);

  const pickBestActivePromotion = async (selections: AppliedSelection[]) => {
    if (!restaurantId || !customerId) return null;
    const candidatePromotions = selections
      .filter((entry): entry is Extract<AppliedSelection, { kind: 'promotion' }> => entry.kind === 'promotion')
      .map((entry) => items.find((item) => item.id === entry.promotionId))
      .filter((entry): entry is PromotionListItem => !!entry)
      .filter((promotion) => promotion.type !== 'voucher');

    if (!candidatePromotions.length) return null;

    const scored = await Promise.all(
      candidatePromotions.map(async (promotion) => {
        try {
          const result = await validatePromotion({
            restaurantId,
            customerId,
            promotionId: promotion.id,
            orderType: currentOrderType,
            basketSubtotal: subtotal,
            deliveryFee: currentOrderType === 'delivery' ? 300 : 0,
          });
          return {
            promotion,
            valid: result.valid,
            savings: result.discount_amount + result.delivery_discount_amount,
          };
        } catch {
          return { promotion, valid: false, savings: 0 };
        }
      })
    );

    scored.sort((a, b) => {
      if (a.valid !== b.valid) return a.valid ? -1 : 1;
      return b.savings - a.savings;
    });

    return scored[0]?.promotion || null;
  };

  const applyItem = (item: DisplayItem) => {
    if (!restaurantId) return;
    const selection: AppliedSelection = item.kind === 'voucher'
      ? { kind: 'voucher', voucherCodeId: item.voucherCodeId || '', promotionId: item.promotionId }
      : { kind: 'promotion', promotionId: item.promotionId };

    const nextApplied = [...appliedSelections, selection];
    persistAppliedSelections(nextApplied);

    if (!activeSelection) {
      persistActiveSelection(selection);
    }
  };

  const makeActive = (item: DisplayItem) => {
    const next: AppliedSelection = item.kind === 'voucher'
      ? { kind: 'voucher', voucherCodeId: item.voucherCodeId || '', promotionId: item.promotionId }
      : { kind: 'promotion', promotionId: item.promotionId };
    persistActiveSelection(next);
  };

  const removeApplied = async (item: DisplayItem) => {
    if (!restaurantId) return;
    const removingSelection: AppliedSelection = item.kind === 'voucher'
      ? { kind: 'voucher', voucherCodeId: item.voucherCodeId || '', promotionId: item.promotionId }
      : { kind: 'promotion', promotionId: item.promotionId };

    const remaining = appliedSelections.filter((entry) => {
      if (removingSelection.kind === 'promotion' && entry.kind === 'promotion') return entry.promotionId !== removingSelection.promotionId;
      if (removingSelection.kind === 'voucher' && entry.kind === 'voucher') return entry.voucherCodeId !== removingSelection.voucherCodeId;
      return true;
    });

    removeAppliedSelection(restaurantId, removingSelection);
    setAppliedSelectionsState(remaining);

    const isRemovingActive = activeSelection
      && (
        (activeSelection.kind === 'promotion' && removingSelection.kind === 'promotion' && activeSelection.promotionId === removingSelection.promotionId)
        || (activeSelection.kind === 'voucher' && removingSelection.kind === 'voucher' && activeSelection.voucherCodeId === removingSelection.voucherCodeId)
      );

    if (!isRemovingActive) return;

    const bestPromotion = await pickBestActivePromotion(remaining);
    if (bestPromotion) {
      persistActiveSelection({ kind: 'promotion', promotionId: bestPromotion.id });
      return;
    }

    clearStoredActiveSelection(restaurantId);
    setActiveSelectionState(null);
  };

  const removeActive = async () => {
    if (!activeItem) return;
    await removeApplied(activeItem);
  };

  const redeemLoyalty = async () => {
    if (!restaurantId || !customerId || !loyaltyConfig?.enabled) return;
    setLoyaltyRedeeming(true);
    setLoyaltyError('');
    try {
      const result = await redeemLoyaltyPointsToVoucher({ restaurantId, customerId });
      const payload = (Array.isArray(result) ? result[0] : result) as {
        promotion_id?: string;
        voucher_code?: string;
        code?: string;
        code_normalized?: string;
        voucher_code_id?: string;
        id?: string;
        reward?: VoucherReward;
        reward_title?: string;
        discount_type?: 'fixed' | 'percent';
        discount_value?: number;
        max_discount_cap?: number;
      } | null;

      const voucherCodeId = String(payload?.voucher_code_id || payload?.id || '').trim();
      const voucherCode = String(payload?.code || payload?.voucher_code || '').trim();

      if (IS_DEV) {
        console.debug('[loyalty] redeem response', payload);
      }

      if (payload?.promotion_id && voucherCode && voucherCodeId) {
        const reward = payload.discount_type
          ? {
              discount_type: payload.discount_type,
              discount_value: Number(payload.discount_value || 0),
              max_discount_cap: payload.max_discount_cap ?? null,
            }
          : (payload.reward || undefined);

        upsertOwnedVoucher(restaurantId, {
          voucherCodeId,
          promotionId: payload.promotion_id,
          code: voucherCode,
          createdAt: new Date().toISOString(),
          reward,
        });
        setOwnedVouchersState(getOwnedVouchers(restaurantId));

        const voucherSelection: AppliedSelection = { kind: 'voucher', voucherCodeId, promotionId: payload.promotion_id };
        addAppliedSelection(restaurantId, voucherSelection);
        setAppliedSelectionsState(getAppliedSelections(restaurantId));

        if (!activeSelection) {
          persistActiveSelection(voucherSelection);
        }

        setAppliedVoucherCodeByVoucherId(restaurantId, voucherCodeId, voucherCode, payload.promotion_id);
        setLastRedeemedVoucherCode(voucherCode);

        if (IS_DEV) {
          console.debug('[loyalty] wrote owned voucher', {
            restaurantId,
            voucherCodeId,
            promotionId: payload.promotion_id,
          });
        }
      }

      await Promise.all([loadPromotions(), loadLoyalty()]);
      setLoyaltyBanner(Math.random() > 0.5 ? 'Voucher minted.' : 'Value extracted.');
      setTimeout(() => setLoyaltyBanner(''), 2500);
    } catch {
      setLoyaltyError('Redemption failed. Try again shortly.');
    } finally {
      setLoyaltyRedeeming(false);
    }
  };

  const scheduleLabel = (promo: DisplayItem) => {
    if (promo.kind === 'voucher') return promo.subtitle || 'Enter code at checkout';
    if (promo.isCurrentlyValid) return 'Active now';
    if (promo.nextAvailableAt) {
      const date = new Date(promo.nextAvailableAt).toLocaleString();
      if (promo.status === 'scheduled') return `Starts ${date}`;
      return `Next ${date}`;
    }
    return describeInvalidReason(promo.invalidReason || null);
  };

  const termsUnavailableReason = (promo: DisplayItem) => (promo.isCurrentlyValid ? null : describeInvalidReason(promo.invalidReason || null));

  const rewardPointsRequired = loyaltyConfig?.reward_points_required || 0;
  const loyaltyProgress = rewardPointsRequired > 0 ? Math.min(loyaltyPoints / rewardPointsRequired, 1) : 0;
  const canRedeem = !!loyaltyConfig?.enabled && rewardPointsRequired > 0 && loyaltyPoints >= rewardPointsRequired;
  const tileActionButtonClass = 'inline-flex h-8 min-w-[108px] items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold';

  if (!restaurantLoading && !restaurantId) {
    return (
      <CustomerLayout cartCount={cartCount}>
        <div className="mx-auto w-full max-w-3xl px-4 py-8 text-center text-red-500">No restaurant specified</div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout cartCount={cartCount}>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Promotions</h1>
        <p className="text-sm text-slate-600">Apply promotions to your account and choose one active promotion for checkout.</p>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Loyalty</h2>
            </div>
            {loyaltyConfig?.enabled ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Enabled</span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Unavailable</span>
            )}
          </div>

          {loyaltyLoading ? <div className="mt-3 h-20 animate-pulse rounded-xl bg-slate-100" /> : null}
          {loyaltyError ? <p className="mt-3 text-sm text-rose-600">{loyaltyError}</p> : null}

          {!loyaltyLoading ? (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2 md:gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xl font-semibold leading-tight text-slate-800 md:text-2xl">{loyaltyPoints.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Points</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xl font-semibold leading-tight text-slate-800 md:text-2xl">{rewardPointsRequired.toLocaleString()} pts</p>
                  <p className="text-xs text-slate-500">Target</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xl font-semibold leading-tight text-slate-800 md:text-2xl">£{Number(loyaltyConfig?.reward_value || 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Voucher</p>
                </div>
              </div>

              <div className="mt-3">
                <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700"
                    style={{ width: `${Math.round(loyaltyProgress * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">{loyaltyPoints.toLocaleString()} / {rewardPointsRequired.toLocaleString()} pts</p>
                <p className="mt-1 text-sm text-slate-600">{LOYALTY_LINES[loyaltyLineIndex]}</p>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">{canRedeem ? 'Voucher ready. Mint it, then choose when to activate it.' : 'Redeem points into a voucher and activate it when you want.'}</p>
                <button
                  type="button"
                  onClick={redeemLoyalty}
                  disabled={!canRedeem || loyaltyRedeeming}
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                  {loyaltyRedeeming ? 'Redeeming...' : 'Redeem'}
                </button>
              </div>

              {loyaltyBanner ? <p className="mt-2 text-xs font-semibold text-emerald-700">{loyaltyBanner}</p> : null}
              {lastRedeemedVoucherCode ? (
                <p className="mt-1 text-xs text-slate-600">
                  Voucher code <span className="font-semibold">{lastRedeemedVoucherCode}</span> saved to your applied promotions list.
                </p>
              ) : null}
            </>
          ) : null}
        </section>

        {activeItem ? (
          <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5 shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Active promotion</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{activeItem.name}</h3>
                <p className="mt-1 text-sm text-teal-800">{scheduleLabel(activeItem)}</p>
              </div>
              <div className="flex items-center justify-end gap-2 min-w-[108px]">
                <button
                  type="button"
                  onClick={removeActive}
                  className={`${tileActionButtonClass} border border-teal-300 text-teal-700 transition hover:bg-white`}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="mt-2 text-right">
              <button type="button" onClick={() => setTermsItem(activeItem)} className="text-xs font-medium text-slate-500 transition hover:text-slate-700 hover:underline">
                Terms & details
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Active promotion</p>
            <p className="mt-1 text-sm text-slate-600">No active promotion selected.</p>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Applied promotions</h2>
          {appliedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              You have not applied any promotions yet.
            </div>
          ) : (
            appliedItems.map((item) => {
              const isActive = activeSelection && (
                (activeSelection.kind === 'promotion' && item.kind === 'promotion' && activeSelection.promotionId === item.promotionId)
                || (activeSelection.kind === 'voucher' && item.kind === 'voucher' && activeSelection.voucherCodeId === item.voucherCodeId)
              );
              return (
                <article key={item.key} className={`rounded-2xl border bg-white p-4 shadow-sm ${isActive ? 'border-teal-300 ring-1 ring-teal-100' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
                        {isActive ? <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700">Active</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{scheduleLabel(item)}</p>
                    </div>
                    <div className="flex items-center justify-end gap-2 min-w-[220px]">
                      {!isActive ? (
                        <button type="button" onClick={() => makeActive(item)} className={`${tileActionButtonClass} border border-slate-300 text-slate-700 hover:bg-slate-50`}>
                          Activate
                        </button>
                      ) : (
                        <span className={`${tileActionButtonClass} invisible border border-transparent`}>Activate</span>
                      )}
                      <button type="button" onClick={() => removeApplied(item)} className={`${tileActionButtonClass} border border-rose-200 text-rose-600 hover:bg-rose-50`}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-right">
                    <button type="button" onClick={() => setTermsItem(item)} className="text-xs font-medium text-slate-500 transition hover:text-slate-700 hover:underline">
                      Terms & details
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Available promotions</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="h-4 w-40 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-64 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : availablePromotions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No offers available right now.
            </div>
          ) : (
            availablePromotions.map((item) => {
              return (
                <article key={item.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{item.name}</h3>
                        {item.kind === 'promotion' ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              item.isCurrentlyValid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {item.isCurrentlyValid ? 'Active' : 'Scheduled'}
                          </span>
                        ) : (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">Owned voucher</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{scheduleLabel(item)}</p>
                      {item.minSubtotal != null ? <p className="mt-1 text-xs text-slate-500">Min spend £{item.minSubtotal}</p> : null}
                    </div>
                    <div className="flex items-center justify-end min-w-[108px]">
                      <button
                        type="button"
                        onClick={() => applyItem(item)}
                        className={`${tileActionButtonClass} bg-teal-600 text-white transition hover:bg-teal-700`}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-right">
                    <button type="button" onClick={() => setTermsItem(item)} className="text-xs font-medium text-slate-500 transition hover:text-slate-700 hover:underline">
                      Terms & details
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>

      <PromotionTermsModal
        open={!!termsItem}
        onClose={() => setTermsItem(null)}
        title={termsItem?.name}
        unavailableReason={termsItem ? termsUnavailableReason(termsItem) : null}
        offerTerms={termsItem ? buildPromotionTermsPreview(termsItem.promotionTerms, termsItem.kind === 'voucher' ? (termsItem.reward || termsItem.promotionTerms?.reward || null) : termsItem.promotionTerms?.reward || null) : []}
        restaurantNote={termsItem?.promotionTerms?.promo_terms || ''}
      />
    </CustomerLayout>
  );
}
