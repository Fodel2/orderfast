import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

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

interface AddonOption {
  id: number;
  name: string;
  price: number | null;
}

interface AddonGroup {
  id: number;
  name: string;
  required: boolean | null;
  addon_options: AddonOption[];
}

export default function MenuItemCard({ item }: { item: MenuItem }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<AddonGroup[]>([]);

  const loadAddons = async () => {
    setLoading(true);
    const { data: links } = await supabase
      .from('item_addon_links')
      .select('group_id')
      .eq('item_id', item.id);
    const groupIds = links?.map((l: any) => l.group_id) || [];
    if (groupIds.length > 0) {
      const { data } = await supabase
        .from('addon_groups')
        .select('id,name,required,addon_options(id,name,price)')
        .in('id', groupIds)
        .order('sort_order');
      setGroups(data || []);
    } else {
      setGroups([]);
    }
    setLoading(false);
  };

  const handleClick = () => {
    setShowModal(true);
    loadAddons();
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
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.id} className="space-y-1">
                    <h4 className="font-semibold">
                      {g.name}{' '}
                      {g.required ? <span className="text-xs">(Required)</span> : null}
                    </h4>
                    <ul className="pl-4 list-disc text-sm">
                      {g.addon_options.map((o) => (
                        <li key={o.id} className="flex justify-between">
                          <span>{o.name}</span>
                          <span>${((o.price || 0) / 100).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
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

