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
      className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center p-4 overflow-x-hidden overflow-y-auto z-[1000]"
    >
      <div
        style={{
          background: 'white',
          padding: '2rem',
          width: '100%',
          maxWidth: '500px',
          minWidth: 0,
          position: 'relative',
          overflowX: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            background: 'transparent',
            border: 'none',
            fontSize: '1.5rem',
            lineHeight: '1',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
        <h3 style={{ marginTop: 0 }}>{category ? 'Edit Category' : 'Add Category'}</h3>
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '80vh',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            overflowX: 'hidden',
          }}
        >
          <div style={{ flex: '1 1 auto', overflowY: 'auto', paddingRight: '0.5rem', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'white',
              paddingTop: '1rem',
              display: 'flex',
              justifyContent: 'flex-end',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <button type="button" onClick={onClose} style={{ marginRight: '0.5rem' }}>
              Cancel
            </button>
            <button type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
