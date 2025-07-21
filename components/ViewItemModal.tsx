import { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ViewItemModalProps {
  showModal: boolean;
  onClose: () => void;
  item: {
    name: string;
    description?: string;
    price: number;
    image_url?: string | null;
  } | null;
}

export default function ViewItemModal({ showModal, onClose, item }: ViewItemModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showModal) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [showModal]);

  if (!showModal || !item) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center p-4 overflow-x-hidden overflow-y-auto z-[1000] font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-md w-full relative max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
        <div className="space-y-4">
          {item.image_url && (
            <img src={item.image_url} alt={item.name} className="w-full h-48 object-cover rounded" />
          )}
          <h2 className="text-2xl font-bold">{item.name}</h2>
          {item.description && <p className="text-gray-700">{item.description}</p>}
          <p className="text-lg font-semibold">${(item.price / 100).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
