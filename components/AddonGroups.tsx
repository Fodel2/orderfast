import { useState } from 'react';
import type { AddonGroup } from '../utils/types';

export function validateAddonSelections(
  addons: AddonGroup[],
  selections: Record<string, Record<string, number>>
) {
  const errors: Record<string, string> = {};
  for (const group of addons) {
    const gid = group.group_id ?? group.id;
    const opts = selections[gid] || {};
    const quantities = Object.values(opts);
    const totalSelected = quantities.reduce((sum, q) => sum + q, 0);

    const messages: string[] = [];

    if (group.required && quantities.every(q => q <= 0)) {
      messages.push('Selection required');
    }

    if (
      group.max_group_select != null &&
      totalSelected > group.max_group_select
    ) {
      messages.push(`Select up to ${group.max_group_select}`);
    }

    if (
      group.max_option_quantity != null &&
      quantities.some(q => q > group.max_option_quantity)
    ) {
      messages.push(`Max ${group.max_option_quantity} per option`);
    }

    if (messages.length) {
      errors[gid] = messages.join('. ');
    }
  }
  return errors;
}

export default function AddonGroups({ addons }: { addons: AddonGroup[] }) {
  const [selectedQuantities, setSelectedQuantities] =
    useState<Record<string, Record<string, number>>>({});

  const errors = validateAddonSelections(addons, selectedQuantities);

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

      // Total quantity currently selected in this group
      const totalCount = Object.values(group).reduce((sum, q) => sum + q, 0);

      // Prevent increasing quantities beyond the overall group cap
      if (groupMax != null && delta > 0 && totalCount >= groupMax) {
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
              // If max_option_quantity is null or undefined, treat it as unlimited
              // rather than defaulting to 1.
              const maxQty =
                group.max_option_quantity == null
                  ? Infinity
                  : group.max_option_quantity;
              const groupMax = group.max_group_select;
              const groupSelections = selectedQuantities[gid] || {};
              const totalSelected = Object.values(groupSelections).reduce(
                (sum, q) => sum + q,
                0
              );
              const groupCapHit = groupMax != null && totalSelected >= groupMax;

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
                        disabled={quantity >= maxQty || groupCapHit}
                        className="w-8 h-8 rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {errors[group.group_id ?? group.id] && (
            <p className="text-red-600 text-sm mt-2">
              {errors[group.group_id ?? group.id]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
