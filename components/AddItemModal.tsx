import { useEffect, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Trash2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { STORAGE_BUCKET } from '../lib/storage';
import CategoryMultiSelect from './CategoryMultiSelect';
import AddonMultiSelect from './AddonMultiSelect';
import { updateItemAddonLinks } from '../utils/updateItemAddonLinks';

interface AddItemModalProps {
  showModal: boolean;
  onClose: () => void;
  restaurantId: number;
  defaultCategoryId?: number;
  item?: any;
  onSaved?: () => void;
  categoriesProp?: any[];
  onSaveData?: (data: any, categories: number[], addons: string[]) => Promise<void>;
  onDeleteData?: (id: number) => Promise<void> | void;
  onDeleted?: () => void;
}

export default function AddItemModal({
  showModal,
  onClose,
  restaurantId,
  defaultCategoryId,
  item,
  onSaved,
  categoriesProp,
  onSaveData,
  onDeleteData,
  onDeleted,
}: AddItemModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isVegan, setIsVegan] = useState(false);
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [is18Plus, setIs18Plus] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [addonGroups, setAddonGroups] = useState<any[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const croppedAreaPixels = useRef<Area | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const createImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (err) => reject(err));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });
  };

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );
    }
    return canvas.toDataURL('image/jpeg');
  };

  useEffect(() => {
    if (showModal) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return;

    const load = async () => {
      if (categoriesProp) {
        setCategories(categoriesProp);
      } else {
        const { data: catData } = await supabase
          .from('menu_categories')
          .select('*')
          .eq('restaurant_id', restaurantId);
        const sortedCats = (catData || []).sort((a, b) => {
          const aArch = a.archived_at ? 1 : 0;
          const bArch = b.archived_at ? 1 : 0;
          if (aArch !== bArch) return aArch - bArch;
          const aOrder = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
          const bOrder = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (a.name || '').localeCompare(b.name || '');
        });
        setCategories(sortedCats);
      }

      if (onSaveData) {
        const { data: addonData } = await supabase
          .from('addon_groups')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('id');
        setAddonGroups(addonData || []);
      } else {
        setAddonGroups([]);
      }

      if (item) {
        setName(item.name || '');
        setDescription(item.description || '');
        setPrice(item.price ? String(item.price) : '');
        setIsVegan(!!item.is_vegan);
        setIsVegetarian(!!item.is_vegetarian);
        setIs18Plus(!!item.is_18_plus);
        setImageUrl(item.image_url || null);
        setImageFile(null);

        if (onSaveData) {
          // Draft item editing - use local data
          if (item.category_id) {
            setSelectedCategories([item.category_id]);
          } else {
            setSelectedCategories([]);
          }
          if (Array.isArray(item.addons)) {
            setSelectedAddons(item.addons.map(String));
          } else {
            setSelectedAddons([]);
          }
        } else {
          const { data: links } = await supabase
            .from('menu_item_categories')
            .select('category_id')
            .eq('item_id', String(item.id));
          if (links?.length) {
            setSelectedCategories(links.map((l) => l.category_id));
          } else if (item.category_id) {
            setSelectedCategories([item.category_id]);
          } else {
            setSelectedCategories([]);
          }

          setSelectedAddons([]);
        }
      } else {
        setName('');
        setDescription('');
        setPrice('');
        setIsVegan(false);
        setIsVegetarian(false);
        setIs18Plus(false);
        setImageUrl(null);
        setImageFile(null);
        setSelectedCategories(defaultCategoryId ? [defaultCategoryId] : []);
        setSelectedAddons([]);
      }
    };

    load();
  }, [showModal, item, restaurantId, defaultCategoryId, categoriesProp, onSaveData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setTempImage(url);
      setImageFile(file);
      setCropping(true);
    }
  };

  const handleCategoryChange = (ids: number[]) => setSelectedCategories(ids);
  const handleAddonChange = (ids: string[]) => setSelectedAddons(ids);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0) {
      alert('Please select at least one category');
      return;
    }
    const categoryId = selectedCategories[0] ?? null;
    let finalImageUrl = imageUrl;
    if (imageFile && imageUrl && imageUrl.startsWith('data:')) {
      const path = `menu-images/${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, imageFile, { upsert: true });
      if (uploadError) {
        const errText = [uploadError.name, uploadError.message]
          .filter(Boolean)
          .join(': ');
        alert('Failed to upload image: ' + errText);
        return;
      }
      finalImageUrl =
        supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    const ensureExternalKey = () => {
      if (item?.external_key) return item.external_key;
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return `${Date.now()}-${Math.random()}`;
    };

    const externalKey = onSaveData ? ensureExternalKey() : item?.external_key;

    const itemData: Record<string, any> = {
      restaurant_id: restaurantId,
      name,
      description,
      price: parseFloat(price) || 0,
      is_vegan: isVegan,
      is_vegetarian: isVegetarian,
      is_18_plus: is18Plus,
      image_url: finalImageUrl,
      category_id: categoryId,
    };

    if (externalKey) {
      itemData.external_key = externalKey;
    }

    if (onSaveData) {
      await onSaveData(itemData, selectedCategories, selectedAddons);
      // Draft items are not persisted yet, so skip saving addon links
      onSaved?.();
      onClose();
      return;
    }

    const { data, error } = await (item
      ? supabase.from('menu_items').update(itemData).eq('id', item.id).select().single()
      : supabase.from('menu_items').insert([itemData]).select().single());

    if (error) {
      alert('Failed to save item: ' + error.message);
      return;
    }

    if (data?.id) {
      if (item) {
        await supabase
          .from('menu_item_categories')
          .delete()
          .eq('item_id', String(data.id));
      }
      if (selectedCategories.length) {
        await supabase.from('menu_item_categories').insert(
          selectedCategories.map((cid) => ({
            item_id: String(data.id),
            category_id: String(cid),
          }))
        );
      }
      try {
        await updateItemAddonLinks(String(data.id), selectedAddons);
      } catch (err: any) {
        alert('Failed to update addon links: ' + (err?.message || err));
      }
    }

    onSaved?.();
    onClose();
  };

  const handleCropComplete = (_: Area, areaPixels: Area) => {
    croppedAreaPixels.current = areaPixels;
  };

  const handleConfirmCrop = async () => {
    if (tempImage && croppedAreaPixels.current) {
      const cropped = await getCroppedImg(tempImage, croppedAreaPixels.current);
      setImageUrl(cropped);
      // Convert data URL to File for upload
      const res = await fetch(cropped);
      const blob = await res.blob();
      const name = `item-${Date.now()}.jpg`;
      setImageFile(new File([blob], name, { type: blob.type }));
    }
    setCropping(false);
    setTempImage(null);
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageUrl(null);
    setImageFile(null);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!window.confirm('Delete this item?')) return;
    if (onDeleteData) {
      await onDeleteData(item.id);
      onDeleted?.();
      onClose();
      return;
    }
    await supabase.from('menu_items').delete().eq('id', String(item.id));
    await supabase
      .from('menu_item_categories')
      .delete()
      .eq('item_id', String(item.id));
    await supabase
      .from('item_addon_links')
      .delete()
      .eq('item_id', String(item.id));
    onDeleted?.();
    onClose();
  };

  if (!showModal) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center p-4 overflow-x-hidden overflow-y-auto z-[1000] font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-lg p-6 sm:p-8 max-w-lg w-full relative max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold mb-6">{item ? 'Edit Item' : 'Add Item'}</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex items-start space-x-4">
            <div
              className="relative w-32 h-32 border border-dashed border-gray-400 rounded flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0"
              onClick={() => fileRef.current?.click()}
            >
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt="Preview" className="object-cover w-full h-full" />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-1 right-1 bg-white/80 rounded-full p-1 hover:bg-red-100"
                    aria-label="Remove image"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </>
              ) : (
                <CloudArrowUpIcon className="w-8 h-8 text-gray-400" />
              )}
              <input
                type="file"
                accept="image/*"
                ref={fileRef}
                onChange={handleFileChange}
                aria-label="Upload image"
                className="hidden"
              />
            </div>
            <div className="text-sm text-gray-500 leading-snug">
              <p>Square image works best.</p>
              <p>PNG or JPG at least 512x512.</p>
            </div>
          </div>
          <label className="block text-sm font-semibold">
            Name
            <input
              type="text"
              aria-label="Item name"
              placeholder="e.g. The Ultimate Veggie Burger 🍔"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded p-2"
            />
          </label>
          <label className="block text-sm font-semibold">
            Description
            <textarea
              aria-label="Item description"
              placeholder="e.g. A juicy plant-based patty with all the fixings"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded p-2"
            />
          </label>
          <label className="block text-sm font-semibold">
            Price
            <input
              type="number"
              step="0.01"
              aria-label="Price"
              placeholder="e.g. 9.99"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded p-2"
            />
          </label>
          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center space-x-1">
              <input type="checkbox" aria-label="Vegan" checked={isVegan} onChange={(e) => setIsVegan(e.target.checked)} />
              <span>Vegan</span>
            </label>
            <label className="flex items-center space-x-1">
              <input type="checkbox" aria-label="Vegetarian" checked={isVegetarian} onChange={(e) => setIsVegetarian(e.target.checked)} />
              <span>Vegetarian</span>
            </label>
            <label className="flex items-center space-x-1">
              <input type="checkbox" aria-label="18+" checked={is18Plus} onChange={(e) => setIs18Plus(e.target.checked)} />
              <span>18+</span>
            </label>
          </div>
          <CategoryMultiSelect
            categories={categories}
            selectedIds={selectedCategories}
            onChange={handleCategoryChange}
          />
          {onSaveData && (
            <AddonMultiSelect
              options={addonGroups}
              selectedIds={selectedAddons}
              onChange={handleAddonChange}
            />
          )}
          <div className="text-right mt-6 space-x-2">
            {item && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 mr-auto"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-teal-600 text-teal-600 rounded hover:bg-teal-50"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">
              Save
            </button>
          </div>
        </form>
      </div>

      {cropping && tempImage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100]">
          <div className="bg-white p-4 rounded-xl">
            <div className="relative w-64 h-64">
              <Cropper
                image={tempImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full mt-2"
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setCropping(false);
                  setTempImage(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
