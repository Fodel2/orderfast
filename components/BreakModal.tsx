import React from 'react';

interface BreakModalProps {
  show: boolean;
  onClose: () => void;
  onSelect: (mins: number) => void;
}

export default function BreakModal({ show, onClose, onSelect }: BreakModalProps) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-start justify-center pt-20 z-[1000]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-lg p-4 w-72"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-3">Take a Break</h3>
        <div className="grid grid-cols-2 gap-2">
          {[10, 20, 30, 60].map((m) => (
            <button
              key={m}
              onClick={() => {
                onSelect(m);
                onClose();
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
