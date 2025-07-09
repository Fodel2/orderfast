import { useEffect, useRef, useState } from 'react';

interface AddItemModalProps {
  showModal: boolean;
  onClose: () => void;
}

export default function AddItemModal({ showModal, onClose }: AddItemModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageUrl(URL.createObjectURL(file));
    }
  };

  if (!showModal) return null;
  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
      className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center p-4 overflow-x-hidden overflow-y-auto z-[1000] font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full relative"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-6">Edit Item</h2>
        <form className="space-y-4">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded p-2"
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded p-2"
          />
          <div>
            <div
              className="w-32 h-32 border border-dashed border-gray-400 rounded flex items-center justify-center cursor-pointer mb-2"
              onClick={() => fileRef.current?.click()}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="max-w-[200px] max-h-[200px] object-cover rounded-xl mx-auto"
                />
              ) : (
                <span className="text-gray-500">Upload</span>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <div className="text-right mt-6 space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#b91c1c] text-[#b91c1c] rounded hover:bg-[#b91c1c]/10"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-[#b91c1c] text-white rounded hover:bg-[#a40f0f]">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
