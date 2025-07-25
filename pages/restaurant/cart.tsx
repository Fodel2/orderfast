import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import CustomerLayout from '../../components/CustomerLayout';

export default function CartPage() {
  const { cart, subtotal, updateQuantity, removeFromCart } = useCart();

  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <CustomerLayout cartCount={itemCount}>
      <main className="max-w-screen-sm mx-auto px-4 pb-28 pt-6">
        <h1 className="text-2xl font-bold mb-6">Your Cart</h1>
        {cart.items.length === 0 ? (
          <div className="text-center text-gray-500 mt-12">
            <p>Your cart is empty</p>
            <Link
              href="/menu"
              className="mt-4 inline-block px-4 py-2 bg-primary text-white rounded-full"
            >
              Browse Menu
            </Link>
          </div>
        ) : (
          <div>
            {cart.items.map((item) => {
              const img = (item as any).image_url as string | undefined;
              const tag = (item as any).tag as string | undefined;
              return (
                <div
                  key={item.item_id}
                  className="flex justify-between items-center p-4 rounded-xl shadow-sm mb-3"
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
                      <p className="text-sm text-gray-600">${(item.price / 100).toFixed(2)}</p>
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
                      className="text-xs text-red-500 underline ml-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {cart.items.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white px-4 py-3 shadow-md">
            <p className="text-right font-semibold">Total: ${(subtotal / 100).toFixed(2)}</p>
            <Link
              href="/checkout"
              className="bg-primary text-white rounded-full w-full py-3 block text-center mt-2"
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
