import { useEffect, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export interface MenuItem {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
}

interface AddToOrderModalProps {
  show: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (itemId: number, quantity: number) => void;
}

export default function AddToOrderModal({
  show,
  item,
  onClose,
  onAdd,
}: AddToOrderModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (show) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [show]);

  useEffect(() => {
    if (!show) {
      setQty(1);
    }
  }, [show]);

  if (!show || !item) return null;

  const increment = () => setQty((q) => q + 1);
  const decrement = () => setQty((q) => (q > 1 ? q - 1 : 1));

  const handleAdd = () => {
    onAdd(item.id, qty);
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[1000]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto relative"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
        <div className="p-6 space-y-4">
          {item.image_url && (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-48 object-cover rounded"
            />
          )}
          <h3 className="text-2xl font-semibold">{item.name}</h3>
          {item.description && <p className="text-gray-700">{item.description}</p>}
          <p className="text-lg font-semibold">${(item.price / 100).toFixed(2)}</p>
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={decrement}
              className="w-8 h-8 flex items-center justify-center border rounded-full"
            >
              -
            </button>
            <span className="text-lg font-semibold w-6 text-center">{qty}</span>
            <button
              type="button"
              onClick={increment}
              className="w-8 h-8 flex items-center justify-center border rounded-full"
            >
              +
            </button>
          </div>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={handleAdd}
            className="w-full bg-teal-600 text-white py-2 rounded hover:bg-teal-700"
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
}
