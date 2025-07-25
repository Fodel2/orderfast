import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import CustomerLayout from '../components/CustomerLayout';

export default function CartPage() {
  const { cart, subtotal, updateQuantity, removeFromCart } = useCart();

  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <CustomerLayout cartCount={itemCount}>
      <main className="pb-24 pt-4 max-w-screen-sm mx-auto px-4">
        <h1 className="text-2xl font-bold mb-4">Cart</h1>
        {cart.items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">Your cart is empty</p>
            <Link href="/menu" className="px-4 py-2 bg-primary text-white rounded-full">
              Browse Menu
            </Link>
          </div>
        ) : (
          <ul>
            {cart.items.map((item) => {
              const img = (item as any).image_url as string | undefined;
              const tag = (item as any).tag as string | undefined;
              return (
                <li
                  key={item.item_id}
                  className="rounded-xl shadow-sm p-4 mb-3 flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    {img && (
                      <img
                        src={img}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    )}
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-gray-500">${(item.price / 100).toFixed(2)}</p>
                      {tag && <span className="text-xs text-gray-500">{tag}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateQuantity(item.item_id, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center border rounded"
                      >
                        -
                      </motion.button>
                      <span>{item.quantity}</span>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateQuantity(item.item_id, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center border rounded"
                      >
                        +
                      </motion.button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.item_id)}
                      className="text-xs text-red-500 mt-1"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {cart.items.length > 0 && (
          <div className="sticky bottom-0 bg-white p-4">
            <p className="text-right font-semibold">
              Total: ${(subtotal / 100).toFixed(2)}
            </p>
            <Link
              href="/checkout"
              className="rounded-full bg-primary text-white w-full mt-4 py-2 block text-center"
            >
              Continue to Checkout
            </Link>
          </div>
        )}
      </main>
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
