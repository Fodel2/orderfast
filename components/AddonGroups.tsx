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

    const effectiveGroupMax =
      group.max_group_select != null
        ? group.max_group_select
        : group.multiple_choice
        ? null
        : 1;

    const distinctSelected = quantities.filter((q) => q > 0).length;

    if (effectiveGroupMax != null && distinctSelected > effectiveGroupMax) {
      messages.push(`Select up to ${effectiveGroupMax}`);
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
    groupMax: number | null,
    multipleChoice: boolean
  ) => {
    setSelectedQuantities(prev => {
      const group = prev[groupId] || {};
      const current = group[optionId] || 0;

      const distinctCount = Object.values(group).filter(q => q > 0).length;

      console.log('updateQuantity', {
        groupId,
        optionId,
        delta,
        current,
        maxQty,
        groupMax,
        distinctCount,
        multipleChoice,
      });

      if (!multipleChoice) {
        const cleared: Record<string, number> = {};
        Object.keys(group).forEach((key) => (cleared[key] = 0));
        cleared[optionId] = 1;
        return { ...prev, [groupId]: cleared };
      }

      if (delta > 0 && current >= maxQty) {
        console.log('blocked: option quantity cap');
        return prev;
      }

      // Prevent selecting a new option when the group cap is hit. Allow
      // increasing the quantity of an already-selected option.
      if (
        groupMax != null &&
        delta > 0 &&
        distinctCount >= groupMax &&
        current === 0
      ) {
        console.log('blocked: group cap reached');
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
        console.log('render group', {
          id: group.group_id ?? group.id,
          multiple_choice: group.multiple_choice,
          max_option_quantity: group.max_option_quantity,
          max_group_select: group.max_group_select,
          required: group.required,
        }),
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
              const maxQty =
                group.max_option_quantity != null
                  ? group.max_option_quantity
                  : group.multiple_choice
                  ? Infinity
                  : 1;
              const groupMax =
                group.max_group_select != null
                  ? group.max_group_select
                  : group.multiple_choice
                  ? Infinity
                  : 1;
              const groupSelections = selectedQuantities[gid] || {};
              const distinctSelected = Object.values(groupSelections).filter(
                q => q > 0
              ).length;
              const groupCapHit =
                groupMax != null && distinctSelected >= groupMax;

              const handleTileClick = () => {
                if (quantity >= maxQty) {
                  console.log('blocked: option quantity cap');
                  return;
                }
                if (group.multiple_choice && groupCapHit && quantity === 0) {
                  console.log('blocked: group cap reached');
                  return;
                }
                updateQuantity(gid, option.id, 1, maxQty, groupMax, !!group.multiple_choice);
              };

              return (
                <div
                  key={option.id}
                  onClick={handleTileClick}
                  className={`min-w-[160px] max-w-[180px] border rounded-lg p-3 flex-shrink-0 transition cursor-pointer text-center ${
                    quantity > 0
                      ? 'border-green-500 bg-green-50 shadow-sm'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  } ${
                    group.multiple_choice &&
                    (quantity >= maxQty || (groupCapHit && quantity === 0))
                      ? 'pointer-events-none opacity-50'
                      : ''
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

                  {quantity > 0 && group.multiple_choice && (
                    <div className="mt-3 flex justify-center items-center gap-2">
                      <button
                        type="button"
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateQuantity(gid, option.id, -1, maxQty, groupMax, !!group.multiple_choice);
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
                          updateQuantity(gid, option.id, 1, maxQty, groupMax, !!group.multiple_choice);
                        }}
                        disabled={
                          quantity >= maxQty || (groupCapHit && quantity === 0)
                        }
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
