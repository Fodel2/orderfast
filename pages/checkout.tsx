import { useState } from 'react';
import { useRouter } from 'next/router';
import { TruckIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import { useCart } from '../context/CartContext';
import { useOrderType, OrderType } from '../context/OrderTypeContext';

export default function CheckoutPage() {
  const { cart, subtotal } = useCart();
  const { orderType, setOrderType } = useOrderType();
  const [notes, setNotes] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const router = useRouter();

  const selectClass = (type: OrderType) =>
    `border rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer space-y-2 hover:border-teal-600 ${orderType === type ? 'border-teal-600 bg-teal-50' : 'border-gray-300'}`;

  const placeOrder = () => {
    const payload = {
      restaurant_id: cart.restaurant_id,
      order_type: orderType,
      items: cart.items,
      scheduled_for: scheduledFor || null,
      notes: notes || null,
    };
    console.log('Checkout payload', payload);
    alert(JSON.stringify(payload, null, 2));
  };

  if (!cart.items.length) {
    return (
      <div className="p-6 text-center">
        <p>Your cart is empty.</p>
        <button
          type="button"
          onClick={() => router.push('/menu')}
          className="mt-4 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
        >
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Checkout</h1>
      <div className="space-y-6 flex-1">
        <div>
          <h2 className="text-lg font-semibold mb-3 text-center">Choose Order Type</h2>
          <div className="grid grid-cols-2 gap-4">
            <div
              className={selectClass('delivery')}
              onClick={() => setOrderType('delivery')}
            >
              <TruckIcon className="w-12 h-12" />
              <span className="text-lg font-medium">Delivery</span>
            </div>
            <div
              className={selectClass('collection')}
              onClick={() => setOrderType('collection')}
            >
              <ShoppingBagIcon className="w-12 h-12" />
              <span className="text-lg font-medium">Collection</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Order Summary</h2>
          <ul className="space-y-4">
            {cart.items.map((item) => {
              const addonsTotal = (item.addons || []).reduce(
                (sum, a) => sum + a.price * a.quantity,
                0
              );
              const total = item.price * item.quantity + addonsTotal;
              return (
                <li key={item.item_id} className="border rounded p-3 text-sm">
                  <div className="flex justify-between">
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span>${(total / 100).toFixed(2)}</span>
                  </div>
                  {item.addons && item.addons.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-4 text-gray-600">
                      {item.addons.map((a) => (
                        <li key={a.option_id} className="flex justify-between">
                          <span>
                            {a.name} × {a.quantity}
                          </span>
                          <span>${((a.price * a.quantity) / 100).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.notes && (
                    <p className="mt-1 italic text-gray-600 pl-4">{item.notes}</p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Schedule (optional)</label>
              <input
                type="datetime-local"
                className="w-full border rounded p-2"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Order Notes (optional)</label>
              <textarea
                className="w-full border rounded p-2"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 border-t pt-4">
        <div className="flex justify-between font-semibold mb-4 text-lg">
          <span>Subtotal</span>
          <span>${(subtotal / 100).toFixed(2)}</span>
        </div>
        <button
          type="button"
          onClick={placeOrder}
          className="w-full py-3 bg-teal-600 text-white rounded hover:bg-teal-700"
        >
          Place Order
        </button>
      </div>
    </div>
  );
}
