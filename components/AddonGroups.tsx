import { useState } from "react";
import type { AddonGroup } from "../utils/types";

export function validateAddonSelections(
  addons: AddonGroup[],
  selections: Record<string, Record<string, number>>,
) {
  const errors: Record<string, string> = {};
  for (const group of addons) {
    const gid = group.group_id ?? group.id;
    const opts = selections[gid] || {};
    const quantities = Object.values(opts);

    const messages: string[] = [];

    if (group.required && quantities.every((q) => q <= 0)) {
      messages.push("Selection required");
    }

    const multipleChoice =
      typeof group.multiple_choice === "string"
        ? group.multiple_choice === "true"
        : !!group.multiple_choice;

    const rawGroupSelect =
      group?.max_group_select ?? (group as any)?.maxGroupSelect;
    const rawOptionQty =
      group?.max_option_quantity ?? (group as any)?.maxOptionQuantity;

    const effectiveGroupMax =
      rawGroupSelect != null ? rawGroupSelect : multipleChoice ? null : 1;

    const distinctSelected = quantities.filter((q) => q > 0).length;

    if (effectiveGroupMax != null && distinctSelected > effectiveGroupMax) {
      messages.push(`Select up to ${effectiveGroupMax}`);
    }

    if (rawOptionQty != null && quantities.some((q) => q > rawOptionQty)) {
      messages.push(`Max ${rawOptionQty} per option`);
    }

    if (messages.length) {
      errors[gid] = messages.join(". ");
    }
  }
  return errors;
}

export default function AddonGroups({ addons }: { addons: AddonGroup[] }) {
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, Record<string, number>>
  >({});

  const errors = validateAddonSelections(addons, selectedQuantities);

  const updateQuantity = (
    groupId: string,
    optionId: string,
    delta: number,
    maxQty: number,
    groupMax: number,
    multipleChoice: boolean,
  ) => {
    setSelectedQuantities((prev) => {
      const group = prev[groupId] || {};
      const current = group[optionId] || 0;

      const distinctCount = Object.values(group).filter((q) => q > 0).length;

      console.log("updateQuantity", {
        groupId,
        optionId,
        delta,
        current,
        maxQty,
        groupMax,
        distinctCount,
        multipleChoice,
      });

      // Block all interaction when either limit is zero
      if (maxQty === 0 || groupMax === 0) {
        console.log("blocked: selection disabled by limits");
        return prev;
      }

      if (!multipleChoice) {
        const cleared: Record<string, number> = {};
        Object.keys(group).forEach((key) => (cleared[key] = 0));
        cleared[optionId] = 1;
        return { ...prev, [groupId]: cleared };
      }

      if (delta > 0 && current >= maxQty) {
        console.log("blocked: option quantity cap");
        return prev;
      }

      // Prevent selecting a new option when the group cap is hit. Allow
      // increasing the quantity of an already-selected option.
      if (delta > 0 && distinctCount >= groupMax && current === 0) {
        console.log("blocked: group cap reached");
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
      {addons.map((group) => {
        console.log('[DEBUG] full group object:', group);
        console.log("render group", {
          id: group.group_id ?? group.id,
          multiple_choice: group.multiple_choice,
          max_option_quantity:
            (group as any).max_option_quantity ?? (group as any).maxOptionQuantity,
          max_group_select:
            (group as any).max_group_select ?? (group as any).maxGroupSelect,
          required: group.required,
        });

        const gid = group.group_id ?? group.id;
        const multipleChoice =
          typeof group.multiple_choice === "string"
            ? group.multiple_choice === "true"
            : !!group.multiple_choice;
        const max_group_select =
          group?.max_group_select ?? (group as any)?.maxGroupSelect ?? Infinity;
        const max_option_quantity =
          group?.max_option_quantity ?? (group as any)?.maxOptionQuantity ?? Infinity;

        return (
          <div
            key={gid}
            className="bg-white border rounded-xl p-4 shadow-sm"
          >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">
                  {group.name}
                  {group.required && (
                    <span className="text-red-500 text-sm ml-2">
                      (Required)
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-500">
                  {multipleChoice
                    ? max_group_select !== Infinity
                      ? `Pick up to ${max_group_select}`
                      : "Multiple Choice"
                    : "Pick one"}
                </p>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-1">
                {group.addon_options.map((option) => {
                  const gid = group.group_id ?? group.id;
                  const quantity = selectedQuantities[gid]?.[option.id] || 0;

                  const maxQty = multipleChoice
                    ? max_option_quantity > 0
                      ? max_option_quantity
                      : 0
                    : 1;

                  const groupMax = multipleChoice
                    ? max_group_select > 0
                      ? max_group_select
                      : Infinity
                    : 1;

                  const groupSelections = selectedQuantities[gid] || {};
                  const totalGroupQty = Object.values(groupSelections).reduce(
                    (sum, q) => sum + q,
                    0,
                  );
                  const groupCapHit = totalGroupQty >= groupMax;

                  const handleTileClick = () => {
                    if (maxQty === 0 || groupMax === 0) return;
                    if (quantity >= maxQty) return;
                    if (multipleChoice && groupCapHit && quantity === 0) return;
                    updateQuantity(
                      gid,
                      option.id,
                      1,
                      maxQty,
                      groupMax,
                      multipleChoice,
                    );
                  };

                  return (
                    <div
                      key={option.id}
                      onClick={handleTileClick}
                      className={`min-w-[160px] max-w-[180px] border rounded-lg p-3 flex-shrink-0 transition cursor-pointer text-center ${
                        quantity > 0
                          ? "border-green-500 bg-green-50 shadow-sm"
                          : "border-gray-300 bg-white hover:bg-gray-50"
                      } ${
                        multipleChoice &&
                        ((groupCapHit && quantity === 0) || maxQty === 0)
                          ? "pointer-events-none opacity-50"
                          : ""
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

                      {quantity > 0 && multipleChoice && (
                        <div className="mt-3 flex justify-center items-center gap-2">
                          <button
                            type="button"
                            onClick={(e: React.MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              updateQuantity(
                                gid,
                                option.id,
                                -1,
                                maxQty,
                                groupMax,
                                multipleChoice,
                              );
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
                              updateQuantity(
                                gid,
                                option.id,
                                1,
                                maxQty,
                                groupMax,
                                multipleChoice,
                              );
                            }}
                            disabled={
                              quantity >= maxQty ||
                              (groupCapHit && quantity === 0) ||
                              maxQty === 0 ||
                              groupMax === 0
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
          );
        })}
      </div>
  );
}
