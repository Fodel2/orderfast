import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { useCart } from '../context/CartContext';
import CustomerLayout from '../components/CustomerLayout';
import { formatOrderNumberLabel } from '@/lib/orderDisplay';

export default function OrderConfirmation() {
  const router = useRouter();
  const { order_number } = router.query;
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const parsedOrderNumber = useMemo(() => {
    const raw = Array.isArray(order_number) ? order_number[0] : order_number;
    if (!raw) return null;
    const parsed = Number.parseInt(String(raw), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [order_number]);
  const orderNumberLabel = formatOrderNumberLabel(parsedOrderNumber);

  return (
    <CustomerLayout cartCount={itemCount}>
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Thank you for your order!</h1>
        <p>{orderNumberLabel}.</p>
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
