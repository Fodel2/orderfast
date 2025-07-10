import { useState } from 'react';
import { Disclosure } from '@headlessui/react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

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

  const expandAll = () => setExpanded(new Set(categories.map((c) => c.id)));
  const collapseAll = () => setExpanded(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleStockChange = (itemId: string, newStatus: 'in_stock' | 'scheduled' | 'out') => {
    // Placeholder for future implementation
    console.log('change stock', itemId, newStatus);
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
          <button onClick={expandAll} className="p-2 rounded hover:bg-gray-200" aria-label="Expand all">
            <ChevronDownIcon className="w-5 h-5" />
          </button>
          <button onClick={collapseAll} className="p-2 rounded hover:bg-gray-200" aria-label="Collapse all">
            <ChevronUpIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {categories.map((cat) => {
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
                              <select
                                value={item.stock_status}
                                onChange={(e) => handleStockChange(item.id, e.target.value as 'in_stock' | 'scheduled' | 'out')}
                                className="border rounded p-1 text-sm"
                              >
                                <option value="in_stock">In Stock</option>
                                <option value="scheduled">Back Tomorrow</option>
                                <option value="out">Off Indefinitely</option>
                              </select>
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

