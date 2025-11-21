import { useEffect, useRef, useState } from 'react';
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

function CartContent({
  onClose,
  emptyMessage,
  inline = false,
}: {
  onClose?: () => void;
  emptyMessage: string;
  inline?: boolean;
}) {
  const { cart, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();

  return (
    <>
      {!inline ? (
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Your Plate</h2>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="text-gray-500">
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      ) : null}
      <div
        className={`overflow-y-auto p-4 ${inline ? 'pb-10 sm:pb-16' : ''}`}
        style={onClose ? { maxHeight: 'calc(100vh - 9rem)' } : undefined}
      >
        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-neutral-500">
            <PlateIcon size={72} className="text-gray-300" />
            <p className="text-lg font-medium text-slate-500">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {cart.items.map((item) => {
              const addonsTotal = (item.addons || []).reduce(
                (sum, a) => sum + a.price * a.quantity,
                0
              );
              const itemTotal = item.price * item.quantity + addonsTotal;
              return (
                <div
                  key={item.item_id}
                  className="rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_14px_50px_-28px_rgba(15,23,42,0.35)] sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="space-y-1">
                        <p className="text-xl font-semibold text-slate-900 sm:text-2xl">{item.name}</p>
                        <p className="text-base text-slate-500 sm:text-lg">
                          ${(item.price / 100).toFixed(2)} each
                        </p>
                      </div>
                      {item.addons && item.addons.length > 0 && (
                        <ul className="space-y-1 pl-4 text-base text-slate-600 sm:text-lg">
                          {item.addons.map((addon) => (
                            <li key={addon.option_id} className="flex justify-between gap-3">
                              <span className="flex-1">{addon.name} × {addon.quantity}</span>
                              <span className="font-medium text-slate-700">
                                ${((addon.price * addon.quantity) / 100).toFixed(2)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.notes && (
                        <p className="text-sm italic text-slate-600">{item.notes}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span className="text-lg font-semibold text-slate-900 sm:text-xl">
                        ${(itemTotal / 100).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.item_id)}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600 transition hover:text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" /> Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center rounded-full bg-slate-100 px-2 py-1 text-lg font-semibold text-slate-900 shadow-inner shadow-slate-200">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.item_id, item.quantity - 1)}
                        className="flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-transform duration-150 hover:scale-[1.02] active:scale-95"
                        aria-label={`Decrease ${item.name}`}
                      >
                        –
                      </button>
                      <span className="min-w-[2.5rem] text-center text-xl font-bold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.item_id, item.quantity + 1)}
                        className="flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-transform duration-150 hover:scale-[1.02] active:scale-95"
                        aria-label={`Increase ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right text-sm text-slate-500 sm:text-base">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Subtotal</p>
                      <p className="text-lg font-semibold text-slate-900 sm:text-xl">${(itemTotal / 100).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {inline ? (
        cart.items.length > 0 ? (
          <div className="flex items-center justify-end border-t px-4 py-3 text-sm text-slate-600">
            <button
              type="button"
              onClick={clearCart}
              className="text-sm font-semibold text-slate-500 underline underline-offset-4 transition hover:text-slate-700"
            >
              Clean Plate
            </button>
          </div>
        ) : null
      ) : (
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-600">
          <span className="text-base font-semibold text-slate-900 sm:text-lg">Subtotal: ${(subtotal / 100).toFixed(2)}</span>
          <button
            type="button"
            onClick={clearCart}
            className="text-sm font-semibold text-slate-500 underline underline-offset-4 transition hover:text-slate-700"
          >
            Clean Plate
          </button>
        </div>
      )}
    </>
  );
}

export default function CartDrawer({ inline = false }: CartDrawerProps) {
  const { cart } = useCart();
  const [emptyMessage] = useState(() => randomEmptyPlateMessage());
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
      <div className="mx-auto w-full max-w-4xl px-2 pb-6 pt-2 sm:px-4 sm:pt-6">
        <CartContent emptyMessage={emptyMessage} inline />
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
            <CartContent onClose={toggle} emptyMessage={emptyMessage} />
          </div>
        </>
      )}
    </>
  );
}
