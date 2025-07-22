import { useRouter } from 'next/router';

export default function OrderConfirmation() {
  const router = useRouter();
  const { order_number } = router.query;

  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">Thank you for your order!</h1>
      {order_number && (
        <p>Your order number is {String(order_number).padStart(4, '0')}.</p>
      )}
      <a href="/" className="mt-4 inline-block px-4 py-2 bg-teal-600 text-white rounded">
        Back to Home
      </a>
    </div>
  );
}
