import { useEffect, useState, useRef, useMemo } from 'react';
import { UploadCloud, Trash2 } from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { supabase } from '../utils/supabaseClient';

const PREVIEW_SIZE = 256;

async function getCroppedImg(imageSrc: string, pixelCrop: Area) {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => {
    image.onload = resolve;
  });
  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    PREVIEW_SIZE,
    PREVIEW_SIZE
  );
  return new Promise<{ file: File; url: string } | null>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null);
      const file = new File([blob], 'image.jpg', { type: blob.type });
      const url = URL.createObjectURL(blob);
      resolve({ file, url });
    }, 'image/jpeg');
  });
}

interface AddItemModalProps {
  categories: any[];
  /** ID of the restaurant the menu belongs to */
  restaurantId: number;
  defaultCategoryId?: number;
  onClose: () => void;
  onCreated: () => void;
  /** Existing item when editing */
  item?: any;
  /** Whether the modal should be shown */
  isOpen: boolean;
}

export default function AddItemModal({
  categories,
  restaurantId,
  defaultCategoryId,
  onClose,
  onCreated,
  item,
  isOpen,
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
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!isOpen) return;
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
        setRawImage(null);
        setShowCropper(false);

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
        setRawImage(null);
        setShowCropper(false);
        setSelectedCategories(
          defaultCategoryId &&
            filteredCategories.some((c) => c.id === defaultCategoryId)
            ? [defaultCategoryId]
            : []
        );
      }
    };

    resetFields();
  }, [item, defaultCategoryId, filteredCategories, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [categoryDropdownOpen, isOpen]);

  useEffect(() => {
    return () => {
      if (rawImage) URL.revokeObjectURL(rawImage);
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [rawImage, imagePreview]);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const toggleCategory = (id: number) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const url = URL.createObjectURL(file);
      setRawImage(url);
      setShowCropper(true);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    if (rawImage) {
      URL.revokeObjectURL(rawImage);
    }
    setRawImage(null);
  };

  const handleCropSave = async () => {
    if (!rawImage || !croppedAreaPixels) {
      handleCropCancel();
      return;
    }
    const result = await getCroppedImg(rawImage, croppedAreaPixels);
    handleCropCancel();
    if (result) {
      setImageFile(result.file);
      setImagePreview(result.url);
    }
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

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.3)] p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white p-8 rounded-xl shadow-2xl"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 text-red-700 hover:text-red-800" 
        >
          ×
        </button>
        <h3 className="mt-0 mb-4 text-xl font-semibold">
          {item ? 'Edit Item' : 'Add Item'}
        </h3>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col max-h-[80vh] w-full min-w-0 overflow-x-hidden"
        >
          <div className="flex-1 overflow-y-auto pr-2 w-full">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Name"
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
          <div className="mb-4">
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
          <div className="mb-4">
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className="w-full p-2 border border-gray-300 rounded"
            />
            {formattedPrice && (
              <div className="mt-1 text-sm text-gray-600">{formattedPrice}</div>
            )}
          </div>
          {/* Image upload field */}
          <div className="mb-4">
            <div
              role="button"
              tabIndex={0}
              aria-label={imagePreview ? 'Change image' : 'Upload image'}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="mt-2 mx-auto w-full max-w-[200px] h-[200px] overflow-hidden flex items-center justify-center rounded-xl relative cursor-pointer bg-gray-50 border border-dashed border-gray-300 hover:bg-gray-100"
            >
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="object-cover rounded-xl max-w-[200px] max-h-[200px] mx-auto"
                  />
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute top-1 right-1 bg-white/80 rounded-full p-1 text-red-700 hover:text-red-800"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <UploadCloud size={32} aria-hidden="true" className="text-red-700" />
              )}
            </div>
            <input
              ref={fileInputRef}
              id="image-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <small>Images should be square for best results.</small>
          </div>
          <div className="mb-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={is18Plus}
                onChange={(e) => setIs18Plus(e.target.checked)}
              />
              <span>18+</span>
            </label>
          </div>
          <div className="mb-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isVegan}
                onChange={(e) => setIsVegan(e.target.checked)}
              />
              <span>Vegan</span>
            </label>
          </div>
          <div className="mb-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isVegetarian}
                onChange={(e) => setIsVegetarian(e.target.checked)}
              />
              <span>Vegetarian</span>
            </label>
          </div>
          <div className="mb-4 w-full" ref={dropdownRef}>
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
              className="border border-gray-300 min-h-[40px] p-2 flex flex-wrap cursor-pointer w-full rounded"
            >
              {selectedCategories.length === 0 && (
                <span className="text-gray-500">Select categories...</span>
              )}
              {selectedCategories.map((id) => {
                const cat = filteredCategories.find((c) => c.id === id);
                if (!cat) return null;
                return (
                  <span
                    key={id}
                    className="flex items-center px-1 mr-1 mb-1 bg-gray-200 rounded"
                  >
                    {cat.name}
                    <button
                      type="button"
                      aria-label={`Remove ${cat.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory(id);
                      }}
                      className="ml-1 text-red-700 hover:text-red-800"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
            {categoryDropdownOpen && (
              <div
                className="absolute z-10 bg-white border border-gray-300 p-2 max-h-40 overflow-y-auto w-full rounded shadow"
              >
                {filteredCategories.map((cat) => {
                  const checked = selectedCategories.includes(cat.id);
                  return (
                    <div
                      key={cat.id}
                      className="py-1"
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <label className="cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          className="mr-2"
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
          <div className="sticky bottom-0 bg-white pt-4 flex justify-end w-full">
            <button
              type="button"
              onClick={onClose}
              className="mr-2 px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-red-700 text-white hover:bg-red-800"
            >
              Save
            </button>
          </div>
        </form>
      </div>
      {showCropper && rawImage && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80">
          <div className="relative w-[90vw] max-w-[400px] h-[90vh] max-h-[400px]">
            <Cropper
              image={rawImage}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
            />
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 flex flex-col items-center">
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-4/5"
              />
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleCropCancel}
                  className="mr-2 px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCropSave}
                  className="px-3 py-1 rounded bg-red-700 text-white hover:bg-red-800"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
