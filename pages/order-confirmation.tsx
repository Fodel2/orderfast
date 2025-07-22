import { useRouter } from 'next/router';

export default function OrderConfirmation() {
  const router = useRouter();
  const { order_id } = router.query;

  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">Thank you for your order!</h1>
      {order_id && <p>Your order number is {order_id}.</p>}
      <a href="/" className="mt-4 inline-block px-4 py-2 bg-teal-600 text-white rounded">
        Back to Home
      </a>
    </div>
  );
}
