import { useState, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Order } from './OrderDetailsModal';

interface Props {
  order: Order;
  show: boolean;
  onClose: () => void;
  onRejected: () => void;
}

export default function RejectOrderModal({ order, show, onClose, onRejected }: Props) {
  const [reason, setReason] = useState('Item out of stock');
  const [message, setMessage] = useState('');
  const [itemIds, setItemIds] = useState<Set<number>>(new Set());
  const [addonIds, setAddonIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [clickedOnce, setClickedOnce] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const tipTimer = useRef<NodeJS.Timeout | null>(null);

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
          await supabase.from('addon_items').update({ stock_status: 'out' }).eq('id', id);
        }
      }
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
      await supabase.from('order_rejections').insert([
        { order_id: order.id, reason, message: message || null },
      ]);
      onRejected();
    } catch (err) {
      console.error('Failed to reject order', err);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const handleRejectClick = () => {
    if (clickedOnce) {
      if (tipTimer.current) clearTimeout(tipTimer.current);
      setShowTip(false);
      setClickedOnce(false);
      handleConfirm();
    } else {
      setClickedOnce(true);
      setShowTip(true);
      tipTimer.current = setTimeout(() => {
        setClickedOnce(false);
        setShowTip(false);
      }, 2500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[1000]" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Reject Order</h3>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Reason for rejecting</p>
          {['Item out of stock','Closing early','Problem in the kitchen','Other'].map((r) => (
            <label key={r} className="flex items-center space-x-2">
              <input type="radio" name="reason" value={r} checked={reason===r} onChange={() => setReason(r)} />
              <span>{r}</span>
            </label>
          ))}
        </div>
        {reason === 'Item out of stock' && (
          <div className="space-y-2 text-sm">
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
          <textarea className="w-full border rounded-md p-2 min-h-[6rem]" rows={4} value={message} onChange={(e)=>setMessage(e.target.value)} />
        </div>
        <div className="flex justify-end space-x-2 pt-2 relative">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-red-600 text-red-600 rounded hover:bg-red-50">Cancel</button>
          <button type="button" onClick={handleRejectClick} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" disabled={saving}>{saving ? 'Rejecting...' : 'Reject Order'}</button>
          {showTip && (
            <div className="absolute -top-8 right-0 text-xs" role="tooltip">
              <div className="relative bg-white rounded shadow px-2 py-1">
                Double click to reject
                <div className="absolute left-1/2 -bottom-1 w-2 h-2 bg-white rotate-45 shadow -translate-x-1/2"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
