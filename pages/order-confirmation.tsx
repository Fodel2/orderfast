import { useRouter } from 'next/router';
import { useCart } from '../context/CartContext';
import CustomerLayout from '../components/CustomerLayout';

export default function OrderConfirmation() {
  const router = useRouter();
  const { order_number } = router.query;
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <CustomerLayout cartCount={itemCount}>
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Thank you for your order!</h1>
        {order_number && (
          <p>Your order number is {String(order_number).padStart(4, '0')}.</p>
        )}
        <a href="/" className="mt-4 inline-block px-4 py-2 bg-teal-600 text-white rounded">
          Back to Home
        </a>
      </div>
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
