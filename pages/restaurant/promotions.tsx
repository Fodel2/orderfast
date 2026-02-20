import { useEffect, useMemo, useState } from 'react';
import CustomerLayout from '@/components/CustomerLayout';
import { useCart } from '@/context/CartContext';
import { useOrderType } from '@/context/OrderTypeContext';
import { useSession } from '@supabase/auth-helpers-react';
import { useRestaurant } from '@/lib/restaurant-context';
import {
  ActivePromotionSelection,
  clearActivePromotionSelection,
  describeInvalidReason,
  fetchCustomerPromotions,
  getActivePromotionSelection,
  getStableGuestCustomerId,
  PromotionListItem,
  setActivePromotionSelection,
} from '@/lib/customerPromotions';

export default function CustomerPromotionsPage() {
  const { cart, subtotal } = useCart();
  const { orderType } = useOrderType();
  const session = useSession();
  const { restaurantId, loading: restaurantLoading } = useRestaurant();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PromotionListItem[]>([]);
  const [activeSelection, setActiveSelection] = useState<ActivePromotionSelection | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<PromotionListItem | null>(null);

  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const currentOrderType = orderType || 'delivery';

  useEffect(() => {
    if (!restaurantId) return;
    const resolved = session?.user?.id || getStableGuestCustomerId(restaurantId);
    setCustomerId(resolved || null);
    setActiveSelection(getActivePromotionSelection(restaurantId));
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
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, customerId, currentOrderType, subtotal, cart.items.length]);

  const activePromotion = useMemo(
    () => items.find((p) => p.id === activeSelection?.promotion_id) || null,
    [items, activeSelection]
  );

  const sortedPromotions = useMemo(() => {
    if (!activeSelection) return items;
    const selected = items.find((p) => p.id === activeSelection.promotion_id);
    const rest = items.filter((p) => p.id !== activeSelection.promotion_id);
    return selected ? [selected, ...rest] : items;
  }, [items, activeSelection]);

  const applyPromotion = (promotion: PromotionListItem) => {
    if (!restaurantId) return;

    if (activeSelection?.type === 'loyalty_redemption' && activeSelection.promotion_id !== promotion.id) {
      setConfirmReplace(promotion);
      return;
    }

    const next = {
      promotion_id: promotion.id,
      selected_at: new Date().toISOString(),
      type: promotion.type,
      voucher_code: activeSelection?.promotion_id === promotion.id ? activeSelection.voucher_code || null : null,
    };
    setActivePromotionSelection(restaurantId, next);
    setActiveSelection(next);
  };

  const removeActive = () => {
    if (!restaurantId) return;
    clearActivePromotionSelection(restaurantId);
    setActiveSelection(null);
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
        <p className="text-sm text-slate-600">One offer per order.</p>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Loyalty</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">Coming soon</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Points</p>
              <p className="text-lg font-semibold text-slate-800">—</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Value</p>
              <p className="text-lg font-semibold text-slate-800">£—</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Redeem</p>
              <div className="mt-1 flex items-center gap-2">
                <input disabled className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm" placeholder="0.00" />
                <button disabled className="rounded-lg bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">Redeem</button>
              </div>
            </div>
          </div>
        </section>

        {activeSelection && activePromotion ? (
          <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Active promotion</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{activePromotion.name}</h3>
                <p className="mt-1 text-sm text-teal-800">{scheduleLabel(activePromotion)}</p>
              </div>
              <button
                type="button"
                onClick={removeActive}
                className="rounded-lg border border-teal-300 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-white"
              >
                Remove
              </button>
            </div>
          </section>
        ) : null}

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
          ) : sortedPromotions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No offers available right now.
            </div>
          ) : (
            sortedPromotions.map((promotion) => {
              const selected = activeSelection?.promotion_id === promotion.id;
              return (
                <article
                  key={promotion.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm transition-all ${
                    selected ? 'border-teal-300 ring-2 ring-teal-100' : 'border-slate-200'
                  }`}
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
                      {selected ? 'Selected' : 'Apply'}
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
                  };
                  setActivePromotionSelection(restaurantId, next);
                  setActiveSelection(next);
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
