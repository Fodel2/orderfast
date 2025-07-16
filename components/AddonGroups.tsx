import { useState } from 'react';
import type { AddonGroup } from '../utils/types';

export default function AddonGroups({ addons }: { addons: AddonGroup[] }) {
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string[]>>({});

  const handleSelect = (groupId: string, optionId: string, multiple?: boolean | null) => {
    setSelectedAddons(prev => {
      const current = prev[groupId] || [];

      if (multiple) {
        return {
          ...prev,
          [groupId]: current.includes(optionId)
            ? current.filter(id => id !== optionId)
            : [...current, optionId],
        };
      }

      return { ...prev, [groupId]: [optionId] };
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
            {group.addon_options.map(option => {
              const isSelected = selectedAddons[group.id]?.includes(option.id) || false;

              return (
                <div
                  key={option.id}
                  onClick={() =>
                    handleSelect(group.id, option.id, group.multiple_choice)}
                  className={`min-w-[140px] max-w-[160px] cursor-pointer border rounded-lg p-3 text-center flex-shrink-0 transition ${
                    isSelected
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
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
