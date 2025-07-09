import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

interface AddCategoryModalProps {
  onClose: () => void;
  onCreated: () => void;
  /** existing category to edit */
  category?: any;
  /** number of categories to set sort order for new ones */
  sortOrder?: number;
  /** restaurant the category belongs to */
  restaurantId: number;
}

export default function AddCategoryModal({
  onClose,
  onCreated,
  category,
  sortOrder = 0,
  restaurantId,
}: AddCategoryModalProps) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('Name is required');
      return;
    }

    let err;
    if (category) {
      const { error } = await supabase
        .from('menu_categories')
        .update({ name, description })
        .eq('id', category.id);
      err = error;
    } else {
      const { error } = await supabase.from('menu_categories').insert([
        { name, description, sort_order: sortOrder, restaurant_id: restaurantId },
      ]);
      err = error;
    }

    if (err) {
      alert('Failed to save category: ' + err.message);
      return;
    }
    onCreated();
    onClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center p-4 overflow-x-hidden overflow-y-auto z-[1000] font-sans debug-modal"
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
        <h3 className="text-xl font-semibold mb-4">{category ? 'Edit Category' : 'Add Category'}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh] space-y-4">
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded p-2"
            />
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded p-2"
            />
          </div>
          <div className="sticky bottom-0 bg-white pt-4 flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#b91c1c] text-[#b91c1c] rounded hover:bg-[#b91c1c]/10">
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
