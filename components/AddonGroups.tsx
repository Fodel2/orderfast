import { useState } from 'react';
import type { AddonGroup } from '../utils/types';

export default function AddonGroups({ addons }: { addons: AddonGroup[] }) {
  const [selectedQuantities, setSelectedQuantities] =
    useState<Record<string, Record<string, number>>>({});

  const updateQuantity = (
    groupId: string,
    optionId: string,
    delta: number,
    maxQty: number,
    groupMax?: number | null
  ) => {
    setSelectedQuantities(prev => {
      const group = prev[groupId] || {};
      const current = group[optionId] || 0;

      // Count how many distinct options in this group currently have a
      // quantity greater than zero.
      const distinctCount = Object.values(group).filter(q => q > 0).length;

      // Adding a brand new option should respect the group cap. Increasing the
      // quantity of an already-selected option should not count against the cap.
      const isNewSelection = current === 0 && delta > 0;
      if (groupMax != null && isNewSelection && distinctCount >= groupMax) {
        return prev;
      }

      const newQty = Math.min(Math.max(current + delta, 0), maxQty);
      if (newQty === current) return prev;

      return {
        ...prev,
        [groupId]: {
          ...group,
          [optionId]: newQty,
        },
      };
    });
  };

  return (
    <div className="space-y-6">
      {addons.map(group => (
        <div key={group.group_id ?? group.id} className="bg-white border rounded-xl p-4 shadow-sm">
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
              const gid = group.group_id ?? group.id;
              const quantity = selectedQuantities[gid]?.[option.id] || 0;
              const maxQty = group.max_option_quantity || 1;
              const groupMax = group.max_group_select;

              return (
                <div
                  key={option.id}
                  onClick={() => updateQuantity(gid, option.id, 1, maxQty, groupMax)}
                  className={`min-w-[160px] max-w-[180px] border rounded-lg p-3 flex-shrink-0 transition cursor-pointer text-center ${
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

                  {quantity > 0 && (
                    <div className="mt-3 flex justify-center items-center gap-2">
                      <button
                        type="button"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateQuantity(gid, option.id, -1, maxQty, groupMax);
                        }}
                        className="w-8 h-8 rounded-full border border-gray-300 hover:bg-gray-100"
                      >
                        –
                      </button>
                      <span className="w-6 text-center">{quantity}</span>
                      <button
                        type="button"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateQuantity(gid, option.id, 1, maxQty, groupMax);
                        }}
                        className="w-8 h-8 rounded-full border border-gray-300 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
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
