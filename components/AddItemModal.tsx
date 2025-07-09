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
  restaurantId: number;
  defaultCategoryId?: number;
  item?: any;
  onSaved?: () => void;
}

export default function AddItemModal({
  showModal,
  onClose,
  restaurantId,
  defaultCategoryId,
  item,
  onSaved,
}: AddItemModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isVegan, setIsVegan] = useState(false);
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [is18Plus, setIs18Plus] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const croppedAreaPixels = useRef<Area | null>(null);

  // Utility to crop the image
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

  // Load categories and prefill fields when the modal is opened
  useEffect(() => {
    if (!showModal) return;

    const load = async () => {
      const { data: catData } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true });
      setCategories(catData || []);

      if (item) {
        setName(item.name || '');
        setDescription(item.description || '');
        setPrice(item.price ? String(item.price) : '');
        setIsVegan(!!item.is_vegan);
        setIsVegetarian(!!item.is_vegetarian);
        setIs18Plus(!!item.is_18_plus);
        setImageUrl(item.image_url || null);
        const { data: links } = await supabase
          .from('menu_item_categories')
          .select('category_id')
          .eq('item_id', item.id);
        if (links && links.length) {
          setSelectedCategories(links.map((l) => l.category_id));
        } else if (item.category_id) {
          setSelectedCategories([item.category_id]);
        } else {
          setSelectedCategories([]);
        }
      } else {
        setName('');
        setDescription('');
        setPrice('');
        setIsVegan(false);
        setIsVegetarian(false);
        setIs18Plus(false);
        setImageUrl(null);
        setSelectedCategories(
          defaultCategoryId ? [defaultCategoryId] : []
        );
      }
    };

    load();
  }, [showModal, item, restaurantId, defaultCategoryId]);

  // Handle image file change (open cropper)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setTempImage(url);
      setCropping(true);
      setImageFile(file);
    }
  };

  // For custom dropdown (multi-select)
  const handleCategoryChange = (values: number[]) => {
    setSelectedCategories(values);
  };

  // Remove image
  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageUrl(null);
    setImageFile(null);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  // Handle image crop complete
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

  // Handle submit logic
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !selectedCategories.length) {
      alert('Please fill out all required fields.');
      return;
    }

    let uploadedUrl = imageUrl;

    if (imageFile && !uploadedUrl?.startsWith('http')) {
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
      restaurant_id: restaurantId,
      name,
      description,
      price: parseFloat(price),
      is_vegan: isVegan,
      is_vegetarian: isVegetarian,
      is_18_plus: is18Plus,
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
        await supabase.from('menu_item_categories').delete().eq('item_id', data.id);
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

    onSaved && onSaved();
    onClose();
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
      className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center p-4 overflow-x-hidden overflow-y-auto z-[1000] font-sans"
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
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={isVegan}
                onChange={(e) => setIsVegan(e.target.checked)}
              />
              <span>Vegan</span>
            </label>
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={isVegetarian}
                onChange={(e) => setIsVegetarian(e.target.checked)}
              />
              <span>Vegetarian</span>
            </label>
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={is18Plus}
                onChange={(e) => setIs18Plus(e.target.checked)}
              />
              <span>18+</span>
            </label>
          </div>
          <MultiSelectDropdown
            options={categories}
            selected={selectedCategories}
            onChange={handleCategoryChange}
            placeholder="Select categories"
          />
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
