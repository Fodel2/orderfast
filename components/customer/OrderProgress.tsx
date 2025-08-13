import React from 'react';

const STEPS = [
  { key: 'created',   label: 'Created',   icon: '🧾' },
  { key: 'accepted',  label: 'Accepted',  icon: '✅' },
  { key: 'preparing', label: 'Preparing', icon: '👨‍🍳' },
  { key: 'ready',     label: 'Ready',     icon: '📦' },
  { key: 'completed', label: 'Completed', icon: '🏁' },
] as const;

type OrderStatus =
  | 'created'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'pending';

function normalizeStatus(s: string): OrderStatus {
  const x = (s || '').toLowerCase();
  if (!x || x === 'pending' || x === 'new' || x === 'created') return 'created';
  if (x.startsWith('accept'))   return 'accepted';
  if (x.startsWith('prep'))     return 'preparing';
  if (x.startsWith('ready'))    return 'ready';
  if (x.startsWith('complete')) return 'completed';
  if (x.startsWith('cancel'))   return 'cancelled';
  return 'created';
}

export default function OrderProgress({ status }: { status: OrderStatus }) {
  const norm = normalizeStatus(String(status));
  if (norm === 'cancelled') return null; // handled by a different UI
  const idx = Math.max(0, STEPS.findIndex(s => s.key === norm));
  const pulse = norm !== 'completed';
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        {STEPS.map((s,i)=> (
          <div key={s.key} className="flex-1 flex items-center gap-2">
            <div className={`h-2 w-full rounded-full ${i<=idx ? 'bg-[var(--brand)]' : 'bg-gray-200'} ${i===idx && pulse ? 'order-step--active' : ''}`} />
            <div className={`text-xs ${i===idx ? 'text-[var(--brand)]' : 'text-gray-400'}`} title={s.label}>
              {s.icon}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-gray-500">
        {STEPS.map(s => <span key={s.key}>{s.label}</span>)}
      </div>
    </div>
  );
}
