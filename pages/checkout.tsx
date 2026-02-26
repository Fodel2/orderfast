import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { TruckIcon, ShoppingBagIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div;
import { useCart } from '../context/CartContext';
import { useOrderType, OrderType } from '../context/OrderTypeContext';
import { supabase } from '../utils/supabaseClient';
import { useSession } from '@supabase/auth-helpers-react';
import { formatPrice } from '@/lib/orderDisplay';
import {
  addAppliedPromotionId,
  clearActivePromotionSelection,
  describeInvalidReason,
  fetchCustomerPromotions,
  getAppliedPromotionIds,
  getActivePromotionSelection,
  getStableGuestCustomerId,
  setActivePromotionSelection,
  setAppliedPromotionIds,
  setAppliedVoucherCode,
  setPromotionCheckoutBlock,
  resolveVoucherPromotionByCode,
  PromotionListItem,
  validatePromotion,
} from '@/lib/customerPromotions';

export default function CheckoutPage() {
  const { cart, subtotal, clearCart } = useCart();
  const { orderType, setOrderType } = useOrderType();
  const [notes, setNotes] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [step, setStep] = useState(orderType ? 'details' : 'select');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<{ x: number; y: number } | null>(null);
  const [asap, setAsap] = useState(true);
  const router = useRouter();
  const [currencyCode, setCurrencyCode] = useState('GBP');
  const formatAmount = (value: number) => formatPrice(value, currencyCode);

  const selectClass = (type: OrderType) =>
    `border rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer space-y-2 hover:border-teal-600 ${orderType === type ? 'border-teal-600 bg-teal-50' : 'border-gray-300'}`;

  const session = useSession();
  const [placing, setPlacing] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [activeSelection, setActiveSelection] = useState<ReturnType<typeof getActivePromotionSelection>>(null);
  const [promoPreview, setPromoPreview] = useState<{ valid: boolean; text: string; savings: number }>({
    valid: false,
    text: '',
    savings: 0,
  });
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoErrorBanner, setPromoErrorBanner] = useState('');
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [voucherError, setVoucherError] = useState('');

  useEffect(() => {
    if (!cart.restaurant_id) return;
    let active = true;
    supabase
      .from('restaurants')
      .select('currency_code')
      .eq('id', cart.restaurant_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data?.currency_code) {
          setCurrencyCode(data.currency_code);
        }
      });
    return () => {
      active = false;
    };
  }, [cart.restaurant_id]);

  useEffect(() => {
    if (!cart.restaurant_id) return;
    setActiveSelection(getActivePromotionSelection(cart.restaurant_id));
    setCustomerId(session?.user?.id || getStableGuestCustomerId(cart.restaurant_id));
  }, [cart.restaurant_id, session?.user?.id]);

  const deliveryFee = orderType === 'delivery' ? 300 : 0; // cents
  const serviceFee = Math.round(subtotal * 0.05); // 5%

  useEffect(() => {
    const run = async () => {
      if (!cart.restaurant_id || !customerId || !activeSelection?.promotion_id || !orderType) {
        setPromoPreview({ valid: false, text: '', savings: 0 });
        return;
      }

      setPromoLoading(true);
      try {
        const res = await validatePromotion({
          restaurantId: cart.restaurant_id,
          customerId,
          promotionId: activeSelection.promotion_id,
          voucherCode: activeSelection.voucher_code,
          orderType,
          basketSubtotal: subtotal,
          deliveryFee,
        });

        const savings = res.discount_amount + res.delivery_discount_amount;
        if (res.valid) {
          setPromoPreview({ valid: true, text: 'Promotion ready to apply.', savings });
        } else if (res.reason === 'min_subtotal_not_met') {
          setPromoPreview({ valid: false, text: 'Add more to your plate to unlock this offer.', savings: 0 });
        } else {
          setPromoPreview({ valid: false, text: describeInvalidReason(res.reason), savings: 0 });
        }
      } catch {
        setPromoPreview({ valid: false, text: 'Unable to validate promotion right now.', savings: 0 });
      } finally {
        setPromoLoading(false);
      }
    };

    run();
  }, [activeSelection, cart.restaurant_id, customerId, deliveryFee, orderType, subtotal]);

  const finalTotal = Math.max(0, subtotal + serviceFee + deliveryFee - promoPreview.savings);

  const applyVoucherCode = async () => {
    setVoucherError('');
    const code = voucherCodeInput.trim();
    if (!code || !cart.restaurant_id || !customerId || !orderType) {
      setVoucherError('Enter a voucher code.');
      return;
    }

    try {
      const voucherPromotion = await resolveVoucherPromotionByCode({
        restaurantId: cart.restaurant_id,
        code,
      });

      if (!voucherPromotion?.promotion_id) {
        setVoucherError('Code not recognised.');
        return;
      }

      const validation = await validatePromotion({
        restaurantId: cart.restaurant_id,
        customerId,
        promotionId: voucherPromotion.promotion_id,
        voucherCode: code,
        orderType,
        basketSubtotal: subtotal,
        deliveryFee,
      });

      if (!validation.valid) {
        if (validation.reason === 'voucher_not_found') {
          setVoucherError('Code not recognised.');
        } else {
          setVoucherError(describeInvalidReason(validation.reason));
        }
        return;
      }

      const savings = validation.discount_amount + validation.delivery_discount_amount;
      const selection = {
        promotion_id: voucherPromotion.promotion_id,
        selected_at: new Date().toISOString(),
        type: 'voucher',
        voucher_code: code,
        promotion_name: voucherPromotion.promotion_name,
      };
      setActivePromotionSelection(cart.restaurant_id, selection);
      addAppliedPromotionId(cart.restaurant_id, selection.promotion_id);
      setAppliedVoucherCode(cart.restaurant_id, selection.promotion_id, code);
      setActiveSelection(selection);
      setPromoPreview({ valid: true, text: 'Promotion code applied.', savings });
      setVoucherCodeInput('');
    } catch {
      setVoucherError('Could not validate this promotion code.');
    }
  };


  const removeActivePromotion = async () => {
    if (!cart.restaurant_id || !activeSelection?.promotion_id || !customerId || !orderType) return;

    const appliedIds = getAppliedPromotionIds(cart.restaurant_id);
    const remainingIds = appliedIds.filter((id) => id !== activeSelection.promotion_id);
    setAppliedPromotionIds(cart.restaurant_id, remainingIds);

    if (!remainingIds.length) {
      clearActivePromotionSelection(cart.restaurant_id);
      setActiveSelection(null);
      setPromoPreview({ valid: false, text: '', savings: 0 });
      return;
    }

    try {
      const promotions = await fetchCustomerPromotions({
        restaurantId: cart.restaurant_id,
        customerId,
        orderType,
        basketSubtotal: subtotal,
      });

      const candidates = remainingIds
        .map((id) => promotions.find((promotion) => promotion.id === id))
        .filter((promotion): promotion is PromotionListItem => !!promotion)
        .filter((promotion) => promotion.type !== 'voucher');

      const evaluated = await Promise.all(
        candidates.map(async (promotion) => {
          try {
            const validation = await validatePromotion({
              restaurantId: cart.restaurant_id as string,
              customerId,
              promotionId: promotion.id,
              orderType,
              basketSubtotal: subtotal,
              deliveryFee,
            });
            return {
              promotion,
              valid: validation.valid,
              savings: validation.discount_amount + validation.delivery_discount_amount,
            };
          } catch {
            return { promotion, valid: false, savings: 0 };
          }
        })
      );

      evaluated.sort((a, b) => {
        const aVoucherPenalty = a.promotion.type === 'voucher' ? 1 : 0;
        const bVoucherPenalty = b.promotion.type === 'voucher' ? 1 : 0;
        if (aVoucherPenalty !== bVoucherPenalty) return aVoucherPenalty - bVoucherPenalty;
        if (a.valid !== b.valid) return a.valid ? -1 : 1;
        return b.savings - a.savings;
      });

      const bestEvaluation = evaluated[0];
      const nextActive = bestEvaluation?.promotion;
      if (!nextActive) {
        clearActivePromotionSelection(cart.restaurant_id);
        setActiveSelection(null);
        setPromoPreview({ valid: false, text: '', savings: 0 });
        return;
      }

      const nextSelection = {
        promotion_id: nextActive.id,
        selected_at: new Date().toISOString(),
        type: nextActive.type,
        voucher_code: null,
        promotion_name: nextActive.name,
      };
      setActivePromotionSelection(cart.restaurant_id, nextSelection);
      setActiveSelection(nextSelection);
      setPromoPreview({
        valid: !!bestEvaluation?.valid,
        text: bestEvaluation?.valid ? 'Promotion ready to apply.' : 'Promotion selected.',
        savings: bestEvaluation?.savings || 0,
      });
    } catch {
      clearActivePromotionSelection(cart.restaurant_id);
      setActiveSelection(null);
      setPromoPreview({ valid: false, text: '', savings: 0 });
    }
  };

  const placeOrder = async () => {
    if (!cart.restaurant_id || !orderType || !customerId) return;

    if (activeSelection?.promotion_id) {
      try {
        const validation = await validatePromotion({
          restaurantId: cart.restaurant_id,
          customerId,
          promotionId: activeSelection.promotion_id,
          voucherCode: activeSelection.voucher_code,
          orderType,
          basketSubtotal: subtotal,
          deliveryFee,
        });

        if (!validation.valid) {
          const details = describeInvalidReason(validation.reason);
          setPromotionCheckoutBlock(cart.restaurant_id, { reason: validation.reason || 'invalid', details });
          setPromoErrorBanner(details);
          router.push({ pathname: '/restaurant/cart', query: { restaurant_id: cart.restaurant_id } });
          return;
        }
      } catch {
        setPromotionCheckoutBlock(cart.restaurant_id, {
          reason: 'validation_failed',
          details: 'Unable to validate your promotion at checkout.',
        });
        router.push({ pathname: '/restaurant/cart', query: { restaurant_id: cart.restaurant_id } });
        return;
      }
    }

    setPlacing(true);

    const { data: restaurantSettings, error: settingsError } = await supabase
      .from('restaurants')
      .select('auto_accept_app_orders')
      .eq('id', cart.restaurant_id)
      .maybeSingle();

    if (settingsError) {
      console.error('[checkout] failed to load restaurant settings', settingsError);
    }

    const autoAcceptApp = !!restaurantSettings?.auto_accept_app_orders;
    const initialStatus = autoAcceptApp ? 'accepted' : 'pending';
    const acceptedAt = autoAcceptApp ? new Date().toISOString() : null;
    const totalPrice = finalTotal;

    try {
      if (!cart.restaurant_id) {
        throw new Error('Missing restaurant id for checkout order');
      }
      const { data: order, error } = await supabase
        .from('orders')
        .insert([
          {
            restaurant_id: cart.restaurant_id,
            user_id: customerId,
            order_type: orderType,
            source: 'app',
            delivery_address:
              orderType === 'delivery'
                ? { address_line_1: address, address_line_2: null, postcode: null }
                : null,
            phone_number: phone,
            customer_notes: notes || null,
            scheduled_for: !asap ? scheduledFor || null : null,
            status: initialStatus,
            accepted_at: acceptedAt,
            total_price: totalPrice,
            service_fee: serviceFee,
            delivery_fee: deliveryFee,
          },
        ])
        .select('id, short_order_number')
        .single();

      if (error || !order) throw error || new Error('Failed to insert order');

      for (const item of cart.items) {
        const { data: oi, error: oiErr } = await supabase
          .from('order_items')
          .insert([
            {
              order_id: order.id,
              item_id: item.item_id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              notes: item.notes || null,
            },
          ])
          .select('id')
          .single();
        if (oiErr || !oi) throw oiErr || new Error('Failed to insert order item');

        for (const addon of item.addons || []) {
          const { error: oaErr } = await supabase.from('order_addons').insert([
            {
              order_item_id: oi.id,
              option_id: addon.option_id,
              name: addon.name,
              price: addon.price,
              quantity: addon.quantity,
            },
          ]);
          if (oaErr) throw oaErr;
        }
      }

      clearCart();
      const resolvedOrderNumber = order.short_order_number ?? 0;
      router.push(`/order-confirmation?order_number=${resolvedOrderNumber}`);
    } catch (err) {
      console.error(err);
      setPromoErrorBanner('Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (!cart.items.length) {
    return (
      <div className="p-6 text-center">
        <p>Your cart is empty.</p>
        <button
          type="button"
          onClick={() => router.push('/menu')}
          className="mt-4 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
        >
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Checkout</h1>
      {promoErrorBanner ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{promoErrorBanner}</div>
      ) : null}
      <AnimatePresence mode="wait">
        {step === 'select' && (
          <MotionDiv
            key="select"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col items-center justify-center space-y-6"
          >
            <h2 className="text-lg font-semibold mb-3 text-center">Choose Order Type</h2>
            <div className="grid grid-cols-2 gap-4 w-full">
              <div
                className={selectClass('delivery')}
                onClick={() => {
                  setOrderType('delivery');
                  setStep('details');
                }}
              >
                <TruckIcon className="w-12 h-12" />
                <span className="text-lg font-medium">Delivery</span>
              </div>
              <div
                className={selectClass('collection')}
                onClick={() => {
                  setOrderType('collection');
                  setStep('details');
                }}
              >
                <ShoppingBagIcon className="w-12 h-12" />
                <span className="text-lg font-medium">Collection</span>
              </div>
            </div>
          </MotionDiv>
        )}
        {step === 'details' && (
          <MotionDiv
            key="details"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6 flex-1"
          >
            <div>
              <div
                className="h-40 bg-gray-200 rounded flex items-center justify-center relative mb-4"
                onClick={() => orderType === 'delivery' && setLocation({ x: 0, y: 0 })}
              >
                {orderType === 'delivery' ? (
                  <span className="text-gray-600">Tap to set delivery location</span>
                ) : (
                  <span className="text-gray-600">Restaurant location</span>
                )}
                {location && orderType === 'delivery' && <MapPinIcon className="w-6 h-6 text-red-600 absolute" />}
              </div>
              {orderType === 'delivery' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  className="w-full border rounded p-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  pattern="^[0-9+\- ]+$"
                />
              </div>

              <div className="mb-4 space-x-4 flex items-center">
                <label className="font-medium">Time:</label>
                <label className="flex items-center space-x-1">
                  <input type="radio" checked={asap} onChange={() => setAsap(true)} />
                  <span>ASAP</span>
                </label>
                <label className="flex items-center space-x-1">
                  <input type="radio" checked={!asap} onChange={() => setAsap(false)} />
                  <span>Scheduled</span>
                </label>
                {!asap && (
                  <input
                    type="datetime-local"
                    className="border rounded p-1 ml-2"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                  />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-4">Estimated delivery time: 30-40 mins</p>
              <h2 className="text-lg font-semibold mb-2">Order Summary</h2>
              <ul className="space-y-4">
                {cart.items.map((item) => {
                  const itemQuantity = item.quantity;
                  const addonsTotal = (item.addons || []).reduce(
                    (sum, a) => sum + a.price * a.quantity * itemQuantity,
                    0
                  );
                  const total = item.price * itemQuantity + addonsTotal;
                  return (
                    <li key={item.item_id} className="border rounded p-3 text-sm">
                      <div className="flex justify-between">
                        <span>
                          {item.name} × {item.quantity}
                        </span>
                        <span>{formatAmount(total)}</span>
                      </div>
                      {item.addons && item.addons.length > 0 && (
                        <ul className="mt-2 space-y-1 pl-4 text-gray-600">
                          {item.addons.map((a) => {
                            const addonQuantity = a.quantity * itemQuantity;
                            return (
                              <li key={a.option_id} className="flex justify-between">
                                <span>
                                  {a.name} × {addonQuantity}
                                </span>
                                <span>{formatAmount(a.price * addonQuantity)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {item.notes && <p className="mt-1 italic text-gray-600 pl-4">{item.notes}</p>}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Order Notes (optional)</label>
                  <textarea
                    className="w-full border rounded p-2"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>


              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <label className="block text-sm font-medium mb-1">Voucher code</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    value={voucherCodeInput}
                    onChange={(e) => setVoucherCodeInput(e.target.value)}
                    placeholder="Enter code"
                  />
                  <button
                    type="button"
                    onClick={applyVoucherCode}
                    className="rounded bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    Apply code
                  </button>
                </div>
                {voucherError ? <p className="mt-1 text-xs text-rose-600">{voucherError}</p> : null}
              </div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
      {step === 'details' && (
        <div className="mt-6 border-t pt-4">
          {activeSelection?.promotion_id ? (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">Active promotion{activeSelection.promotion_name ? `: ${activeSelection.promotion_name}` : ''}</p>
                  <p className="mt-1 text-slate-600">{promoLoading ? 'Checking promotion...' : promoPreview.text || 'Promotion selected.'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={removeActivePromotion}
                    className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/restaurant/promotions')}
                    className="rounded bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex justify-between mb-2">
            <span>Subtotal</span>
            <span>{formatAmount(subtotal)}</span>
          </div>
          {orderType === 'delivery' && (
            <div className="flex justify-between mb-2">
              <span>Delivery Fee</span>
              <span>{formatAmount(deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between mb-2">
            <span>Service Fee</span>
            <span>{formatAmount(serviceFee)}</span>
          </div>
          {promoPreview.savings > 0 ? (
            <div className="flex justify-between mb-2 text-emerald-700">
              <span>Savings</span>
              <span>-{formatAmount(promoPreview.savings)}</span>
            </div>
          ) : null}
          <div className="flex justify-between font-semibold text-lg mb-4">
            <span>Total</span>
            <span>{formatAmount(finalTotal)}</span>
          </div>
          <button
            type="button"
            onClick={placeOrder}
            disabled={placing}
            className="w-full py-3 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
          >
            {placing ? 'Placing...' : 'Place Order'}
          </button>
        </div>
      )}
    </div>
  );
}

export async function getStaticProps() {
  return {
    props: {
      customerMode: true,
      cartCount: 0,
    },
  };
}
