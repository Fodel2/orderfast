import { useState } from 'react';
import { Disclosure } from '@headlessui/react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

export interface StockTabProps {
  categories: {
    id: string;
    name: string;
    items: {
      id: string;
      name: string;
      stock_status: 'in_stock' | 'scheduled' | 'out';
      stock_return_date: string | null;
    }[];
  }[];
  addons: {
    id: string;
    name: string;
    stock_status: 'in_stock' | 'scheduled' | 'out';
    stock_return_date: string | null;
    group_id: string;
    group_name: string;
    available?: boolean | null;
    out_of_stock_until?: string | null;
    stock_last_updated_at?: string | null;
  }[];
  restaurantId?: number | null;
}

function StockStatusBadge({ status, returnDate }: { status: 'in_stock' | 'scheduled' | 'out'; returnDate: string | null }) {
  let label = '';
  let color = '';
  if (status === 'in_stock') {
    label = 'In Stock';
    color = 'bg-green-100 text-green-800';
  } else if (status === 'scheduled') {
    label = returnDate ? `Back ${new Date(returnDate).toLocaleDateString()}` : 'Scheduled';
    color = 'bg-yellow-100 text-yellow-800';
  } else {
    label = 'Out of Stock';
    color = 'bg-red-100 text-red-800';
  }
  return <span className={`text-xs px-2 py-1 rounded ${color}`}>{label}</span>;
}

