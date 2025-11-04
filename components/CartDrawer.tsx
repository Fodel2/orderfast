import { ReactNode, useEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { ShoppingCartIcon } from '@heroicons/react/24/outline';
import CartView, { CartViewActionProps } from '@/components/CartView';

interface CartDrawerProps {
  /**
   * When true, renders the drawer content inline with no toggle button
   * or overlay. Used for the full cart page.
   */
  inline?: boolean;
  renderActions?: (props: CartViewActionProps) => ReactNode;
}

export default function CartDrawer({ inline = false, renderActions }: CartDrawerProps) {
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
    return (
      <div className="max-w-screen-sm mx-auto px-4 pt-6">
        <CartView renderActions={renderActions} />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className={`fixed bottom-4 right-4 rounded-full px-4 py-2 flex items-center shadow-lg z-50 transition-transform btn-primary ${
          bounce ? 'animate-bounce' : ''
        }`}
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
            <CartView onClose={toggle} renderActions={renderActions} />
          </div>
        </>
      )}
    </>
  );
}
