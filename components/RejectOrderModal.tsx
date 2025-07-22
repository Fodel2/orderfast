import { useState } from 'react';
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[1000]" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Reject Order</h3>
        <div className="space-y-2 text-sm">
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
                <li key={it.id} className="ml-2">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={itemIds.has(it.item_id)} onChange={() => toggleItem(it.item_id)} />
                    <span>{it.name}</span>
                  </label>
                  {it.order_addons.map((ad) => (
                    <label key={ad.id} className="flex items-center space-x-2 ml-6">
                      <input type="checkbox" checked={addonIds.has(ad.option_id)} onChange={() => toggleAddon(ad.option_id)} />
                      <span>{ad.name}</span>
                    </label>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Custom message (optional)</label>
          <textarea className="w-full border rounded p-2" rows={3} value={message} onChange={(e)=>setMessage(e.target.value)} />
        </div>
        <div className="flex justify-end space-x-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-red-600 text-red-600 rounded hover:bg-red-50">Cancel</button>
          <button type="button" onClick={handleConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" disabled={saving}>{saving ? 'Rejecting...' : 'Reject Order'}</button>
        </div>
      </div>
    </div>
  );
}
