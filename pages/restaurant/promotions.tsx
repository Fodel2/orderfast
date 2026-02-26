import { useEffect, useMemo, useState } from 'react';
import CustomerLayout from '@/components/CustomerLayout';
import { useCart } from '@/context/CartContext';
import { useOrderType } from '@/context/OrderTypeContext';
import { useSession } from '@supabase/auth-helpers-react';
import { useRestaurant } from '@/lib/restaurant-context';
import {
  addAppliedPromotionId,
  ActivePromotionSelection,
  clearActivePromotionSelection,
  describeInvalidReason,
  fetchCustomerPromotions,
  fetchLoyaltyConfig,
  fetchLoyaltyPointsBalance,
  getAppliedPromotionIds,
  getAppliedVoucherCodes,
  getActivePromotionSelection,
  getStableGuestCustomerId,
  LoyaltyConfig,
  PromotionListItem,
  redeemLoyaltyPointsToVoucher,
  removeAppliedPromotionId,
  removeAppliedVoucherCode,
  setActivePromotionSelection,
  setAppliedPromotionIds,
  setAppliedVoucherCode,
  validatePromotion,
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

export default function CustomerPromotionsPage() {
  const { cart, subtotal } = useCart();
  const { orderType } = useOrderType();
  const session = useSession();
  const { restaurantId, loading: restaurantLoading } = useRestaurant();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PromotionListItem[]>([]);
  const [activeSelection, setActiveSelection] = useState<ActivePromotionSelection | null>(null);
  const [appliedPromotionIds, setAppliedPromotionIdsState] = useState<string[]>([]);
  const [confirmReplace, setConfirmReplace] = useState<PromotionListItem | null>(null);
  const [voucherCodes, setVoucherCodes] = useState<Record<string, string>>({});

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
    setActiveSelection(getActivePromotionSelection(restaurantId));
    setAppliedPromotionIdsState(getAppliedPromotionIds(restaurantId));
    setVoucherCodes(getAppliedVoucherCodes(restaurantId));
  }, [restaurantId, session?.user?.id]);

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

  useEffect(() => {
    if (!restaurantId || !activeSelection?.promotion_id) return;
    if (appliedPromotionIds.includes(activeSelection.promotion_id)) return;
    const nextIds = [...appliedPromotionIds, activeSelection.promotion_id];
    persistApplied(nextIds);
  }, [restaurantId, activeSelection?.promotion_id, appliedPromotionIds]);

  const activePromotion = useMemo(
    () => items.find((p) => p.id === activeSelection?.promotion_id) || null,
    [items, activeSelection]
  );

  const nonVoucherItems = useMemo(() => items.filter((promotion) => promotion.type !== 'voucher'), [items]);

  const appliedPromotions = useMemo(() => {
    return appliedPromotionIds
      .map((id) => {
        const matched = items.find((p) => p.id === id);
        if (matched) return matched;
        if (activeSelection?.promotion_id === id && activeSelection.type === 'voucher') {
          return {
            id,
            name: activeSelection.promotion_name || 'Voucher promotion',
            type: 'voucher',
            status: 'active',
            starts_at: null,
            ends_at: null,
            min_subtotal: null,
            is_currently_valid: true,
            next_available_at: null,
            invalid_reason: null,
          } as PromotionListItem;
        }
        return null;
      })
      .filter((p): p is PromotionListItem => !!p);
  }, [appliedPromotionIds, items, activeSelection]);

  const availablePromotions = useMemo(
    () => nonVoucherItems.filter((p) => !appliedPromotionIds.includes(p.id)),
    [nonVoucherItems, appliedPromotionIds]
  );

  const persistApplied = (ids: string[]) => {
    if (!restaurantId) return;
    setAppliedPromotionIds(restaurantId, ids);
    setAppliedPromotionIdsState(ids);
  };

  const setPromotionAsActive = (promotion: PromotionListItem, voucherCode?: string | null) => {
    if (!restaurantId) return;
    const next = {
      promotion_id: promotion.id,
      selected_at: new Date().toISOString(),
      type: promotion.type,
      voucher_code: voucherCode || null,
      promotion_name: promotion.name,
    };
    setActivePromotionSelection(restaurantId, next);
    setActiveSelection(next);
  };

  const applyPromotion = (promotion: PromotionListItem) => {
    if (!restaurantId || promotion.type === 'voucher') return;

    if (activeSelection?.type === 'loyalty_redemption' && activeSelection.promotion_id !== promotion.id) {
      setConfirmReplace(promotion);
      return;
    }

    addAppliedPromotionId(restaurantId, promotion.id);
    const nextIds = Array.from(new Set([...appliedPromotionIds, promotion.id]));
    setAppliedPromotionIdsState(nextIds);

    if (!activeSelection) {
      setPromotionAsActive(promotion);
    }
  };

  const makeActive = (promotion: PromotionListItem) => {
    const voucherCode = promotion.type === 'voucher' ? voucherCodes[promotion.id] || null : null;
    setPromotionAsActive(
      promotion,
      activeSelection?.promotion_id === promotion.id ? activeSelection.voucher_code || voucherCode : voucherCode
    );
  };

  const pickBestActivePromotion = async (candidateIds: string[]) => {
    if (!restaurantId || !customerId) return null;
    const candidatePromotions = candidateIds
      .map((id) => items.find((p) => p.id === id))
      .filter((p): p is PromotionListItem => !!p)
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
      const aVoucherPenalty = a.promotion.type === 'voucher' ? 1 : 0;
      const bVoucherPenalty = b.promotion.type === 'voucher' ? 1 : 0;
      if (aVoucherPenalty !== bVoucherPenalty) return aVoucherPenalty - bVoucherPenalty;
      if (a.valid !== b.valid) return a.valid ? -1 : 1;
      return b.savings - a.savings;
    });

    return scored[0]?.promotion || null;
  };

  const removeAppliedPromotion = async (promotionId: string) => {
    if (!restaurantId) return;
    removeAppliedPromotionId(restaurantId, promotionId);
    removeAppliedVoucherCode(restaurantId, promotionId);
    const remainingIds = appliedPromotionIds.filter((id) => id !== promotionId);
    setAppliedPromotionIdsState(remainingIds);
    setVoucherCodes(getAppliedVoucherCodes(restaurantId));

    if (activeSelection?.promotion_id !== promotionId) return;

    if (!remainingIds.length) {
      clearActivePromotionSelection(restaurantId);
      setActiveSelection(null);
      return;
    }

    const bestPromotion = await pickBestActivePromotion(remainingIds);
    if (!bestPromotion) {
      clearActivePromotionSelection(restaurantId);
      setActiveSelection(null);
      return;
    }

    setPromotionAsActive(bestPromotion);
  };

  const removeActive = async () => {
    if (!activeSelection) return;
    await removeAppliedPromotion(activeSelection.promotion_id);
  };

  const redeemLoyalty = async () => {
    if (!restaurantId || !customerId || !loyaltyConfig?.enabled) return;
    setLoyaltyRedeeming(true);
    setLoyaltyError('');
    try {
      const result = await redeemLoyaltyPointsToVoucher({ restaurantId, customerId });
      const payload = (Array.isArray(result) ? result[0] : result) as { promotion_id?: string; voucher_code?: string } | null;

      if (payload?.promotion_id) {
        addAppliedPromotionId(restaurantId, payload.promotion_id);
        setAppliedPromotionIdsState(getAppliedPromotionIds(restaurantId));
      }
      if (payload?.promotion_id && payload?.voucher_code) {
        setAppliedVoucherCode(restaurantId, payload.promotion_id, payload.voucher_code);
        setVoucherCodes(getAppliedVoucherCodes(restaurantId));
        setLastRedeemedVoucherCode(payload.voucher_code);
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

  const scheduleLabel = (promo: PromotionListItem) => {
    if (promo.is_currently_valid) return 'Active now';
    if (promo.next_available_at) {
      const date = new Date(promo.next_available_at).toLocaleString();
      if (promo.status === 'scheduled') return `Starts ${date}`;
      return `Next ${date}`;
    }
    return describeInvalidReason(promo.invalid_reason);
  };

  const rewardPointsRequired = loyaltyConfig?.reward_points_required || 0;
  const loyaltyProgress = rewardPointsRequired > 0 ? Math.min(loyaltyPoints / rewardPointsRequired, 1) : 0;
  const canRedeem = !!loyaltyConfig?.enabled && rewardPointsRequired > 0 && loyaltyPoints >= rewardPointsRequired;

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

        {activeSelection ? (
          <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5 shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Active promotion</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{activePromotion?.name || activeSelection.promotion_name || 'Promotion'}</h3>
                <p className="mt-1 text-sm text-teal-800">{activePromotion ? scheduleLabel(activePromotion) : 'Applied via code at checkout.'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={removeActive}
                  className="rounded-lg border border-teal-300 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-white"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstNonActiveNonVoucher = appliedPromotions.find(
                      (promotion) => promotion.id !== activeSelection.promotion_id && promotion.type !== 'voucher'
                    );
                    if (firstNonActiveNonVoucher) makeActive(firstNonActiveNonVoucher);
                  }}
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700"
                >
                  Change active
                </button>
              </div>
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
          {appliedPromotions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              You have not applied any promotions yet.
            </div>
          ) : (
            appliedPromotions.map((promotion) => {
              const isActive = activeSelection?.promotion_id === promotion.id;
              return (
                <article key={promotion.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${isActive ? 'border-teal-300 ring-1 ring-teal-100' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{promotion.name}</h3>
                        {isActive ? <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700">Active</span> : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{scheduleLabel(promotion)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isActive ? (
                        <button type="button" onClick={() => makeActive(promotion)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          Make active
                        </button>
                      ) : null}
                      <button type="button" onClick={() => removeAppliedPromotion(promotion.id)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                        Remove
                      </button>
                    </div>
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
            availablePromotions.map((promotion) => {
              return (
                <article
                  key={promotion.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{promotion.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            promotion.is_currently_valid
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {promotion.is_currently_valid ? 'Active' : 'Scheduled'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{scheduleLabel(promotion)}</p>
                      {promotion.min_subtotal != null ? (
                        <p className="mt-1 text-xs text-slate-500">Min spend £{promotion.min_subtotal}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => applyPromotion(promotion)}
                      className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700"
                    >
                      Apply
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>

      {confirmReplace ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Replace active offer?</h3>
            <p className="mt-2 text-sm text-slate-600">This will replace your loyalty redemption selection.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" onClick={() => setConfirmReplace(null)}>
                Cancel
              </button>
              <button
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white"
                onClick={() => {
                  if (!restaurantId) return;
                  const next = {
                    promotion_id: confirmReplace.id,
                    selected_at: new Date().toISOString(),
                    type: confirmReplace.type,
                    voucher_code: null,
                    promotion_name: confirmReplace.name,
                  };
                  setActivePromotionSelection(restaurantId, next);
                  setActiveSelection(next);
                  const nextIds = Array.from(new Set([...appliedPromotionIds, confirmReplace.id]));
                  persistApplied(nextIds);
                  setConfirmReplace(null);
                }}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </CustomerLayout>
  );
}
