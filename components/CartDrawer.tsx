import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useCart } from '../context/CartContext';
import { XMarkIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { Trash2 } from 'lucide-react';
import PlateIcon from '@/components/icons/PlateIcon';
import { randomEmptyPlateMessage } from '@/lib/uiCopy';

interface CartDrawerProps {
  /**
   * When true, renders the drawer content inline with no toggle button
   * or overlay. Used for the full cart page.
   */
  inline?: boolean;
}

function CartContent({ onClose }: { onClose?: () => void }) {
  const { cart, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();
  const router = useRouter();

  return (
    <>
      <div className="p-4 flex justify-between items-center border-b">
        <h2 className="text-lg font-semibold">Your Plate</h2>
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="text-gray-500">
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      <div
        className="p-4 overflow-y-auto"
        style={onClose ? { maxHeight: 'calc(100vh - 9rem)' } : undefined}
      >
        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <PlateIcon size={64} className="text-gray-300" />
            <p className="text-center text-gray-500">{randomEmptyPlateMessage()}</p>
          </div>
        ) : (
          cart.items.map((item) => {
            const addonsTotal = (item.addons || []).reduce(
              (sum, a) => sum + a.price * a.quantity,
              0
            );
            const itemTotal = item.price * item.quantity + addonsTotal;
            return (
              <div key={item.item_id} className="border-b py-3 text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      ${(item.price / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.item_id, item.quantity - 1)}
                      className="w-6 h-6 flex items-center justify-center border rounded"
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.item_id, item.quantity + 1)}
                      className="w-6 h-6 flex items-center justify-center border rounded"
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
                        <span>
                          ${((addon.price * addon.quantity) / 100).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {item.notes && (
                  <p className="mt-1 ml-4 text-xs italic text-gray-600">
                    {item.notes}
                  </p>
                )}
                <div className="mt-2 flex justify-between items-center">
                  <span className="font-medium">
                    Subtotal: ${(itemTotal / 100).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.item_id)}
                    className="text-red-600 flex items-center text-sm"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="p-4 border-t space-y-2">
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>${(subtotal / 100).toFixed(2)}</span>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className="w-full px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Clean Plate
        </button>
        <button
          type="button"
          onClick={() => router.push('/checkout')}
          className="w-full px-4 py-2 rounded hover:opacity-90 btn-primary"
        >
          Proceed to Checkout
        </button>
      </div>
    </>
  );
}

export default function CartDrawer({ inline = false }: CartDrawerProps) {
  const { cart } = useCart();
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen((o) => !o);

  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  const prevCount = useRef(itemCount);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    if (itemCount > prevCount.current) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 300);
      return () => clearTimeout(t);
    }
    prevCount.current = itemCount;
  }, [itemCount]);

  if (inline) {
    // Render content directly without drawer behaviour
    return (
      <div className="max-w-screen-sm mx-auto px-4 pt-6">
        <CartContent />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className={`fixed bottom-4 right-4 rounded-full px-4 py-2 flex items-center shadow-lg z-50 transition-transform btn-primary ${bounce ? 'animate-bounce' : ''}`}
        aria-label="Toggle cart"
      >
        <ShoppingCartIcon className="w-5 h-5 mr-2" />
        <span>
          Cart ({itemCount} {itemCount === 1 ? 'item' : 'items'})
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={toggle} />
          <div className="fixed inset-y-0 right-0 w-80 max-w-full bg-white shadow-lg z-50">
            <CartContent onClose={toggle} />
          </div>
        </>
      )}
    </>
  );
}
