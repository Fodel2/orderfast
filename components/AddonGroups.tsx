import { useState } from 'react';
import type { AddonGroup } from '../utils/types';

export default function AddonGroups({ addons }: { addons: AddonGroup[] }) {
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, Record<string, number>>>({});

  const updateQuantity = (
    groupId: string,
    optionId: string,
    delta: number,
    max: number
  ) => {
    setSelectedQuantities(prev => {
      const group = prev[groupId] || {};
      const current = group[optionId] || 0;
      const updatedQty = Math.max(0, Math.min(current + delta, max));

      return {
        ...prev,
        [groupId]: {
          ...group,
          [optionId]: updatedQty,
        },
      };
    });
  };

  return (
    <div className="space-y-6">
      {addons.map(group => (
        <div key={group.id} className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">
              {group.name}
              {group.required && (
                <span className="text-red-500 text-sm ml-2">(Required)</span>
              )}
            </h3>
            <p className="text-sm text-gray-500">
              {group.multiple_choice
                ? group.max_group_select != null
                  ? `Pick up to ${group.max_group_select}`
                  : 'Multiple Choice'
                : 'Pick one'}
            </p>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
            {group.addon_options.map((option) => {
              const quantity = selectedQuantities[group.id]?.[option.id] || 0;
              const showQtyControls = !!group.max_option_quantity && group.max_option_quantity > 1;

              return (
                <div
                  key={option.id}
                  className={`min-w-[160px] max-w-[180px] border rounded-lg p-3 text-center flex-shrink-0 transition ${
                    quantity > 0
                      ? 'border-green-500 bg-green-50 shadow-sm'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  {option.image_url && (
                    <img
                      src={option.image_url}
                      alt={option.name}
                      className="w-full h-20 object-cover rounded mb-2"
                    />
                  )}

                  <div className="font-medium">{option.name}</div>
                  {option.price && option.price > 0 && (
                    <div className="text-sm text-gray-500">
                      +£{(option.price / 100).toFixed(2)}
                    </div>
                  )}

                  {showQtyControls ? (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <button
                        onClick={() =>
                          updateQuantity(
                            group.id,
                            option.id,
                            -1,
                            group.max_option_quantity!
                          )
                        }
                        className="w-8 h-8 rounded-full border border-gray-300 hover:bg-gray-100"
                      >
                        –
                      </button>
                      <div className="w-6 text-center">{quantity}</div>
                      <button
                        onClick={() =>
                          updateQuantity(
                            group.id,
                            option.id,
                            1,
                            group.max_option_quantity!
                          )
                        }
                        className="w-8 h-8 rounded-full border border-gray-300 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        updateQuantity(
                          group.id,
                          option.id,
                          quantity === 0 ? 1 : -1,
                          1
                        )
                      }
                      className={`mt-3 w-full text-sm py-1.5 rounded ${
                        quantity > 0
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {quantity > 0 ? 'Selected' : 'Select'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
