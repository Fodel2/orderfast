import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { useCart } from '../../context/CartContext';
import CustomerLayout from '../../components/CustomerLayout';
import CartDrawer from '../../components/CartDrawer';
import {
  consumePromotionCheckoutBlock,
  describeInvalidReason,
  getStableGuestCustomerId,
} from '@/lib/customerPromotions';
import { useRestaurant } from '@/lib/restaurant-context';

export default function CartPage() {
  const { cart } = useCart();
  const session = useSession();
  const { restaurantId } = useRestaurant();
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  const [blockMessage, setBlockMessage] = useState<{ reason: string; details?: string } | null>(null);

  const currentRestaurantId = restaurantId || cart.restaurant_id || null;

  useEffect(() => {
    if (!currentRestaurantId) return;
    getStableGuestCustomerId(currentRestaurantId);
    setBlockMessage(consumePromotionCheckoutBlock(currentRestaurantId));
  }, [currentRestaurantId, session?.user?.id]);

  return (
    <CustomerLayout cartCount={itemCount}>
      <div className="mx-auto w-full max-w-4xl px-2 pt-3 sm:px-4 sm:pt-5">
        {blockMessage ? (
          <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <p className="font-semibold">Promotion couldn’t be applied at payment.</p>
            <p className="mt-1">{blockMessage.details || describeInvalidReason(blockMessage.reason)}</p>
          </div>
        ) : null}
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
