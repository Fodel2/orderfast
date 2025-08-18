import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';

interface ImageEditorModalProps {
  src: string;
  open: boolean;
  onCancel: () => void;
  onSave: (coords: { x: number; y: number }) => void;
}

export default function ImageEditorModal({ src, open, onCancel, onSave }: ImageEditorModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const centerRef = useRef({ x: 0.5, y: 0.5 });

  const handleComplete = useCallback((area: Area, _pixels: Area) => {
    centerRef.current = {
      x: (area.x + area.width / 2) / 100,
      y: (area.y + area.height / 2) / 100,
    };
  }, []);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white rounded-lg w-full max-w-3xl p-4 flex flex-col">
        <div className="relative w-full aspect-video bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleComplete}
            aspect={16 / 9}
            showGrid={false}
          />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(centerRef.current)}
            className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

