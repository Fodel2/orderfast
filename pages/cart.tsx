import Link from 'next/link';
import { useCart } from '../context/CartContext';

export default function CartPage() {
  const { cart, subtotal, updateQuantity, removeFromCart } = useCart();

  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <main className="p-4 pb-24 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your Cart</h1>
      {cart.items.length === 0 ? (
        <p className="text-center text-gray-500">Your cart is empty.</p>
      ) : (
        <ul className="space-y-4">
          {cart.items.map((item) => (
            <li key={item.item_id} className="border p-3 rounded flex justify-between items-start">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-500">${(item.price / 100).toFixed(2)}</p>
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
                <button
                  type="button"
                  onClick={() => removeFromCart(item.item_id)}
                  className="text-sm text-red-500"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {cart.items.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-right font-semibold">Subtotal: ${(subtotal / 100).toFixed(2)}</p>
          <Link href="/checkout" className="block text-center py-2 bg-teal-600 text-white rounded">
            Proceed to Checkout ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </Link>
        </div>
      )}
    </main>
  );
}
