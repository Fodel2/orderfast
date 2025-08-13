import React from 'react';
import OrderProgress from '@/components/customer/OrderProgress';
import { useRouter } from 'next/router';

export default function OrderDetailsModal({ order, onClose }: { order: any; onClose: () => void; }) {
  if (!order) return null;
  const router = useRouter();
  const qp: any = router?.query || {};
  const canCancel = !['accepted','ready','completed','cancelled'].includes((order?.status || 'pending').toLowerCase());
  const onCancel = async () => {
    // TODO: wire to real cancel/refund endpoint (Stripe Connect later).
    // For now, no-op with alert.
    alert('Cancel & refund requested. (This will be wired to Stripe when ready.)');
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
      {/* Desktop: centered dialog; Mobile: bottom sheet */}
      <div className="w-full h-full md:h-auto md:max-w-xl bg-white rounded-t-2xl md:rounded-2xl p-4 md:p-6 shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg md:text-xl font-bold">Order #{order?.id ?? order?.number}</h3>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-md hover:bg-gray-100">✕</button>
        </div>
        {/* status pill + placed time */}
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span className="pill">{order?.status || 'Pending'}</span>
          <span className="text-gray-500">Placed: {order?.created_at_human ?? order?.created_at}</span>
        </div>
        {/* progress */}
        <div className="mt-3"><OrderProgress status={(order?.status || 'pending').toLowerCase()} /></div>

        {/* Basket */}
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Items</h4>
          {order.items === undefined && <div className="text-sm text-gray-500">Loading items…</div>}
          {Array.isArray(order.items) && order.items.length === 0 && (
            <div className="text-sm text-gray-500">No items found for this order.</div>
          )}
          {Array.isArray(order.items) && order.items.length > 0 && (
            <ul className="space-y-3 text-sm">
              {order.items.map((it: any) => (
                <li key={it.id} className="text-sm text-gray-800">
                  <div className="flex justify-between">
                    <span>
                      <span className="font-medium">{it.name ?? 'Item'}</span>
                      {typeof it.quantity === 'number' && <span> × {it.quantity}</span>}
                    </span>
                    {typeof it.price === 'number' && (
                      <span>£{Number(it.price).toFixed(2)}</span>
                    )}
                  </div>
                  {it.notes && <div className="text-xs text-gray-500 mt-0.5">Notes: {it.notes}</div>}
                  {Array.isArray(it.addons) && it.addons.length > 0 && (
                    <ul className="mt-2 pl-3 border-l">
                      {it.addons.map((a: any) => (
                        <li key={a.id} className="flex justify-between text-xs text-gray-700">
                          <span>{a.name ?? 'Addon'}{typeof a.quantity === 'number' && <> × {a.quantity}</>}</span>
                          {typeof a.price === 'number' && <span>£{Number(a.price).toFixed(2)}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Payment */}
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Payment</h4>
          <div className="text-sm">
            {typeof order.itemSubtotal === 'number' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Items subtotal</span>
                <span className="font-medium">£{order.itemSubtotal.toFixed(2)}</span>
              </div>
            )}
            {typeof order.delivery_fee === 'number' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery fee</span>
                <span className="font-medium">£{Number(order.delivery_fee).toFixed(2)}</span>
              </div>
            )}
            {typeof order.service_fee === 'number' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Service fee</span>
                <span className="font-medium">£{Number(order.service_fee).toFixed(2)}</span>
              </div>
            )}
            {typeof order.total_price === 'number' && (
              <div className="flex justify-between">
                <span className="text-gray-800">Total</span>
                <span className="font-semibold">£{Number(order.total_price).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Store / Restaurant */}
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Store</h4>
          <div className="text-sm text-gray-600">{order?.restaurant_name}</div>
        </div>

        {/* footer buttons */}
        <div className="mt-5 flex flex-col md:flex-row gap-2">
          <button className="md:flex-1 border rounded-lg py-3" onClick={onClose}>Close</button>
          <a
            className="md:flex-1 btn-primary text-center py-3 rounded-lg"
            href={`/restaurant/track?order_id=${order?.id}&restaurant_id=${qp.restaurant_id ?? ''}${qp.user_id ? `&user_id=${qp.user_id}`:''}`}
          >
            Track Order
          </a>
          <button
            className={`md:flex-1 rounded-lg py-3 ${canCancel ? 'border border-red-500 text-red-600' : 'border text-gray-400 cursor-not-allowed'}`}
            onClick={canCancel ? onCancel : undefined}
            disabled={!canCancel}
            aria-disabled={!canCancel}
            title={canCancel ? 'Cancel & Refund' : 'Cannot cancel after acceptance'}
          >
            Cancel & Refund
          </button>
        </div>
      </div>
    </div>
  );
}
