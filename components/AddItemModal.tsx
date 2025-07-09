import { useEffect, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Trash2 } from 'lucide-react';
import MultiSelectDropdown from './MultiSelectDropdown';
import { supabase } from '../utils/supabaseClient';

interface Category {
  id: number;
  name: string;
}

interface AddItemModalProps {
  showModal: boolean;
  onClose: () => void;
  /** list of categories to choose from */
  categories?: Category[];
  /** optionally preselect a single category */
  defaultCategoryId?: number;
  /** existing item when editing */
  item?: any;
  /** callback when an item is created or updated */
  onCreated?: () => void;
}

export default function AddItemModal({
  showModal,
  onClose,
  categories = [],
  defaultCategoryId,
  item,
  onCreated,
}: AddItemModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [is18Plus, setIs18Plus] = useState(false);
  const [isVegan, setIsVegan] = useState(false);
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const croppedAreaPixels = useRef<Area | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

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
    const loadItemCategories = async (itemId: number) => {
      const { data } = await supabase
        .from('menu_item_categories')
        .select('category_id')
        .eq('item_id', itemId);
      if (data) {
        setSelectedCategories(data.map((d) => d.category_id));
      }
    };

    if (showModal) {
      if (item) {
        setName(item.name || '');
        setDescription(item.description || '');
        setPrice(item.price ? String(item.price) : '');
        setIs18Plus(!!item.is_18_plus);
        setIsVegan(!!item.is_vegan);
        setIsVegetarian(!!item.is_vegetarian);
        setImageUrl(item.image_url || null);
        setImageFile(null);
        loadItemCategories(item.id);
      } else {
        setName('');
        setDescription('');
        setPrice('');
        setIs18Plus(false);
        setIsVegan(false);
        setIsVegetarian(false);
        setImageUrl(null);
        setImageFile(null);
        setSelectedCategories(
          defaultCategoryId ? [defaultCategoryId] : []
        );
      }
    }
  }, [showModal, item, defaultCategoryId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setTempImage(url);
      setCropping(true);
      setImageFile(file);
    }
  };

  const handleCropComplete = (_: Area, areaPixels: Area) => {
    croppedAreaPixels.current = areaPixels;
  };

  const handleConfirmCrop = async () => {
    if (tempImage && croppedAreaPixels.current) {
      const cropped = await getCroppedImg(tempImage, croppedAreaPixels.current);
      setImageUrl(cropped);
      const blob = await (await fetch(cropped)).blob();
      setImageFile(new File([blob], imageFile?.name || 'image.jpg', { type: 'image/jpeg' }));
    }
    setCropping(false);
    setTempImage(null);
  };

  const handleCategoryChange = (values: number[]) => {
    setSelectedCategories(values);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !selectedCategories.length) {
      alert('Please fill out all required fields.');
      return;
    }

    let uploadedUrl = imageUrl;

    if (imageFile) {
      const filePath = `${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('menu_item_images')
        .upload(filePath, imageFile);
      if (uploadError) {
        alert('Failed to upload image: ' + uploadError.message);
        return;
      }
      const { data: urlData } = supabase.storage
        .from('menu_item_images')
        .getPublicUrl(filePath);
      uploadedUrl = urlData.publicUrl;
    }

    const itemData = {
      name,
      description,
      price: parseFloat(price),
      is_18_plus: is18Plus,
      is_vegan: isVegan,
      is_vegetarian: isVegetarian,
      image_url: uploadedUrl,
    };

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
      if (item) {
        await supabase
          .from('menu_item_categories')
          .delete()
          .eq('item_id', data.id);
      }
      if (selectedCategories.length) {
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
    }

    onCreated && onCreated();
    onClose();
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageUrl(null);
    setImageFile(null);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  if (!showModal) return null;
  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) {
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
          <XMarkIcon className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold mb-6">Edit Item</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded p-2"
          />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded p-2"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full border border-gray-300 rounded p-2"
        />
        <div className="space-x-4">
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              checked={is18Plus}
              onChange={(e) => setIs18Plus(e.target.checked)}
            />
            <span>18+</span>
          </label>
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isVegan}
              onChange={(e) => setIsVegan(e.target.checked)}
            />
            <span>Vegan</span>
          </label>
          <label className="inline-flex items-center space-x-2">
            <input
              type="checkbox"
              checked={isVegetarian}
              onChange={(e) => setIsVegetarian(e.target.checked)}
            />
            <span>Vegetarian</span>
          </label>
        </div>
          <div>
            <div
              className="relative w-32 h-32 border border-dashed border-gray-400 rounded flex items-center justify-center cursor-pointer mb-2 overflow-hidden"
              onClick={() => fileRef.current?.click()}
            >
              {imageUrl ? (
                <>
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="object-cover w-full h-full"
                  />
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
            </div>
          <input
            type="file"
            accept="image/*"
            ref={fileRef}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        {categories && categories.length > 0 && (
          <MultiSelectDropdown
            options={categories}
            selected={selectedCategories}
            onChange={handleCategoryChange}
            placeholder="Select categories"
          />
        )}
        <div className="text-right mt-6 space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#b91c1c] text-[#b91c1c] rounded hover:bg-[#b91c1c]/10"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-[#b91c1c] text-white rounded hover:bg-[#a40f0f]">
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
                className="px-4 py-2 bg-[#b91c1c] text-white rounded hover:bg-[#a40f0f]"
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
