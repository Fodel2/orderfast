import { useEffect, useState } from 'react';

interface Category { id: number; name: string; }
interface DraftItemModalProps {
  show: boolean;
  categories: Category[];
  item?: any;
  onClose: () => void;
  onSave: (item: any) => void;
}

export default function DraftItemModal({ show, categories, item, onClose, onSave }: DraftItemModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);

  useEffect(() => {
    if (show) {
      setName(item?.name || '');
      setDescription(item?.description || '');
      setPrice(item?.price ? String(item.price) : '');
      setCategoryId(item?.category_id ?? (categories[0]?.id || null));
    }
  }, [show, item, categories]);

  if (!show) return null;
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[1000]">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl p-6 max-w-md w-full">
        <h3 className="text-xl font-semibold mb-4">{item ? 'Edit Item' : 'Add Item'}</h3>
        <form onSubmit={(e) => {e.preventDefault(); if (categoryId != null) onSave({ id: item?.id, name, description, price: parseFloat(price) || 0, category_id: categoryId });}}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full border border-gray-300 rounded p-2 mb-3" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full border border-gray-300 rounded p-2 mb-3" />
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" className="w-full border border-gray-300 rounded p-2 mb-3" />
          <select value={categoryId ?? ''} onChange={(e) => setCategoryId(Number(e.target.value))} className="w-full border border-gray-300 rounded p-2 mb-4">
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="text-right space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-teal-600 text-teal-600 rounded hover:bg-teal-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
