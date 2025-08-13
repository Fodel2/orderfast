import React from 'react';
import '@/styles/orders.css';

const STEPS = [
  { key: 'created',  label: 'Created',  icon: '🧾' },
  { key: 'accepted', label: 'Accepted', icon: '✅' },
  { key: 'ready',    label: 'Ready',    icon: '📦' },
  { key: 'completed',label: 'Completed',icon: '🏁' },
] as const;

type Status = 'created'|'accepted'|'ready'|'completed'|'cancelled'|'pending';

export default function OrderProgress({ status }: { status: Status }) {
  const norm = (status === 'pending' ? 'created' : status) as Status;
  const idx = Math.max(0, STEPS.findIndex(s => s.key === norm) );
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        {STEPS.map((s,i)=> (
          <div key={s.key} className="flex-1 flex items-center gap-2">
            <div className={`h-2 w-full rounded-full ${i<=idx ? 'bg-[var(--brand)]' : 'bg-gray-200'}`} />
            <div className={`text-xs ${i===idx ? 'text-[var(--brand)] order-step--active' : 'text-gray-400'}`} title={s.label}>
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
