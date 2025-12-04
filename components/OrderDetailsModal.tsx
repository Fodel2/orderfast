import { useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import RejectOrderModal from './RejectOrderModal';

interface OrderAddon {
  id: number;
  option_id: number;
  name: string;
  price: number;
  quantity: number;
}

interface OrderItem {
  id: number;
  item_id: number;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
  order_addons: OrderAddon[];
}

export interface Order {
  id: string;
  short_order_number: number | null;
  source?: string | null;
  order_type: 'delivery' | 'collection' | 'kiosk';
  customer_name: string | null;
  phone_number: string | null;
  delivery_address: any;
  scheduled_for: string | null;
  customer_notes: string | null;
  status: string;
  total_price: number | null;
  created_at: string;
  accepted_at?: string | null;
  order_items: OrderItem[];
}

interface Props {
  order: Order | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
}

const formatPrice = (p: number | null) => {
  return p ? `£${(p / 100).toFixed(2)}` : '£0.00';
};

const formatAddress = (addr: any) => {
  if (!addr) return '';
  return [addr.address_line_1, addr.address_line_2, addr.postcode]
    .filter(Boolean)
    .join(', ');
};

export default function OrderDetailsModal({ order, onClose, onUpdateStatus }: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [showReject, setShowReject] = useState(false);
  const lastTap = useRef<number>(0);
  const [showRejectTip, setShowRejectTip] = useState(false);
  const tipTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!order) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
      if (tipTimeout.current) {
        clearTimeout(tipTimeout.current);
        tipTimeout.current = null;
      }
    };
  }, [order]);

  if (!order) return null;

  const kioskOrder = order.order_type === 'kiosk' || order.source === 'kiosk';
  const actionLabel = order.status === 'pending' ? 'Reject' : 'Cancel';
  const canRejectOrCancel =
    !kioskOrder && !['completed', 'cancelled', 'rejected'].includes(order.status);

  const handleRejectToggle = () => {
    const now = Date.now();
    if (now - lastTap.current < 500) {
      setShowReject(true);
      setShowRejectTip(false);
      if (tipTimeout.current) {
        clearTimeout(tipTimeout.current);
        tipTimeout.current = null;
      }
    } else {
      setShowRejectTip(true);
      if (tipTimeout.current) clearTimeout(tipTimeout.current);
      tipTimeout.current = setTimeout(() => {
        setShowRejectTip(false);
      }, 1500);
    }
    lastTap.current = now;
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[1000]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-lg w-full max-w-xl max-h-[90vh] overflow-y-auto relative"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
        <div className="p-6 space-y-4 text-sm">
          <h3 className="text-2xl font-bold">
            Order #{String(order.short_order_number ?? 0).padStart(4, '0')}
          </h3>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Customer</span>
              <span className="text-gray-700">
                {order.customer_name || 'Guest'} {order.phone_number || ''}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Status</span>
              <span>
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${{
                    pending: 'bg-gray-200 text-gray-800',
                    accepted: 'bg-green-200 text-green-800',
                    cancelled: 'bg-red-200 text-red-800',
                  }[order.status] || 'bg-yellow-200 text-yellow-800'}`}
                >
                  {order.status}
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Placed</span>
              <span className="text-gray-700">
                {new Date(order.created_at).toLocaleString()}
              </span>
            </div>
            {order.order_type === 'delivery' && order.delivery_address && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Address</span>
                <span className="text-right text-gray-700 ml-4">
                  {formatAddress(order.delivery_address)}
                </span>
              </div>
            )}
          </div>
          <ul className="space-y-3 text-sm">
            {order.order_items.map((it) => (
              <li key={it.id} className="border rounded-lg p-3">
                <div className="flex justify-between">
                  <span className="font-semibold">
                    {it.name} × {it.quantity}
                  </span>
                  <span className="font-medium">
                    {formatPrice(it.price * it.quantity)}
                  </span>
                </div>
                {it.order_addons && it.order_addons.length > 0 && (
                  <ul className="mt-1 ml-4 space-y-1 text-gray-600">
                    {it.order_addons.map((ad) => (
                      <li key={ad.id} className="flex justify-between">
                        <span>
                          {ad.name}
                          <span className="text-xs text-gray-500 ml-1">x{ad.quantity}</span>
                        </span>
                        <span>{formatPrice(ad.price * ad.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {it.notes && (
                  <p className="italic text-gray-600 ml-4 mt-1">{it.notes}</p>
                )}
              </li>
            ))}
          </ul>
          {order.customer_notes && (
            <p className="italic">{order.customer_notes}</p>
          )}
          <p className="font-semibold">Total: {formatPrice(order.total_price)}</p>
          <div className="flex justify-end space-x-2 pt-2">
            {(() => {
              const transitions: Record<string, Record<string, { next: string; label: string; classes: string }>> = {
                delivery: {
                  pending: { next: 'accepted', label: 'Accept Order', classes: 'bg-teal-600 hover:bg-teal-700' },
                  accepted: { next: 'preparing', label: 'Start Preparing', classes: 'bg-yellow-600 hover:bg-yellow-700' },
                  preparing: { next: 'delivering', label: 'Mark as Out for Delivery', classes: 'bg-indigo-600 hover:bg-indigo-700' },
                  delivering: { next: 'completed', label: 'Complete Order', classes: 'bg-green-600 hover:bg-green-700' },
                },
                collection: {
                  pending: { next: 'accepted', label: 'Accept Order', classes: 'bg-teal-600 hover:bg-teal-700' },
                  accepted: { next: 'preparing', label: 'Start Preparing', classes: 'bg-yellow-600 hover:bg-yellow-700' },
                  preparing: { next: 'ready_to_collect', label: 'Mark as Ready for Collection', classes: 'bg-indigo-600 hover:bg-indigo-700' },
                  ready_to_collect: { next: 'completed', label: 'Complete Order', classes: 'bg-green-600 hover:bg-green-700' },
                },
                kiosk: {
                  pending: { next: 'accepted', label: 'Accept Order', classes: 'bg-teal-600 hover:bg-teal-700' },
                  accepted: { next: 'preparing', label: 'Start Preparing', classes: 'bg-yellow-600 hover:bg-yellow-700' },
                  preparing: { next: 'ready_to_collect', label: 'Mark as Ready for Collection', classes: 'bg-indigo-600 hover:bg-indigo-700' },
                  ready_to_collect: { next: 'completed', label: 'Complete Order', classes: 'bg-green-600 hover:bg-green-700' },
                },
              };
              const t = transitions[kioskOrder ? 'kiosk' : order.order_type][order.status];
              return t ? (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.id, t.next)}
                  className={`px-4 py-2 text-white rounded ${t.classes}`}
                >
                  {t.label}
                </button>
              ) : null;
            })()}
            {canRejectOrCancel && (
              <>
                <button
                  type="button"
                  onClick={handleRejectToggle}
                  onDoubleClick={() => setShowReject(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  {actionLabel}
                </button>
                <div
                  className={`relative text-xs text-white ${showRejectTip ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
                >
                  <div className="absolute right-0 -top-2 translate-y-[-100%] bg-gray-900 rounded px-2 py-1 shadow">
                    Double-tap to {actionLabel.toLowerCase()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <RejectOrderModal
        order={order}
        show={showReject}
        onClose={() => setShowReject(false)}
        onRejected={() =>
          onUpdateStatus(order.id, order.status === 'pending' ? 'rejected' : 'cancelled')
        }
      />
    </div>
  );
}
