import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

interface AddItemModalProps {
  categories: any[];
  defaultCategoryId?: number;
  onClose: () => void;
  onCreated: () => void;
  /** Existing item when editing */
  item?: any;
}

export default function AddItemModal({
  categories,
  defaultCategoryId,
  onClose,
  onCreated,
  item,
}: AddItemModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [is18Plus, setIs18Plus] = useState(false);
  const [vegan, setVegan] = useState(false);
  const [vegetarian, setVegetarian] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // If an existing item is provided, pre-fill all fields for editing
  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setDescription(item.description || '');
      setPrice(item.price ? String(item.price) : '');
      setIs18Plus(!!item.is_18_plus);
      setVegan(!!item.vegan);
      setVegetarian(!!item.vegetarian);
      if (item.image_url) {
        setImagePreview(item.image_url);
      }
      if (item.category_id) {
        setSelectedCategories([item.category_id]);
      }
    }
  }, [item]);

  // If creating a new item and a default category is provided, preselect it
  useEffect(() => {
    if (!item && defaultCategoryId) {
      setSelectedCategories([defaultCategoryId]);
    }
  }, [defaultCategoryId, item]);

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
    let uploadedUrl = imagePreview;

    // Upload new image if a file was selected
    if (imageFile) {
      const filePath = `${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('menu_item_images')
        .upload(filePath, imageFile);

      if (uploadError) {
        alert('Failed to upload image: ' + uploadError.message);
        return;
      }

      // Retrieve a public URL for the uploaded image
      const { data: urlData } = supabase.storage
        .from('menu_item_images')
        .getPublicUrl(filePath);
      uploadedUrl = urlData.publicUrl;
    }

    // Decide whether to insert a new item or update an existing one
    const { data, error } = await (item
      ? supabase
          .from('menu_items')
          .update({
            name,
            description,
            price: parseFloat(price),
            is_18_plus: is18Plus,
            vegan,
            vegetarian,
            image_url: uploadedUrl,
          })
          .eq('id', item.id)
          .select()
          .single()
      : supabase
          .from('menu_items')
          .insert([
            {
              name,
              description,
              price: parseFloat(price),
              is_18_plus: is18Plus,
              vegan,
              vegetarian,
              image_url: uploadedUrl,
            },
          ])
          .select()
          .single());

    if (error) {
      alert('Failed to save item: ' + error.message);
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
          {/* Image upload field */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setImageFile(file);
                setImagePreview(file ? URL.createObjectURL(file) : null);
              }}
            />
            {imagePreview && (
              <div style={{ marginTop: '0.5rem' }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </div>
            )}
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
