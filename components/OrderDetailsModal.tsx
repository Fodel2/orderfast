import { useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import RejectOrderModal from './RejectOrderModal';
import OrderRejectButton from './OrderRejectButton';
import { formatPrice, formatShortOrderNumber, formatStatusLabel } from '@/lib/orderDisplay';

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

const formatAddress = (addr: any) => {
  if (!addr) return '';
  return [addr.address_line_1, addr.address_line_2, addr.postcode]
    .filter(Boolean)
    .join(', ');
};

export default function OrderDetailsModal({ order, onClose, onUpdateStatus }: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    if (!order) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [order]);

  if (!order) return null;

  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const hasInvalidItems = !Array.isArray(order.order_items);
  const hasInvalidAddons = orderItems.some((item) => !Array.isArray(item.order_addons));
  const hasIncompleteData = hasInvalidItems || hasInvalidAddons;
  if (hasIncompleteData && process.env.NODE_ENV !== 'production') {
    console.warn('[orders] order modal opened with incomplete data', {
      orderId: order.id,
      hasInvalidItems,
      hasInvalidAddons,
      orderItems: order.order_items,
    });
  }

  const kioskOrder = order.order_type === 'kiosk' || order.source === 'kiosk';
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
            Order #{formatShortOrderNumber(order.short_order_number)}
          </h3>
          {hasIncompleteData && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Some order details are still loading. Please try again in a moment.
            </div>
          )}
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
                  {formatStatusLabel(order.status)}
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
            {orderItems.map((it) => {
              const itemPrice = Number.isFinite(it.price) ? it.price : 0;
              const itemQuantity = Number.isFinite(it.quantity) ? it.quantity : 0;
              const addons = Array.isArray(it.order_addons) ? it.order_addons : [];
              return (
              <li key={it.id} className="border rounded-lg p-3">
                <div className="flex justify-between">
                  <span className="font-semibold">
                    {it.name} × {itemQuantity}
                  </span>
                  <span className="font-medium">
                    {formatPrice(itemPrice * itemQuantity)}
                  </span>
                </div>
                {addons.length > 0 && (
                  <ul className="mt-1 ml-4 space-y-1 text-gray-600">
                    {addons.map((ad) => {
                      const addonPrice = Number.isFinite(ad.price) ? ad.price : 0;
                      const addonQuantity = Number.isFinite(ad.quantity) ? ad.quantity : 0;
                      return (
                      <li key={ad.id} className="flex justify-between">
                        <span>
                          {ad.name}
                          <span className="text-xs text-gray-500 ml-1">x{addonQuantity}</span>
                        </span>
                        <span>{formatPrice(addonPrice * addonQuantity)}</span>
                      </li>
                      );
                    })}
                  </ul>
                )}
                {it.notes && (
                  <p className="italic text-gray-600 ml-4 mt-1">{it.notes}</p>
                )}
              </li>
              );
            })}
          </ul>
          {order.customer_notes && (
            <p className="italic">{order.customer_notes}</p>
          )}
          <p className="font-semibold">Total: {formatPrice(order.total_price)}</p>
          <div className="flex justify-end space-x-2 pt-2">
            {(() => {
              const shouldAccept = order.status === 'pending';
              const shouldComplete = ['accepted', 'preparing', 'ready_to_collect', 'delivering'].includes(
                order.status
              );
              if (!shouldAccept && !shouldComplete) return null;
              const nextStatus = shouldAccept ? 'accepted' : 'completed';
              const label = shouldAccept ? 'ACCEPT' : 'COMPLETE';
              const classes = shouldAccept
                ? 'bg-teal-600 hover:bg-teal-700'
                : 'bg-green-600 hover:bg-green-700';
              return (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.id, nextStatus)}
                  className={`px-4 py-2 text-white rounded ${classes}`}
                >
                  {label}
                </button>
              );
            })()}
            {!kioskOrder && !['completed', 'cancelled', 'rejected'].includes(order.status) && (
              <OrderRejectButton
                status={order.status}
                onConfirm={() => setShowReject(true)}
                buttonClassName="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                tooltipBubbleClassName="bg-white text-gray-900"
                tooltipArrowClassName="bg-white shadow"
              />
            )}
          </div>
        </div>
      </div>
      <RejectOrderModal
        order={order}
        show={showReject}
        onClose={() => setShowReject(false)}
        onRejected={(status) => onUpdateStatus(order.id, status)}
      />
    </div>
  );
}
