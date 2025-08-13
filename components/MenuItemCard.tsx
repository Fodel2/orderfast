import { useState } from 'react';
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
  const { addToCart } = useCart();

  const price = typeof item?.price === 'number' ? item.price : Number(item?.price || 0);

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
      price: price,
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
      <div
        className="bg-white rounded-2xl p-4 shadow-[0_1px_12px_rgba(0,0,0,0.06)] mb-4"
        onClick={handleClick}
      >
        <div className="flex items-start gap-4">
          {item?.image_url ? (
            <img
              src={item.image_url}
              alt={item.name}
              className="w-[84px] h-[84px] rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-[84px] h-[84px] rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M7 7l2 10h6l2-10"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-base font-semibold leading-6 truncate">{item.name}</h4>
              <div className="text-gray-900 font-semibold whitespace-nowrap">
                ${ (price / 100).toFixed(2) }
              </div>
            </div>
            {item.description && (
              <p className="text-gray-500 text-sm mt-1 line-clamp-2">{item.description}</p>
            )}
            <button
              type="button"
              className="btn-primary w-full mt-3 py-3 rounded-xl"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              aria-label={`Add ${item?.name} to plate`}
            >
              <span className="inline-flex items-center gap-2 justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M3 6h18M7 6l2 12h6l2-12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Add to Plate
              </span>
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
                className="px-4 py-2 rounded hover:opacity-90 btn-primary"
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

