import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export interface RejectOrderAddon {
  id: number;
  option_id: number;
  name: string;
  quantity: number;
}

export interface RejectOrderItem {
  id: number;
  item_id: number;
  name: string;
  quantity: number;
  notes?: string | null;
  order_addons: RejectOrderAddon[];
}

export interface RejectableOrder {
  id: string;
  status: string;
  order_items: RejectOrderItem[];
}

interface Props {
  order: RejectableOrder;
  show: boolean;
  onClose: () => void;
  onRejected: (status: string) => void;
  tone?: 'dashboard' | 'kod';
}

export default function RejectOrderModal({
  order,
  show,
  onClose,
  onRejected,
  tone = 'dashboard',
}: Props) {
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
          await supabase.from('addon_options').update({ stock_status: 'out' }).eq('id', id);
        }
      }
      const nextStatus = order.status === 'pending' ? 'rejected' : 'cancelled';
      await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id);
      await supabase.from('order_rejections').insert([
        { order_id: order.id, reason, message: message || null },
      ]);
      onRejected(nextStatus);
    } catch (err) {
      console.error('Failed to reject order', err);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const isKod = tone === 'kod';
  const reasonOptions = [
    'Item out of stock',
    'Closing early',
    'Problem in the kitchen',
    'Other',
  ];

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center p-4 ${
        isKod ? 'bg-black/70' : 'bg-black/40'
      }`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl ${
          isKod
            ? 'border border-white/10 bg-neutral-950 text-white shadow-black/50'
            : 'bg-white text-neutral-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-6 py-4 text-center text-sm font-semibold uppercase tracking-[0.3em] ${
            isKod ? 'border-b border-white/10 text-neutral-200' : 'bg-neutral-100 text-neutral-700'
          }`}
        >
          {order.status === 'pending' ? 'Reject Order' : 'Cancel Order'}
        </div>
        <div className="space-y-6 px-6 py-5 text-sm">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Reason
            </p>
            <div className="grid gap-3">
              {reasonOptions.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                    reason === r
                      ? isKod
                        ? 'border-teal-400/60 bg-teal-500/10 text-white'
                        : 'border-teal-500/40 bg-teal-50'
                      : isKod
                      ? 'border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      reason === r
                        ? isKod
                          ? 'border-teal-300 bg-teal-400 text-black'
                          : 'border-teal-500 bg-teal-500 text-white'
                        : isKod
                        ? 'border-white/20'
                        : 'border-neutral-300'
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        reason === r ? 'bg-current' : 'bg-transparent'
                      }`}
                    />
                  </span>
                  <span className="text-base font-medium">{r}</span>
                </label>
              ))}
            </div>
          </div>
          {reason === 'Item out of stock' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
                Mark items out of stock
              </p>
              <div
                className={`space-y-4 rounded-2xl border p-4 ${
                  isKod ? 'border-white/10 bg-white/5' : 'border-neutral-200 bg-neutral-50'
                }`}
              >
                {order.order_items.map((it) => (
                  <div key={it.id} className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={itemIds.has(it.item_id)}
                        onChange={() => toggleItem(it.item_id)}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          itemIds.has(it.item_id)
                            ? isKod
                              ? 'border-teal-300 bg-teal-400 text-black'
                              : 'border-teal-500 bg-teal-500 text-white'
                            : isKod
                            ? 'border-white/20'
                            : 'border-neutral-300'
                        }`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-sm ${
                            itemIds.has(it.item_id) ? 'bg-current' : 'bg-transparent'
                          }`}
                        />
                      </span>
                      <div className="flex-1">
                        <p className="text-base font-semibold">{it.name}</p>
                        <p className="text-xs text-neutral-400">Qty {it.quantity}</p>
                      </div>
                    </label>
                    {it.order_addons.length > 0 && (
                      <div
                        className={`grid gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-2 ${
                          isKod ? 'border-white/10' : 'border-neutral-200'
                        }`}
                      >
                        {it.order_addons.map((ad) => (
                          <label
                            key={ad.id}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={addonIds.has(ad.option_id)}
                              onChange={() => toggleAddon(ad.option_id)}
                              className="sr-only"
                            />
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded border ${
                                addonIds.has(ad.option_id)
                                  ? isKod
                                    ? 'border-amber-300 bg-amber-300 text-black'
                                    : 'border-amber-500 bg-amber-500 text-white'
                                  : isKod
                                  ? 'border-white/20'
                                  : 'border-neutral-300'
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-sm ${
                                  addonIds.has(ad.option_id) ? 'bg-current' : 'bg-transparent'
                                }`}
                              />
                            </span>
                            <span className="text-sm">{ad.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Customer message (optional)
            </label>
            <textarea
              className={`min-h-[7rem] w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                isKod
                  ? 'border-white/10 bg-black/60 text-white placeholder:text-neutral-500 focus:border-teal-400/60'
                  : 'border-neutral-200 bg-white text-neutral-900 focus:border-teal-500'
              }`}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note for the customer..."
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
                isKod
                  ? 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                  : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition ${
                isKod
                  ? 'bg-rose-500 text-white hover:bg-rose-400'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
              disabled={saving}
            >
              {saving
                ? order.status === 'pending'
                  ? 'Rejecting...'
                  : 'Cancelling...'
                : order.status === 'pending'
                ? 'Reject Order'
                : 'Cancel Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
