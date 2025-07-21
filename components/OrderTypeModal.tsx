import { useRef } from 'react';

interface OrderTypeModalProps {
  onSelect: (type: 'delivery' | 'collection') => void;
}

export default function OrderTypeModal({ onSelect }: OrderTypeModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && null}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl p-6 w-80 text-center"
      >
        <h3 className="text-lg font-semibold mb-6">How would you like to order?</h3>
        <div className="space-y-4">
          <button
            onClick={() => onSelect('delivery')}
            className="w-full py-3 bg-teal-600 text-white text-lg rounded-lg hover:bg-teal-700"
          >
            Delivery
          </button>
          <button
            onClick={() => onSelect('collection')}
            className="w-full py-3 bg-teal-600 text-white text-lg rounded-lg hover:bg-teal-700"
          >
            Collection
          </button>
        </div>
      </div>
    </div>
  );
}
