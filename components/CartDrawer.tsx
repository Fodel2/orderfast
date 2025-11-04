import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useCart } from '../context/CartContext';
import { XMarkIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { Trash2 } from 'lucide-react';
import PlateIcon from '@/components/icons/PlateIcon';
import { randomEmptyPlateMessage } from '@/lib/uiCopy';

type CartMode = 'customer' | 'kiosk';

interface CartDrawerProps {
  /**
   * When true, renders the drawer content inline with no toggle button
   * or overlay. Used for the full cart page.
   */
  inline?: boolean;
  mode?: CartMode;
}

function CartContent({ onClose, mode = 'customer' }: { onClose?: () => void; mode?: CartMode }) {
  const { cart, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();
  const router = useRouter();
  const isKiosk = mode === 'kiosk';
  const containerPadding = isKiosk ? 'px-6 py-5' : 'p-4';
  const listPadding = isKiosk ? 'px-6 pb-2' : 'p-4';
  const headingClass = isKiosk ? 'text-2xl font-semibold' : 'text-lg font-semibold';
  const buttonSize = isKiosk ? 'rounded-full px-6 py-3 text-lg' : 'rounded px-4 py-2 text-sm sm:text-base';
  const secondaryButtonSize = isKiosk ? 'rounded-full px-6 py-3 text-base' : 'rounded px-4 py-2';
  const itemText = isKiosk ? 'text-base' : 'text-sm';

  return (
    <>
      <div className={`${containerPadding} flex items-center justify-between border-b`}> 
        <h2 className={headingClass}>Your Plate</h2>
        {onClose && (
          <button onClick={onClose} aria-label="Close" className="text-gray-500 transition hover:text-gray-700">
            <XMarkIcon className={`w-6 h-6 ${isKiosk ? 'md:w-7 md:h-7' : ''}`} />
          </button>
        )}
      </div>
      <div
        className={`${listPadding} overflow-y-auto`}
        style={onClose ? { maxHeight: 'calc(100vh - 9rem)' } : undefined}
      >
        {cart.items.length === 0 ? (
          <div className={`flex flex-col items-center gap-3 py-8 ${isKiosk ? 'text-base' : 'text-sm'}`}>
            <PlateIcon size={isKiosk ? 96 : 64} className="text-gray-300" />
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
              <div key={item.item_id} className={`border-b py-4 ${itemText}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      ${(item.price / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.item_id, item.quantity - 1)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-base font-semibold transition hover:bg-slate-50 ${isKiosk ? 'h-10 w-10 text-lg' : ''}`}
                    >
                      -
                    </button>
                    <span className="min-w-[2rem] text-center font-semibold text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.item_id, item.quantity + 1)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-base font-semibold transition hover:bg-slate-50 ${isKiosk ? 'h-10 w-10 text-lg' : ''}`}
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
                    className={`flex items-center text-red-600 transition hover:text-red-700 ${isKiosk ? 'text-base' : 'text-sm'}`}
                  >
                    <Trash2 className={`mr-1 ${isKiosk ? 'h-5 w-5' : 'h-4 w-4'}`} /> Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className={`${containerPadding} border-t space-y-3`}> 
        <div className="flex items-center justify-between font-semibold text-slate-900">
          <span>Subtotal</span>
          <span>${(subtotal / 100).toFixed(2)}</span>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className={`w-full bg-gray-200 text-slate-700 transition hover:bg-gray-300 ${secondaryButtonSize}`}
        >
          Clean Plate
        </button>
        <button
          type="button"
          onClick={() => router.push('/checkout')}
          className={`w-full btn-primary transition hover:opacity-95 ${buttonSize}`}
        >
          Proceed to Checkout
        </button>
      </div>
    </>
  );
}

export default function CartDrawer({ inline = false, mode = 'customer' }: CartDrawerProps) {
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
      <div className={`mx-auto px-4 pt-6 ${mode === 'kiosk' ? 'max-w-screen-md sm:px-6 sm:pt-8' : 'max-w-screen-sm'}`}>
        <CartContent mode={mode} />
      </div>
    );
  }

  if (mode === 'kiosk') {
    return (
      <div className="mx-auto w-full max-w-screen-md px-6 py-8">
        <CartContent mode="kiosk" />
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
            <CartContent onClose={toggle} mode={mode} />
          </div>
        </>
      )}
    </>
  );
}