export default function StockTab({ categories, addons, restaurantId }: StockTabProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(categories.map((c) => c.id)));
  const [data, setData] = useState<typeof categories>(categories);
  const [addonData, setAddonData] = useState<typeof addons>(addons);
  const [savedRows, setSavedRows] = useState<Record<string, boolean>>({});

  const stockOptions = [
    { value: 'in_stock', label: 'In Stock' },
    { value: 'scheduled', label: 'Back Tomorrow' },
    { value: 'out', label: 'Off Indefinitely' },
  ] as const;

  const expandAll = () => setExpanded(new Set(data.map((c) => c.id)));
  const collapseAll = () => setExpanded(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const tomorrowMidnight = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  const updateStockStatus = async (
    table: 'menu_items' | 'addon_options',
    rowId: string,
    status: 'in_stock' | 'scheduled' | 'out'
  ) => {
    const { supabase } = await import('../utils/supabaseClient');
    let returnDate: string | null = null;
    if (status === 'scheduled') {
      returnDate = tomorrowMidnight();
    }
    let query = supabase
      .from(table)
      .update({
        stock_status: status,
        stock_return_date: returnDate,
        out_of_stock_until: returnDate,
        stock_last_updated_at: new Date().toISOString(),
      })
      .eq('id', rowId);
    if (table === 'menu_items' && restaurantId) {
      query = query.eq('restaurant_id', restaurantId);
    }
    const { error } = await query;
    if (error) {
      console.error('Failed to update stock', error);
      return false;
    }
    setSavedRows((prev) => ({ ...prev, [rowId]: true }));
    window.setTimeout(() => {
      setSavedRows((prev) => ({ ...prev, [rowId]: false }));
    }, 1200);
    return true;
  };

  const handleStockChange = (
    itemId: string,
    newStatus: 'in_stock' | 'scheduled' | 'out'
  ) => {
    setData((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items.map((it) =>
          it.id === itemId
            ? {
                ...it,
                stock_status: newStatus,
                stock_return_date:
                  newStatus === 'scheduled' ? tomorrowMidnight() : null,
              }
            : it
        ),
      }))
    );
    updateStockStatus('menu_items', itemId, newStatus);
  };

  const handleAddonStockChange = (
    addonId: string,
    newStatus: 'in_stock' | 'scheduled' | 'out'
  ) => {
    setAddonData((prev) =>
      prev.map((addon) =>
        addon.id === addonId
          ? {
              ...addon,
              stock_status: newStatus,
              stock_return_date: newStatus === 'scheduled' ? tomorrowMidnight() : null,
            }
          : addon
      )
    );
    updateStockStatus('addon_options', addonId, newStatus);
  };

  const addonsByGroup = addonData.reduce<Record<string, typeof addonData>>((acc, addon) => {
    const key = addon.group_name || 'Other add-ons';
    if (!acc[key]) acc[key] = [];
    acc[key].push(addon);
    return acc;
  }, {});

  return (
    <div className="w-full max-w-full">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span role="img" aria-label="fries">
              🍟
            </span>{' '}
            Live Stock Control
          </h2>
          <p className="text-sm text-gray-600">
            Quickly mark your items, add-ons, or full categories as out of stock — whether it's just for today or until further notice.
          </p>
        </div>
        <div className="shrink-0 flex items-center justify-end">
          <button
            onClick={() => {
              const allOpen = expanded.size === data.length;
              if (allOpen) collapseAll();
              else expandAll();
            }}
            className="p-2 rounded hover:bg-gray-200 transition-transform hover:opacity-80"
            aria-label={expanded.size === data.length ? 'Collapse all' : 'Expand all'}
          >
            <ChevronDownIcon
              className={`w-5 h-5 transition-transform ${expanded.size === data.length ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((cat) => {
          const isOpen = expanded.has(cat.id);
          return (
            <Disclosure key={`${cat.id}-${isOpen}`} defaultOpen={isOpen}>
              {({ open }) => (
                <div className="bg-white rounded-lg shadow">
                  <Disclosure.Button
                    className="w-full flex min-w-0 items-center justify-between gap-3 px-4 py-3"
                    onClick={() => toggle(cat.id)}
                  >
                    <span className="min-w-0 flex-1 break-words text-left font-semibold">
                      {cat.name}
                    </span>
                    <ChevronUpIcon className={`w-5 h-5 transition-transform ${open ? '' : 'rotate-180'}`} />
                  </Disclosure.Button>
                  <Disclosure.Panel className="px-4 pb-4">
                    {cat.items.length === 0 ? (
                      <p className="text-sm text-gray-500">No items</p>
                    ) : (
                      <ul className="space-y-2">
                        {cat.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex min-w-0 items-center justify-between gap-2 border-b pb-1 last:border-b-0"
                          >
                            <span className="min-w-0 flex-1 break-words">{item.name}</span>
                            <div className="shrink-0 flex items-center space-x-2">
                              <StockStatusBadge status={item.stock_status} returnDate={item.stock_return_date} />
                              <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1 text-xs">
                                {stockOptions.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleStockChange(item.id, opt.value)}
                                    className={`rounded-full px-2.5 py-1 font-medium transition ${item.stock_status === opt.value ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                              {savedRows[item.id] ? <span className="text-xs text-emerald-600">Saved</span> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Disclosure.Panel>
                </div>
              )}
            </Disclosure>
          );
        })}
      </div>
      {addonData.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-2">Add-ons</h3>
          <div className="space-y-3">
            {Object.entries(addonsByGroup).map(([groupName, groupAddons]) => (
              <div key={groupName} className="rounded-lg bg-white p-3 shadow">
                <h4 className="mb-2 text-sm font-semibold text-gray-700">{groupName}</h4>
                <ul className="space-y-2">
                  {groupAddons.map((addon) => (
                    <li
                      key={addon.id}
                      className="flex min-w-0 items-center justify-between gap-2 border-b pb-2 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 break-words">{addon.name}</span>
                      <div className="shrink-0 flex items-center space-x-2">
                        <StockStatusBadge
                          status={addon.stock_status}
                          returnDate={addon.stock_return_date}
                        />
                        <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1 text-xs">
                          {stockOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleAddonStockChange(addon.id, opt.value)}
                              className={`rounded-full px-2.5 py-1 font-medium transition ${addon.stock_status === opt.value ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        {savedRows[addon.id] ? <span className="text-xs text-emerald-600">Saved</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
