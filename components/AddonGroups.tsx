import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { AddonGroup } from "../utils/types";
import { useBrand } from "@/components/branding/BrandProvider";

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
      rawGroupSelect != null ? Number(rawGroupSelect) : multipleChoice ? null : 1;

    const distinctSelected = quantities.filter((q) => q > 0).length;

    if (
      effectiveGroupMax != null &&
      Number.isFinite(effectiveGroupMax) &&
      distinctSelected > effectiveGroupMax
    ) {
      messages.push(`Select up to ${effectiveGroupMax}`);
    }

    if (
      rawOptionQty != null &&
      Number.isFinite(Number(rawOptionQty)) &&
      quantities.some((q) => q > Number(rawOptionQty))
    ) {
      messages.push(`Max ${rawOptionQty} per option`);
    }

    if (messages.length) {
      errors[gid] = messages.join(". ");
    }
  }
  return errors;
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AddonGroups({
  addons,
  onChange,
  initialSelections,
}: {
  addons: AddonGroup[];
  onChange?: (sel: Record<string, Record<string, number>>) => void;
  initialSelections?: Record<string, Record<string, number>>;
}) {
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, Record<string, number>>
  >(initialSelections || {});

  const brand = useBrand?.();
  const accent =
    typeof brand?.brand === "string" && brand.brand ? brand.brand : "#EB2BB9";

  const errors = validateAddonSelections(addons, selectedQuantities);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[customer:addons] addonGroups length", addons.length);
      addons.forEach((group) => {
        console.log("[customer:addons] group", group?.name ?? "(unnamed)");
      });
    }
  }, [addons]);

  useEffect(() => {
    if (onChange) {
      onChange(selectedQuantities);
    }
  }, [selectedQuantities, onChange]);

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

      const quantities = Object.values(group);
      const distinctCount = quantities.filter((q) => q > 0).length;
      const totalCount = quantities.reduce((sum, q) => sum + q, 0);

      if (maxQty === 0 || groupMax === 0) {
        return prev;
      }

      if (!multipleChoice) {
        const cleared: Record<string, number> = {};
        Object.keys(group).forEach((key) => (cleared[key] = 0));
        cleared[optionId] = 1;
        return { ...prev, [groupId]: cleared };
      }

      if (delta > 0 && current >= maxQty) {
        return prev;
      }

      if (delta > 0) {
        if (distinctCount >= groupMax && current === 0) {
          return prev;
        }

        if (totalCount >= groupMax) {
          return prev;
        }
      }

      const newQty = Math.min(Math.max(current + delta, 0), maxQty);
      const proposedTotal = totalCount - current + newQty;
      if (proposedTotal > groupMax) {
        return prev;
      }
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
    <div className="space-y-4">
      {addons?.map((group) => {
        const groupId = group.group_id ?? group.id;
        const multipleChoice =
          typeof group.multiple_choice === "string"
            ? group.multiple_choice === "true"
            : !!group.multiple_choice;

        const rawGroupSelect =
          toNumber(group?.max_group_select ?? (group as any)?.maxGroupSelect) ??
          Infinity;
        const rawOptionQuantity =
          toNumber(group?.max_option_quantity ?? (group as any)?.maxOptionQuantity) ??
          Infinity;

        const groupMax = multipleChoice
          ? rawGroupSelect > 0
            ? rawGroupSelect
            : Infinity
          : 1;
        const optionMax = multipleChoice
          ? rawOptionQuantity > 0
            ? rawOptionQuantity
            : 0
          : 1;

        const options = Array.isArray(group.addon_options)
          ? group.addon_options
          : [];

        if (process.env.NODE_ENV === "development") {
          console.debug("[customer:addons] rendering group", {
            groupId,
            optionCount: options.length,
          });
        }

        const groupSelections = selectedQuantities[groupId] || {};
        const totalGroupQty = Object.values(groupSelections).reduce(
          (sum, q) => sum + q,
          0,
        );
        const distinctSelected = Object.values(groupSelections).filter(
          (q) => q > 0,
        ).length;

        return (
          <div key={groupId} className="space-y-2 rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">
                {group.name}
                {group.required ? (
                  <span className="ml-2 text-sm" style={{ color: accent }}>
                    (Required)
                  </span>
                ) : null}
              </h3>
              <span className="text-sm text-gray-500">
                {multipleChoice
                  ? Number.isFinite(groupMax)
                    ? `Pick up to ${groupMax}`
                    : "Choose any"
                  : "Pick one"}
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              {options.map((option) => {
                const quantity = groupSelections[option.id] || 0;
                const isSelected = quantity > 0;

                const isOutOfStock =
                  option.available === false ||
                  option.stock_status === "out" ||
                  option.stock_status === "out_of_stock";

                const disabled =
                  isOutOfStock || optionMax === 0 || groupMax === 0;

                const groupCapHit =
                  multipleChoice && Number.isFinite(groupMax)
                    ? totalGroupQty >= groupMax && quantity === 0
                    : false;

                const distinctCapHit =
                  multipleChoice && Number.isFinite(groupMax)
                    ? distinctSelected >= groupMax && quantity === 0
                    : false;

                const canIncrease = !(
                  disabled ||
                  (multipleChoice && optionMax !== Infinity && quantity >= optionMax) ||
                  groupCapHit ||
                  distinctCapHit
                );

                const handleSelect = () => {
                  if (!canIncrease) return;
                  updateQuantity(
                    groupId,
                    option.id,
                    1,
                    optionMax,
                    groupMax,
                    multipleChoice,
                  );
                };

                const handleDecrease = () => {
                  if (disabled || quantity <= 0) return;
                  updateQuantity(
                    groupId,
                    option.id,
                    -1,
                    optionMax,
                    groupMax,
                    multipleChoice,
                  );
                };

                const selectedStyle: CSSProperties = isSelected
                  ? {
                      backgroundColor: accent ? `${accent}14` : undefined,
                      borderColor: accent ? `${accent}40` : undefined,
                    }
                  : {};

                const formatDate = (value?: string | null) => {
                  if (!value) return undefined;
                  const d = new Date(value);
                  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleDateString();
                };

                const outOfStockLabel = (() => {
                  if (!isOutOfStock) return undefined;
                  if (option.stock_status === "out_of_stock") return "Out of stock";
                  if (option.stock_status === "out") return "Out of stock";
                  const nextStockDate =
                    formatDate(option.out_of_stock_until) ||
                    formatDate(option.stock_return_date);
                  if (nextStockDate) return `Back ${nextStockDate}`;
                  return "Unavailable";
                })();

                const priceLabel =
                  typeof option.price === "number" && option.price > 0
                    ? `+£${(option.price / 100).toFixed(2)}`
                    : null;

                return (
                  <div key={option.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelect}
                      disabled={disabled || !canIncrease}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                      }`}
                      style={{
                        ...selectedStyle,
                        ["--tw-ring-color" as any]: accent,
                      }}
                    >
                      <span className="block text-left">
                        <span>{option.name}</span>
                        {priceLabel ? (
                          <span className="ml-2 text-xs text-gray-500">{priceLabel}</span>
                        ) : null}
                      </span>
                    </button>
                    {multipleChoice ? (
                      <div className="flex items-center gap-1 text-sm">
                        <button
                          type="button"
                          onClick={handleDecrease}
                          disabled={disabled || quantity <= 0}
                          className="h-8 w-8 rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          style={{
                            ["--tw-ring-color" as any]: accent,
                          }}
                          aria-label={`Decrease ${option.name}`}
                        >
                          –
                        </button>
                        <span className="w-5 text-center">{quantity}</span>
                        <button
                          type="button"
                          onClick={handleSelect}
                          disabled={disabled || !canIncrease}
                          className="h-8 w-8 rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          style={{
                            ["--tw-ring-color" as any]: accent,
                          }}
                          aria-label={`Increase ${option.name}`}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-600">
                        {isSelected ? "Selected" : ""}
                      </span>
                    )}
                    {outOfStockLabel ? (
                      <span className="text-xs font-medium text-rose-600">
                        {outOfStockLabel}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {errors[groupId] && (
              <p className="text-sm text-red-600">{errors[groupId]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
