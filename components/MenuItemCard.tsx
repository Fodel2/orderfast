import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Leaf, Carrot, Beer } from 'lucide-react';
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
  is_vegan?: boolean | null;
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
  const [recentlyAdded, setRecentlyAdded] = useState(false);
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

    setRecentlyAdded(true);
    setTimeout(() => setRecentlyAdded(false), 1000);

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
        className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all flex p-4 gap-4 min-h-[7rem]"
      >
        {item.image_url && (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-20 h-20 object-cover rounded-md flex-shrink-0"
          />
        )}
        <div className="flex flex-col flex-1 text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-bold flex-1">{item.name}</h3>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-md">
              ${ (item.price / 100).toFixed(2) }
            </span>
          </div>
          {item.description && (
            <p className="text-sm text-gray-500 line-clamp-2 mt-1">{item.description}</p>
          )}
          <div className="text-xs flex flex-wrap gap-2 mt-2">
            {item.is_vegan && (
              <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 inline-flex items-center gap-1">
                <Leaf className="w-3 h-3" /> Vegan
              </span>
            )}
            {item.is_vegetarian && (
              <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 inline-flex items-center gap-1">
                <Carrot className="w-3 h-3" /> Vegetarian
              </span>
            )}
            {item.is_18_plus && (
              <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 inline-flex items-center gap-1">
                <Beer className="w-3 h-3" /> 18+
              </span>
            )}
            {item.stock_status === 'out' && (
              <span className="px-2 py-1 bg-gray-200 rounded">Out of stock</span>
            )}
          </div>
          <div className="mt-auto pt-3">
            <motion.button
              type="button"
              aria-label="Add to Cart"
              whileTap={{ scale: 0.95 }}
              animate={recentlyAdded ? { scale: [1, 1.05, 1] } : {}}
              onClick={handleClick}
              className="bg-primary text-white text-sm h-9 px-4 rounded-full w-full sm:w-auto flex items-center justify-center gap-1"
            >
              <ShoppingCart className="w-4 h-4" />
              {recentlyAdded ? '✓ Added' : 'Add to Cart'}
            </motion.button>
          </div>
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
                  aria-label="Decrease quantity"
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
                  aria-label="Increase quantity"
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
                aria-label="Cancel"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                aria-label="Confirm Add to Cart"
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

