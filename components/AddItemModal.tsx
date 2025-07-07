import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

interface AddItemModalProps {
  categories: any[];
  defaultCategoryId?: number;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddItemModal({
  categories,
  defaultCategoryId,
  onClose,
  onCreated,
}: AddItemModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [is18Plus, setIs18Plus] = useState(false);
  const [vegan, setVegan] = useState(false);
  const [vegetarian, setVegetarian] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  useEffect(() => {
    if (defaultCategoryId) {
      setSelectedCategories([defaultCategoryId]);
    }
  }, [defaultCategoryId]);

  const handleSelectChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const values = Array.from(e.target.selectedOptions).map((o) =>
      parseInt(o.value, 10)
    );
    setSelectedCategories(values);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data, error } = await supabase
      .from('menu_items')
      .insert([
        {
          name,
          description,
          price: parseFloat(price),
          is_18_plus: is18Plus,
          vegan,
          vegetarian,
        },
      ])
      .select()
      .single();

    if (error) {
      alert('Failed to create item: ' + error.message);
      return;
    }

    if (data && data.id && selectedCategories.length) {
      const inserts = selectedCategories.map((catId) => ({
        item_id: data.id,
        category_id: catId,
      }));
      const { error: catError } = await supabase
        .from('menu_item_categories')
        .insert(inserts);
      if (catError) {
        alert('Failed to link categories: ' + catError.message);
      }
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
      <div style={{ background: 'white', padding: '2rem', width: '400px', position: 'relative' }}>
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
        <h3 style={{ marginTop: 0 }}>Add Item</h3>
        <form onSubmit={handleSubmit}>
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
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>
              <input
                type="checkbox"
                checked={is18Plus}
                onChange={(e) => setIs18Plus(e.target.checked)}
              />{' '}
              18+
            </label>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>
              <input
                type="checkbox"
                checked={vegan}
                onChange={(e) => setVegan(e.target.checked)}
              />{' '}
              Vegan
            </label>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>
              <input
                type="checkbox"
                checked={vegetarian}
                onChange={(e) => setVegetarian(e.target.checked)}
              />{' '}
              Vegetarian
            </label>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <select
              multiple
              value={selectedCategories.map(String)}
              onChange={handleSelectChange}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ marginRight: '0.5rem' }}
            >
              Cancel
            </button>
            <button type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
