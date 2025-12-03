import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Order } from './OrderDetailsModal';

interface Props {
  order: Order;
  show: boolean;
  onClose: () => void;
  onRejected: () => void;
}

export default function RejectOrderModal({ order, show, onClose, onRejected }: Props) {
  const actionLabel = useMemo(() => (order.status === 'accepted' ? 'Cancel' : 'Reject'), [
    order.status,
  ]);
  const reasons = useMemo(
    () =>
      order.status === 'accepted'
        ? ['Closing early', 'Problem in the kitchen', 'Other']
        : ['Item out of stock', 'Closing early', 'Problem in the kitchen', 'Other'],
    [order.status]
  );

  const [reason, setReason] = useState(reasons[0] ?? 'Closing early');
  const [message, setMessage] = useState('');
  const [itemIds, setItemIds] = useState<Set<number>>(new Set());
  const [addonIds, setAddonIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setReason(reasons[0] ?? 'Closing early');
    setMessage('');
    setItemIds(new Set());
    setAddonIds(new Set());
  }, [show, reasons]);

  if (!show) return null;

  const toggleItem = (id: number) => {
    setItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAddon = (id: number) => {
    setAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (reason === 'Item out of stock') {
        for (const id of Array.from(itemIds)) {
          await supabase.from('menu_items').update({ stock_status: 'out' }).eq('id', id);
        }
        for (const id of Array.from(addonIds)) {
          await supabase.from('addon_options').update({ stock_status: 'out' }).eq('id', id);
        }
      }
      await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancel_reason: reason,
          cancel_comment: message || null,
        })
        .eq('id', order.id);
      onRejected();
    } catch (err) {
      console.error('Failed to reject order', err);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[1000]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-sm sm:max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-100 px-4 py-2 font-bold text-center">
          {actionLabel} Order
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="space-y-2 bg-gray-50 p-3 rounded">
            <p className="font-medium">Reason for {actionLabel.toLowerCase()}</p>
            {reasons.map((r) => (
              <label key={r} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                <span>{r}</span>
              </label>
            ))}
          </div>
          {reason === 'Item out of stock' && (
            <div className="space-y-2 bg-gray-50 p-3 rounded">
              <p className="font-medium">Mark items out of stock</p>
              <ul className="space-y-1">
                {order.order_items.map((it) => (
                  <li key={it.id} className="ml-2 space-y-1">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={itemIds.has(it.item_id)}
                        onChange={() => toggleItem(it.item_id)}
                      />
                      <span className="font-medium">{it.name}</span>
                    </label>
                    {it.order_addons.length > 0 && (
                      <ul className="ml-6 space-y-1">
                        {it.order_addons.map((ad) => (
                          <li key={ad.id}>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={addonIds.has(ad.option_id)}
                                onChange={() => toggleAddon(ad.option_id)}
                              />
                              <span>{ad.name}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-sm font-medium mb-1">Custom message (optional)</label>
            <textarea
              className="w-full border rounded-md p-2 min-h-[6rem]"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 relative">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-red-600 text-red-600 rounded hover:bg-red-50 w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 w-full sm:w-auto"
              disabled={saving}
            >
              {saving ? `${actionLabel}ing...` : `${actionLabel} Order`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
