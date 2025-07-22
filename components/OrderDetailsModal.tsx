import { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface OrderAddon {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
  order_addons: OrderAddon[];
}

export interface Order {
  id: string;
  short_order_number: number | null;
  order_type: 'delivery' | 'collection';
  customer_name: string | null;
  phone_number: string | null;
  delivery_address: any;
  scheduled_for: string | null;
  customer_notes: string | null;
  status: string;
  total_price: number | null;
  created_at: string;
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

  useEffect(() => {
    if (!order) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [order]);

  if (!order) return null;

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
        className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto relative"
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
          <h3 className="text-xl font-semibold">
            Order #{String(order.short_order_number ?? 0).padStart(4, '0')}
          </h3>
          <p>
            <strong>Customer:</strong> {order.customer_name || 'Guest'} {order.phone_number || ''}
          </p>
          {order.order_type === 'delivery' && order.delivery_address && (
            <p>
              <strong>Address:</strong> {formatAddress(order.delivery_address)}
            </p>
          )}
          <p>
            <strong>Status:</strong> {order.status}
          </p>
          <p>
            <strong>Placed:</strong> {new Date(order.created_at).toLocaleString()}
          </p>
          <ul className="space-y-2">
            {order.order_items.map((it) => (
              <li key={it.id} className="border rounded p-2">
                <div className="flex justify-between">
                  <span>
                    {it.name} × {it.quantity}
                  </span>
                  <span>{formatPrice(it.price * it.quantity)}</span>
                </div>
                {it.order_addons && it.order_addons.length > 0 && (
                  <ul className="mt-1 ml-4 space-y-1 text-gray-600">
                    {it.order_addons.map((ad) => (
                      <li key={ad.id} className="flex justify-between">
                        <span>
                          {ad.name} × {ad.quantity}
                        </span>
                        <span>{formatPrice(ad.price * ad.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {it.notes && <p className="italic ml-4 mt-1">{it.notes}</p>}
              </li>
            ))}
          </ul>
          {order.customer_notes && <p className="italic">{order.customer_notes}</p>}
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
              };
              const t = transitions[order.order_type][order.status];
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
            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => onUpdateStatus(order.id, 'cancelled')}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
