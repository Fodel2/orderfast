import React, { useEffect, useState } from 'react';
import OrderProgress from '@/components/customer/OrderProgress';
import { randomCancelledMessage } from '@/lib/uiCopy';
import { extractCancelReason, displayOrderNo } from '@/lib/orderDisplay';
import { useRouter } from 'next/router';

export default function OrderDetailsModal({ order, onClose }: { order: any; onClose: () => void; }) {
  if (!order) return null;
  const router = useRouter();
  const qp = router?.query || {};
  const status = String(order?.status || 'pending').toLowerCase();
  const canCancel = !['accepted','ready','completed','cancelled'].includes(status);
  const { reason, note } = extractCancelReason(order);
  const onCancel = async () => {
    // TODO: wire to real cancel/refund endpoint (Stripe Connect later).
    alert('Cancel & refund requested. (Stripe wiring coming soon.)');
  };
  const shortNo = displayOrderNo(order);
  const placed = order?.created_at_human || (order?.created_at ? new Date(order.created_at).toLocaleString(undefined, { weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '');
  const [anim, setAnim] = useState<'enter'|'exit'|''>('');
  useEffect(()=>{ setAnim('enter'); },[]);
  const closeWithAnim = () => { setAnim('exit'); setTimeout(onClose, 180); };
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={closeWithAnim}>
      {/* Desktop: centered dialog; Mobile: bottom sheet */}
      <div className={`w-full md:max-w-xl bg-white rounded-t-2xl md:rounded-2xl p-4 md:p-6 shadow-xl ${anim==='enter'?'ordersheet-enter ordersheet-enter-active':anim==='exit'?'ordersheet-exit ordersheet-exit-active':''}`} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg md:text-xl font-bold">Order {shortNo}</h3>
          <button onClick={closeWithAnim} aria-label="Close" className="p-2 rounded-md hover:bg-gray-100">✕</button>
        </div>
        {/* status pill + placed time */}
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span className="pill">{(order?.status || 'Pending')}</span>
          <span className="text-gray-500">Placed: {placed}</span>
        </div>
        {/* progress OR cancelled view */}
        {status === 'cancelled' ? (
          <div className="mt-4 flex flex-col items-center text-center gap-4">
            <img src="/illustrations/plate-cancelled.svg" alt="" width="320" height="160" loading="lazy" />
            <div className="space-y-1">
              <p className="text-base font-semibold">Order cancelled</p>
              <p className="text-gray-600">{randomCancelledMessage()}</p>
              {(reason || note) && (
                <div className="mt-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-left">
                  {reason && <div><span className="font-medium">Reason: </span>{reason}</div>}
                  {note && <div className="mt-1"><span className="font-medium">Note: </span>{note}</div>}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3"><OrderProgress status={status} /></div>
        )}

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
            <button className="md:flex-1 border rounded-lg py-3" onClick={closeWithAnim}>Close</button>
            {status !== 'cancelled' && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
