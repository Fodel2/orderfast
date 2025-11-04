import { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import EmptyState from '@/components/EmptyState';
import { randomEmptyPlateMessage } from '@/lib/uiCopy';

export interface CartViewActionProps {
  subtotal: number;
  cartIsEmpty: boolean;
  clearCart: () => void;
  proceedToCheckout: () => void;
}

interface CartViewProps {
  onClose?: () => void;
  className?: string;
  renderActions?: (props: CartViewActionProps) => ReactNode;
}

const defaultRenderActions = ({ clearCart, proceedToCheckout }: CartViewActionProps) => (
  <>
    <button
      type="button"
      onClick={clearCart}
      className="w-full rounded border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-100"
    >
      Clean Plate
    </button>
    <button
      type="button"
      onClick={proceedToCheckout}
      className="w-full rounded px-4 py-2 text-sm font-semibold text-white transition btn-primary"
    >
      Proceed to Checkout
    </button>
  </>
);

export default function CartView({ onClose, className = '', renderActions = defaultRenderActions }: CartViewProps) {
  const { cart, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();
  const router = useRouter();

  const cartItems = cart.items;
  const cartIsEmpty = cartItems.length === 0;

  const proceedToCheckout = () => {
    router.push('/checkout');
  };

  const actions = renderActions({
    subtotal,
    cartIsEmpty,
    clearCart,
    proceedToCheckout,
  });

  return (
    <div className={`flex h-full flex-col${className ? ` ${className}` : ''}`}>
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">Your Plate</h2>
        {onClose ? (
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        ) : null}
      </div>
      <div
        className="flex-1 overflow-y-auto p-4"
        style={onClose ? { maxHeight: 'calc(100vh - 9rem)' } : undefined}
      >
        {cartIsEmpty ? (
          <EmptyState description={randomEmptyPlateMessage()} className="py-6" />
        ) : (
          cartItems.map((item) => {
            const addonsTotal = (item.addons || []).reduce(
              (sum, addon) => sum + addon.price * addon.quantity,
              0
            );
            const itemTotal = item.price * item.quantity + addonsTotal;
            return (
              <div key={item.item_id} className="border-b py-3 text-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">${(item.price / 100).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.item_id, item.quantity - 1)}
                      className="flex h-6 w-6 items-center justify-center rounded border"
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.item_id, item.quantity + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded border"
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
                {item.addons && item.addons.length > 0 && (
                  <ul className="mt-2 ml-4 space-y-1">
                    {item.addons.map((addon) => (
                      <li key={addon.option_id} className="flex justify-between">
                        <span>
                          {addon.name} × {addon.quantity}
                        </span>
                        <span>${((addon.price * addon.quantity) / 100).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {item.notes ? (
                  <p className="mt-1 ml-4 text-xs italic text-gray-600">{item.notes}</p>
                ) : null}
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-medium">Subtotal: ${(itemTotal / 100).toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.item_id)}
                    className="flex items-center text-sm text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="space-y-3 border-t p-4">
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>${(subtotal / 100).toFixed(2)}</span>
        </div>
        {actions}
      </div>
    </div>
  );
}
