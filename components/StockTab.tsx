import { useState } from 'react';
import { Disclosure, Listbox } from '@headlessui/react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  CheckIcon,
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
  }[];
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

export default function StockTab({ categories, addons }: StockTabProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(categories.map((c) => c.id)));
  const [data, setData] = useState<typeof categories>(categories);

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
    itemId: string,
    status: 'in_stock' | 'scheduled' | 'out'
  ) => {
    const { supabase } = await import('../utils/supabaseClient');
    let returnDate: string | null = null;
    if (status === 'scheduled') {
      returnDate = tomorrowMidnight();
    }
    const { error } = await supabase
      .from('menu_items')
      .update({
        stock_status: status,
        stock_return_date: returnDate,
        stock_last_updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);
    if (error) console.error('Failed to update stock', error);
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
    updateStockStatus(itemId, newStatus);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
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
        <div className="shrink-0 flex items-center space-x-2">
          <button
            onClick={expandAll}
            className="p-2 rounded hover:bg-gray-200 flex items-center gap-1"
            aria-label="Expand all"
          >
            <ChevronDownIcon className="w-5 h-5" />
            <span>⬇ Expand All</span>
          </button>
          <button
            onClick={collapseAll}
            className="p-2 rounded hover:bg-gray-200 flex items-center gap-1"
            aria-label="Collapse all"
          >
            <ChevronUpIcon className="w-5 h-5" />
            <span>⬆ Collapse All</span>
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
                    className="w-full flex justify-between items-center px-4 py-3"
                    onClick={() => toggle(cat.id)}
                  >
                    <span className="font-semibold text-left">{cat.name}</span>
                    <ChevronUpIcon className={`w-5 h-5 transition-transform ${open ? '' : 'rotate-180'}`} />
                  </Disclosure.Button>
                  <Disclosure.Panel className="px-4 pb-4">
                    {cat.items.length === 0 ? (
                      <p className="text-sm text-gray-500">No items</p>
                    ) : (
                      <ul className="space-y-2">
                        {cat.items.map((item) => (
                          <li key={item.id} className="flex justify-between items-center border-b last:border-b-0 pb-1">
                            <span>{item.name}</span>
                            <div className="flex items-center space-x-2">
                              <StockStatusBadge status={item.stock_status} returnDate={item.stock_return_date} />
                              <Listbox
                                value={item.stock_status}
                                onChange={(val) =>
                                  handleStockChange(
                                    item.id,
                                    val as 'in_stock' | 'scheduled' | 'out'
                                  )
                                }
                              >
                                <div className="relative w-40 text-sm">
                                  <Listbox.Button className="relative w-full cursor-default rounded border bg-white py-1 pl-2 pr-8 text-left">
                                    <span className="block truncate">
                                      {stockOptions.find((o) => o.value === item.stock_status)?.label}
                                    </span>
                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                      <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                                    </span>
                                  </Listbox.Button>
                                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    {stockOptions.map((opt) => (
                                      <Listbox.Option
                                        key={opt.value}
                                        value={opt.value}
                                        className={({ active }) =>
                                          `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-900'}`
                                        }
                                      >
                                        {({ selected }) => (
                                          <>
                                            <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>{opt.label}</span>
                                            {selected ? (
                                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                                                <CheckIcon className="h-5 w-5" />
                                              </span>
                                            ) : null}
                                          </>
                                        )}
                                      </Listbox.Option>
                                    ))}
                                  </Listbox.Options>
                                </div>
                              </Listbox>
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
      {addons.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-2">Add-ons</h3>
          <ul className="space-y-2">
            {addons.map((addon) => (
              <li
                key={addon.id}
                className="flex justify-between items-center bg-white rounded-lg shadow px-4 py-2"
              >
                <span>{addon.name}</span>
                <StockStatusBadge
                  status={addon.stock_status}
                  returnDate={addon.stock_return_date}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

