import React from 'react';

interface BreakModalProps {
  show: boolean;
  onClose: () => void;
  onSelect: (mins: number) => void;
  variant?: 'dashboard' | 'kod';
}

export default function BreakModal({
  show,
  onClose,
  onSelect,
  variant = 'dashboard',
}: BreakModalProps) {
  if (!show) return null;
  const isKod = variant === 'kod';
  return (
    <div
      className={`fixed inset-0 flex items-start justify-center pt-20 z-[1000] ${
        isKod ? 'bg-black/60' : 'bg-black/30'
      }`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-72 rounded-2xl p-4 shadow-2xl ${
          isKod
            ? 'border border-white/10 bg-neutral-950 text-white shadow-black/40'
            : 'bg-white text-neutral-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-3">Take a Break</h3>
        <div className="grid grid-cols-2 gap-2">
          {[10, 20, 30, 60].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                onSelect(m);
                onClose();
              }}
              className={`px-3 py-2 text-sm font-semibold rounded-xl transition ${
                isKod
                  ? 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
