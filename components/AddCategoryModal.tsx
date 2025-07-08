import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

interface AddCategoryModalProps {
  onClose: () => void;
  onCreated: () => void;
  /** existing category to edit */
  category?: any;
  /** number of categories to set sort order for new ones */
  sortOrder?: number;
}

export default function AddCategoryModal({ onClose, onCreated, category, sortOrder = 0 }: AddCategoryModalProps) {
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
        { name, description, sort_order: sortOrder },
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '2rem',
          width: '100%',
          maxWidth: '500px',
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
          style={{ display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}
        >
          <div style={{ flex: '1 1 auto', overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
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
