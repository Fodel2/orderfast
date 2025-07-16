import React from 'react';
import type { AddonGroup } from '../utils/types';

// Render Add-On Groups with basic UI styling
// Assumes props: addons = array of groups, each with options

// Example of expected `addons` structure (from view_addons_for_item):
// [
//   {
//     group_id: 'uuid',
//     group_name: 'Size',
//     required: true,
//     multiple_choice: false,
//     max_group_select: 1,
//     max_option_quantity: 1,
//     options: [
//       { id: 'uuid', name: 'Small', price: 0 },
//       { id: 'uuid', name: 'Large', price: 1.5 }
//     ]
//   },
//   ...
// ]

// Previously this component defined its own AddonGroup interface, but we now
// reuse the shared type from `utils/types` which exposes a slightly different
// shape (e.g. `id`/`name` and `addon_options`). To keep the UI the same we map
// those fields when rendering.

export default function AddonGroups({ addons }: { addons: AddonGroup[] }) {
  return (
    <div className="space-y-6">
      {addons.map((group) => (
        <div key={group.id} className="border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">
              {group.name}{' '}
              {group.required && (
                <span className="text-red-500 text-sm ml-2">(Required)</span>
              )}
            </h3>
            {group.multiple_choice !== undefined && (
              <p className="text-sm text-gray-500">
                {group.multiple_choice
                  ? `Pick up to ${group.max_group_select}`
                  : 'Pick one'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {group.addon_options.map((option) => (
              <div
                key={option.id}
                className="border px-4 py-2 rounded-full text-sm cursor-pointer bg-white hover:bg-gray-100 transition"
              >
                {option.name}{' '}
                {(option.price ?? 0) > 0 && (
                  <span className="text-gray-500">+£{(option.price! / 100).toFixed(2)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
