import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

/**
 * Lightweight toast notification.
 * Automatically hides after a few seconds.
 */
export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onClose, 3000);
    return () => clearTimeout(id);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 bg-teal-600 text-white px-4 py-2 rounded shadow z-[1001]">
      {message}
    </div>
  );
}
