import { useState } from 'react';
import { useRouter } from 'next/router';
import { TruckIcon, ShoppingBagIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useOrderType, OrderType } from '../context/OrderTypeContext';

export default function CheckoutPage() {
  const { cart, subtotal } = useCart();
  const { orderType, setOrderType } = useOrderType();
  const [notes, setNotes] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [step, setStep] = useState(orderType ? 'details' : 'select');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<{ x: number; y: number } | null>(null);
  const [asap, setAsap] = useState(true);
  const router = useRouter();

  const selectClass = (type: OrderType) =>
    `border rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer space-y-2 hover:border-teal-600 ${orderType === type ? 'border-teal-600 bg-teal-50' : 'border-gray-300'}`;

  const placeOrder = () => {
    const payload = {
      restaurant_id: cart.restaurant_id,
      order_type: orderType,
      items: cart.items,
      notes: notes || null,
      scheduled_for: !asap ? scheduledFor || null : null,
      address: orderType === 'delivery' ? address : null,
      phone,
      location,
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

  const deliveryFee = orderType === 'delivery' ? 300 : 0; // cents
  const serviceFee = Math.round(subtotal * 0.05); // 5%

  return (
    <div className="min-h-screen flex flex-col p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Checkout</h1>
      <AnimatePresence mode="wait">
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col items-center justify-center space-y-6"
          >
            <h2 className="text-lg font-semibold mb-3 text-center">Choose Order Type</h2>
            <div className="grid grid-cols-2 gap-4 w-full">
              <div
                className={selectClass('delivery')}
                onClick={() => {
                  setOrderType('delivery');
                  setStep('details');
                }}
              >
                <TruckIcon className="w-12 h-12" />
                <span className="text-lg font-medium">Delivery</span>
              </div>
              <div
                className={selectClass('collection')}
                onClick={() => {
                  setOrderType('collection');
                  setStep('details');
                }}
              >
                <ShoppingBagIcon className="w-12 h-12" />
                <span className="text-lg font-medium">Collection</span>
              </div>
            </div>
          </motion.div>
        )}
        {step === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6 flex-1"
          >
            <div>
              <div
                className="h-40 bg-gray-200 rounded flex items-center justify-center relative mb-4"
                onClick={() => orderType === 'delivery' && setLocation({ x: 0, y: 0 })}
              >
                {orderType === 'delivery' ? (
                  <span className="text-gray-600">Tap to set delivery location</span>
                ) : (
                  <span className="text-gray-600">Restaurant location</span>
                )}
                {location && orderType === 'delivery' && (
                  <MapPinIcon className="w-6 h-6 text-red-600 absolute" />
                )}
              </div>
              {orderType === 'delivery' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <input
                    type="text"
                    className="w-full border rounded p-2"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  className="w-full border rounded p-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  pattern="^[0-9+\- ]+$"
                />
              </div>
              <div className="mb-4 space-x-4 flex items-center">
                <label className="font-medium">Time:</label>
                <label className="flex items-center space-x-1">
                  <input type="radio" checked={asap} onChange={() => setAsap(true)} />
                  <span>ASAP</span>
                </label>
                <label className="flex items-center space-x-1">
                  <input type="radio" checked={!asap} onChange={() => setAsap(false)} />
                  <span>Scheduled</span>
                </label>
                {!asap && (
                  <input
                    type="datetime-local"
                    className="border rounded p-1 ml-2"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                  />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-4">Estimated delivery time: 30-40 mins</p>
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
          </motion.div>
        )}
      </AnimatePresence>
      {step === 'details' && (
        <div className="mt-6 border-t pt-4">
          <div className="flex justify-between mb-2">
            <span>Subtotal</span>
            <span>${(subtotal / 100).toFixed(2)}</span>
          </div>
          {orderType === 'delivery' && (
            <div className="flex justify-between mb-2">
              <span>Delivery Fee</span>
              <span>${(deliveryFee / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between mb-2">
            <span>Service Fee</span>
            <span>${(serviceFee / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-lg mb-4">
            <span>Total</span>
            <span>${((subtotal + serviceFee + deliveryFee) / 100).toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={placeOrder}
            className="w-full py-3 bg-teal-600 text-white rounded hover:bg-teal-700"
          >
            Place Order
          </button>
        </div>
      )}
    </div>
  );
}
