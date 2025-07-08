import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';

interface AddItemModalProps {
  categories: any[];
  /** ID of the restaurant the menu belongs to */
  restaurantId: number;
  defaultCategoryId?: number;
  onClose: () => void;
  onCreated: () => void;
  /** Existing item when editing */
  item?: any;
}

export default function AddItemModal({
  categories,
  restaurantId,
  defaultCategoryId,
  onClose,
  onCreated,
  item,
}: AddItemModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [is18Plus, setIs18Plus] = useState(false);
  const [isVegan, setIsVegan] = useState(false);
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.restaurant_id === restaurantId),
    [categories, restaurantId]
  );

  const formattedPrice = useMemo(() => {
    const num = parseFloat(price);
    if (isNaN(num)) return '';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  }, [price]);

  // Pre-fill or reset fields whenever the modal is opened
  useEffect(() => {
    const resetFields = async () => {
      if (item) {
        setName(item.name || '');
        setDescription(item.description || '');
        setPrice(item.price ? String(item.price) : '');
        setIs18Plus(!!item.is_18_plus);
        setIsVegan(!!item.is_vegan);
        setIsVegetarian(!!item.is_vegetarian);
        setImageFile(null);
        setImagePreview(item.image_url || null);

        // Load categories linked to this item. If none exist in the
        // pivot table, fall back to the item's category_id field so the
        // form validation succeeds.
        const { data } = await supabase
          .from('menu_item_categories')
          .select('category_id')
          .eq('item_id', item.id);
        if (data && data.length) {
          const ids = data.map((d) =>
            typeof d.category_id === 'object' ? d.category_id.id : d.category_id
          );
          setSelectedCategories(ids.filter((id) =>
            filteredCategories.some((c) => c.id === id)
          ));
        } else if (item.category_id) {
          const id =
            typeof item.category_id === 'object'
              ? item.category_id.id
              : item.category_id;
          if (filteredCategories.some((c) => c.id === id)) {
            setSelectedCategories([id]);
          } else {
            setSelectedCategories([]);
          }
        } else {
          setSelectedCategories([]);
        }
      } else {
        // Creating a new item
        setName('');
        setDescription('');
        setPrice('');
        setIs18Plus(false);
        setIsVegan(false);
        setIsVegetarian(false);
        setImageFile(null);
        setImagePreview(null);
        setSelectedCategories(
          defaultCategoryId &&
            filteredCategories.some((c) => c.id === defaultCategoryId)
            ? [defaultCategoryId]
            : []
        );
      }
    };

    resetFields();
  }, [item, defaultCategoryId, filteredCategories]);

  useEffect(() => {
    nameInputRef.current?.focus();

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        categoryDropdownOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [categoryDropdownOpen]);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const toggleCategory = (id: number) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !selectedCategories.length) {
      alert('Please fill out all required fields.');
      return;
    }

    if (
      selectedCategories.some(
        (id) => !filteredCategories.find((c) => c.id === id)
      )
    ) {
      alert('Invalid category selected.');
      return;
    }

    let uploadedUrl = imagePreview;

    // Upload new image if a file was selected
    if (imageFile) {
      const filePath = `${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(filePath, imageFile);

      if (uploadError) {
        alert('Failed to upload image: ' + uploadError.message);
        return;
      }

      // Retrieve a public URL for the uploaded image
      const { data: urlData } = supabase.storage
        .from('menu-images')
        .getPublicUrl(filePath);
      uploadedUrl = urlData.publicUrl;
    }

    // Decide whether to insert a new item or update an existing one
    const rawCat = selectedCategories[0];
    const categoryId =
      rawCat && typeof rawCat === 'object' ? (rawCat as any).id : rawCat ?? null;
    const itemData = {
      restaurant_id: restaurantId,
      name,
      description,
      price: parseFloat(price),
      is_18_plus: is18Plus,
      is_vegan: isVegan,
      is_vegetarian: isVegetarian,
      image_url: uploadedUrl,
      category_id: categoryId,
    };

    console.log('Saving menu item:', itemData);

    const { data, error } = await (item
      ? supabase
          .from('menu_items')
          .update(itemData)
          .eq('id', item.id)
          .select()
          .single()
      : supabase
          .from('menu_items')
          .insert([itemData])
          .select()
          .single());

    if (error) {
      alert('Failed to save item: ' + error.message);
      return;
    }

    if (data && data.id) {
      // Remove previous category links when editing
      if (item) {
        await supabase
          .from('menu_item_categories')
          .delete()
          .eq('item_id', data.id);
      }

      if (selectedCategories.length) {
        const catIds = selectedCategories
          .map((c) => (typeof c === 'object' ? (c as any).id : c))
          .filter((id): id is number => typeof id === 'number');
        const inserts = catIds.map((id) => ({
          item_id: data.id,
          category_id: id,
        }));
        const { error: catError } = await supabase
          .from('menu_item_categories')
          .upsert(inserts, { onConflict: 'item_id,category_id' });
        if (catError) {
          const msg =
            (catError as any).message ||
            (typeof catError === 'string' ? catError : 'Unknown error');
          alert('Failed to link categories: ' + msg);
        }
      }
    }

    onCreated();
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
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
        padding: '1rem',
        // Disable any side-to-side scrolling of the overlay itself
        overflowX: 'hidden',
        overflowY: 'auto',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
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
        <h3 style={{ marginTop: 0 }}>{item ? 'Edit Item' : 'Add Item'}</h3>
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', maxHeight: '80vh', width: '100%', minWidth: 0, overflowX: 'hidden', boxSizing: 'border-box' }}
        >
          <div
            style={{
              flex: '1 1 auto',
              overflowY: 'auto',
              paddingRight: '0.5rem',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Name"
                ref={nameInputRef}
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
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            />
            {formattedPrice && (
              <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {formattedPrice}
              </div>
            )}
          </div>
          {/* Image upload field */}
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              <label
                htmlFor="item-image-input"
                style={{
                  border: '1px solid #ccc',
                  padding: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                Select image
              </label>
              <input
                id="item-image-input"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImageFile(file);
                  setImagePreview(file ? URL.createObjectURL(file) : null);
                }}
                style={{ display: 'none' }}
              />
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  style={{
                    border: '1px solid #ccc',
                    padding: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  Remove image
                </button>
              )}
            </div>
            <small>Images should be square for best results.</small>
            {imagePreview && (
              <div
                style={{
                  marginTop: '0.5rem',
                  width: '256px',
                  height: '256px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                checked={isVegan}
                onChange={(e) => setIsVegan(e.target.checked)}
              />{' '}
              Vegan
            </label>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>
              <input
                type="checkbox"
                checked={isVegetarian}
                onChange={(e) => setIsVegetarian(e.target.checked)}
              />{' '}
              Vegetarian
            </label>
          </div>
          <div style={{ marginBottom: '1rem', width: '100%', boxSizing: 'border-box' }} ref={dropdownRef}>
            <div
              role="combobox"
              tabIndex={0}
              aria-expanded={categoryDropdownOpen}
              onClick={() => setCategoryDropdownOpen((o) => !o)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCategoryDropdownOpen((o) => !o);
                }
              }}
              style={{
                border: '1px solid #ccc',
                minHeight: '40px',
                padding: '0.5rem',
                display: 'flex',
                flexWrap: 'wrap',
                cursor: 'pointer',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {selectedCategories.length === 0 && (
                <span style={{ color: '#888' }}>Select categories...</span>
              )}
              {selectedCategories.map((id) => {
                const cat = filteredCategories.find((c) => c.id === id);
                if (!cat) return null;
                return (
                  <span
                    key={id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 4px',
                      margin: '0 4px 4px 0',
                      background: '#eee',
                      borderRadius: '3px',
                    }}
                  >
                    {cat.name}
                    <button
                      type="button"
                      aria-label={`Remove ${cat.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory(id);
                      }}
                      style={{
                        marginLeft: '4px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
            {categoryDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  zIndex: 10,
                  background: 'white',
                  border: '1px solid #ccc',
                  padding: '0.5rem',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {filteredCategories.map((cat) => {
                  const checked = selectedCategories.includes(cat.id);
                  return (
                    <div
                      key={cat.id}
                      style={{ padding: '0.25rem 0' }}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <label style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          style={{ marginRight: '0.5rem', boxSizing: 'border-box' }}
                        />
                        {cat.name}
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
          <div style={{ position: 'sticky', bottom: 0, background: 'white', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', width: '100%', boxSizing: 'border-box' }}>
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
