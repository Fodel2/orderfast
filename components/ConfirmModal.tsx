import React from 'react';

interface ConfirmModalProps {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ show, title, message, onConfirm, onCancel }: ConfirmModalProps) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm mb-4">{message}</p>
        <div className="flex justify-end space-x-2">
          <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
