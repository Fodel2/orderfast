import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { getAddonsForItem } from '../utils/getAddonsForItem';
import type { AddonGroup } from '../utils/types';
import AddonGroups from './AddonGroups';

interface MenuItem {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  is_vegetarian?: boolean | null;
  is_18_plus?: boolean | null;
  stock_status?: 'in_stock' | 'scheduled' | 'out' | null;
}


export default function MenuItemCard({
  item,
  restaurantId,
}: {
  item: MenuItem;
  restaurantId: string | number;
}) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [qty, setQty] = useState(1);
  const { addToCart } = useCart();

  const loadAddons = async () => {
    setLoading(true);
    try {
      const data = await getAddonsForItem(item.id);
      setGroups(data);
    } catch (err) {
      console.error('Failed to load addons', err);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    setShowModal(true);
    loadAddons();
  };

  const increment = () => setQty((q) => q + 1);
  const decrement = () => setQty((q) => (q > 1 ? q - 1 : 1));

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const data = await getAddonsForItem(item.id);
      if (data.some((g) => g.required)) {
        alert('This item has required add-ons. Please select them first.');
        return;
      }
    } catch (err) {
      console.error('Failed to load addons', err);
    }

    addToCart(String(restaurantId), {
      item_id: String(item.id),
      name: item.name,
      price: item.price,
      quantity: qty,
    });
    setQty(1);
  };

  return (
    <>
      <div
        onClick={handleClick}
        className="flex gap-4 p-4 border rounded-lg shadow-sm bg-white cursor-pointer"
      >
        <img
          src={item.image_url || 'https://placehold.co/120x120?text=No+Image'}
          alt={item.name}
          className="w-24 h-24 object-cover rounded"
        />
        <div className="flex-1 space-y-1 text-left">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold">{item.name}</h3>
            <span className="font-semibold">${item.price.toFixed(2)}</span>
          </div>
          {item.description && <p className="text-sm text-gray-600">{item.description}</p>}
          <div className="text-xs flex flex-wrap gap-2 mt-1">
            {item.is_vegetarian && (
              <span className="px-2 py-1 bg-green-100 rounded">🌱 Vegetarian</span>
            )}
            {item.is_18_plus && (
              <span className="px-2 py-1 bg-red-100 rounded">🔥 18+</span>
            )}
            {item.stock_status === 'out' && (
              <span className="px-2 py-1 bg-gray-200 rounded">Out of stock</span>
            )}
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-3 flex items-center justify-between"
          >
            <div className="flex items-center border rounded">
              <button
                type="button"
                onClick={decrement}
                className="w-8 h-8 flex items-center justify-center"
              >
                -
              </button>
              <span data-testid="qty" className="w-6 text-center">
                {qty}
              </span>
              <button
                type="button"
                onClick={increment}
                className="w-8 h-8 flex items-center justify-center"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              className="ml-4 px-3 py-1 bg-teal-600 text-white rounded hover:bg-teal-700"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[1000]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-semibold mb-4">{item.name}</h3>
            {loading ? (
              <p className="text-center text-gray-500">Loading...</p>
            ) : groups.length === 0 ? (
              <p className="text-center text-gray-500">No add-ons available</p>
            ) : (
              <AddonGroups addons={groups} />
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

