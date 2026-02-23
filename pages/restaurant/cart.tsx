import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { useCart } from '../../context/CartContext';
import { useOrderType } from '../../context/OrderTypeContext';
import CustomerLayout from '../../components/CustomerLayout';
import CartDrawer from '../../components/CartDrawer';
import {
  consumePromotionCheckoutBlock,
  describeInvalidReason,
  getActivePromotionSelection,
  getStableGuestCustomerId,
  validatePromotion,
} from '@/lib/customerPromotions';
import { useRestaurant } from '@/lib/restaurant-context';

export default function CartPage() {
  const { cart, subtotal } = useCart();
  const { orderType } = useOrderType();
  const session = useSession();
  const { restaurantId } = useRestaurant();
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [activeSelection, setActiveSelection] = useState<ReturnType<typeof getActivePromotionSelection>>(null);
  const [promoStatus, setPromoStatus] = useState<string>('');
  const [promoSavings, setPromoSavings] = useState(0);
  const [blockMessage, setBlockMessage] = useState<{ reason: string; details?: string } | null>(null);

  const currentRestaurantId = restaurantId || cart.restaurant_id || null;
  const currentOrderType = orderType || 'delivery';
  const deliveryFee = currentOrderType === 'delivery' ? 300 : 0;

  useEffect(() => {
    if (!currentRestaurantId) return;
    setActiveSelection(getActivePromotionSelection(currentRestaurantId));
    setCustomerId(session?.user?.id || getStableGuestCustomerId(currentRestaurantId));
    setBlockMessage(consumePromotionCheckoutBlock(currentRestaurantId));
  }, [currentRestaurantId, session?.user?.id]);

  useEffect(() => {
    const run = async () => {
      if (!currentRestaurantId || !customerId || !activeSelection?.promotion_id) {
        setPromoStatus('');
        setPromoSavings(0);
        return;
      }

      try {
        const result = await validatePromotion({
          restaurantId: currentRestaurantId,
          customerId,
          promotionId: activeSelection.promotion_id,
          voucherCode: activeSelection.voucher_code,
          orderType: currentOrderType,
          basketSubtotal: subtotal,
          deliveryFee,
        });

        const totalSavings = result.discount_amount + result.delivery_discount_amount;
        setPromoSavings(totalSavings);

        if (result.valid) {
          setPromoStatus('Ready to apply at checkout.');
          return;
        }

        if (result.reason === 'min_subtotal_not_met') {
          const delta = Math.max(0, Math.ceil((subtotal + 1) / 100) - subtotal / 100);
          setPromoStatus(`Will apply when you spend about £${delta.toFixed(2)} more.`);
          return;
        }

        setPromoStatus(describeInvalidReason(result.reason));
      } catch {
        setPromoStatus('Unable to validate this offer right now.');
        setPromoSavings(0);
      }
    };

    run();
  }, [activeSelection, currentOrderType, currentRestaurantId, customerId, deliveryFee, subtotal]);

  const hasPromo = useMemo(() => !!activeSelection?.promotion_id, [activeSelection]);

  return (
    <CustomerLayout cartCount={itemCount}>
      <div className="mx-auto w-full max-w-4xl px-2 pt-3 sm:px-4 sm:pt-5">
        {blockMessage ? (
          <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <p className="font-semibold">Promotion couldn’t be applied at payment.</p>
            <p className="mt-1">{blockMessage.details || describeInvalidReason(blockMessage.reason)}</p>
          </div>
        ) : null}

        {hasPromo ? (
          <div className="mb-3 rounded-2xl border border-teal-200 bg-teal-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Active promotion</p>
            <p className="mt-1 text-sm text-slate-800">{promoStatus || 'Checking offer status...'}</p>
            <p className="mt-1 text-sm font-semibold text-teal-700">Estimated savings: £{(promoSavings / 100).toFixed(2)}</p>
          </div>
        ) : (
          <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
            No active promotion selected. You can apply multiple promotions and keep one active for checkout.
          </div>
        )}
      </div>
      <CartDrawer inline />
    </CustomerLayout>
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
