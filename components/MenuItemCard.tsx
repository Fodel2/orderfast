import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { getAddonsForItem } from '../utils/getAddonsForItem';
import type { AddonGroup } from '../utils/types';
import AddonGroups, { validateAddonSelections } from './AddonGroups';

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
  const [notes, setNotes] = useState('');
  const [selections, setSelections] = useState<
    Record<string, Record<string, number>>
  >({});
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

  const handleFinalAdd = () => {
    const errors = validateAddonSelections(groups, selections);
    if (Object.keys(errors).length) {
      alert('Please complete required add-ons');
      return;
    }

    const addons = groups.flatMap((g) => {
      const gid = g.group_id ?? g.id;
      const opts = selections[gid] || {};
      return g.addon_options
        .map((opt) => {
          const q = opts[opt.id] || 0;
          if (q > 0) {
            return {
              option_id: opt.id,
              name: opt.name,
              price: opt.price ?? 0,
              quantity: q,
            };
          }
          return null;
        })
        .filter(Boolean) as any;
    });

    addToCart(String(restaurantId), {
      item_id: String(item.id),
      name: item.name,
      price: item.price,
      quantity: qty,
      notes: notes.trim() || undefined,
      addons: addons.length ? addons : undefined,
    });

    setQty(1);
    setNotes('');
    setSelections({});
    setShowModal(false);
  };

  return (
    <>
      <motion.div
        whileInView={{ opacity: [0, 1], y: [20, 0] }}
        viewport={{ once: true }}
        className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col hover:shadow-lg transition"
      >
        <div className="relative w-full h-40 bg-gray-100 overflow-hidden">
          <img
            src={item.image_url || 'https://placehold.co/400x240?text=No+Image'}
            alt={item.name}
            className="object-cover w-full h-full"
          />
        </div>
        <div className="p-4 flex flex-col flex-1 text-left">
          <h3 className="font-semibold text-lg">{item.name}</h3>
          {item.description && (
            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
          )}
          <div className="text-xs flex flex-wrap gap-2 mt-2">
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
          <div className="mt-auto flex items-center justify-between pt-3">
            <span className="font-semibold text-lg">${(item.price / 100).toFixed(2)}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={decrement}
                className="w-8 h-8 flex items-center justify-center border rounded-full"
              >
                -
              </button>
              <span className="w-6 text-center">{qty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={increment}
                className="w-8 h-8 flex items-center justify-center border rounded-full"
              >
                +
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClick}
            className="mt-3 w-full bg-teal-600 text-white rounded-full py-2 hover:bg-teal-700"
          >
            Add to Cart
          </button>
        </div>
      </motion.div>

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
              <AddonGroups addons={groups} onChange={setSelections} />
            )}

            <div className="mt-4 flex items-center justify-between">
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
            </div>

            <textarea
              className="mt-4 w-full border rounded p-2"
              placeholder="Add notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalAdd}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

