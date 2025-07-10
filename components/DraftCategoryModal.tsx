import { useEffect, useState } from 'react';

interface DraftCategoryModalProps {
  show: boolean;
  onClose: () => void;
  category?: any;
  onSave: (cat: { id?: number; name: string; description: string }) => void;
}

export default function DraftCategoryModal({ show, onClose, category, onSave }: DraftCategoryModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (show) {
      setName(category?.name || '');
      setDescription(category?.description || '');
    }
  }, [show, category]);

  if (!show) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    onSave({ id: category?.id, name, description });
    setShowSuccess(true);
    setTimeout(() => {
      onClose();
      setShowSuccess(false);
      setSaving(false);
    }, 800);
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[1000]"
    >
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-6 max-w-md w-full relative">
        <h3 className="text-xl font-semibold mb-4">{category ? 'Edit Category' : 'Add Category'}</h3>
        <form onSubmit={handleSubmit}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full border border-gray-300 rounded p-2 mb-3"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full border border-gray-300 rounded p-2 mb-4"
          />
          <div className="text-right space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-teal-600 text-teal-600 rounded hover:bg-teal-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
        {showSuccess && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
            <div className="text-green-600 text-5xl animate-bounce">✓</div>
          </div>
        )}
      </div>
    </div>
  );
}
