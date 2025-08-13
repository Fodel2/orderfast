import React from 'react';

const STEPS = ['Created','Accepted','Ready','Completed'] as const;

type Status = 'created'|'accepted'|'ready'|'completed'|'cancelled'|'pending';

export default function OrderProgress({ status }: { status: Status }) {
  const idx = Math.max(0, STEPS.findIndex(s => s.toLowerCase() === (status === 'pending' ? 'created' : status)));
  return (
    <div className="w-full px-2">
      <div className="flex items-center justify-between text-xs font-medium">
        {STEPS.map((s,i)=> (
          <div key={s} className="flex-1 flex items-center">
            <div className={`h-2 rounded-full w-full ${i<=idx ? 'bg-[var(--brand)]' : 'bg-gray-200'}`} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-gray-500">
        {STEPS.map(s => <span key={s}>{s}</span>)}
      </div>
    </div>
  );
}
