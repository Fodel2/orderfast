import { useState, useEffect, useRef } from "react";
import type { AddonGroup } from "../utils/types";
import { useBrand } from "@/components/branding/BrandProvider";
import type { ReactNode, CSSProperties } from "react";

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

function ScrollRow({ children }: { children: ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 2);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      {canLeft && (
        <div
          className="pointer-events-none absolute left-0 top-0 h-full w-6 md:w-8 z-[1]"
          style={{
            background:
              'linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))',
          }}
        />
      )}
      {canRight && (
        <div
          className="pointer-events-none absolute right-0 top-0 h-full w-6 md:w-8 z-[1]"
          style={{
            background:
              'linear-gradient(to left, rgba(255,255,255,1), rgba(255,255,255,0))',
          }}
        />
      )}
      <div
        ref={rowRef}
        className="overflow-x-auto scroll-smooth snap-x snap-mandatory flex gap-3 px-2 pr-4 md:pr-6 pb-1"
      >
        {children}
      </div>
    </div>
  );
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

  const errors = validateAddonSelections(addons, selectedQuantities);
  const brand = useBrand?.();
  const accent =
    typeof brand?.brand === 'string' && brand.brand ? brand.brand : '#EB2BB9';

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


      // Block all interaction when either limit is zero
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

      // Prevent selection when the group cap would be exceeded
      if (delta > 0) {
        // Block adding a new option when at the cap
        if (distinctCount >= groupMax && current === 0) {
          return prev;
        }

        // Block any increase that would push total quantity past the cap
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
    <div className="space-y-6">
      {addons.map((group) => {

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
            className="bg-white border rounded-2xl p-4 shadow-sm"
          >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">
                  {group.name}
                  {group.required && (
                    <span
                      className="text-sm ml-2"
                      style={{ color: accent, opacity: 0.9 }}
                    >
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

              <ScrollRow>
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
                    if (multipleChoice && groupCapHit) return;
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
                      data-selected={quantity > 0}
                      tabIndex={0}
                      className={`min-w-[152px] md:min-w-[168px] px-4 py-3 rounded-xl border flex-shrink-0 snap-start transition cursor-pointer text-center text-slate-900 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[selected=true]:scale-[1.01] ${
                        quantity > 0
                          ? 'border-green-500'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      } ${
                        multipleChoice &&
                        ((groupCapHit && quantity === 0) || maxQty === 0)
                          ? 'pointer-events-none opacity-50'
                          : ''
                      }`}
                      style={{
                        backgroundColor: quantity > 0 ? `${accent}14` : undefined,
                        borderColor: quantity > 0 ? accent : undefined,
                        ['--tw-ring-color' as any]: accent,
                      } as CSSProperties}
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
                            className="w-8 h-8 rounded-full border border-gray-300 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                            style={{ ['--tw-ring-color' as any]: accent } as CSSProperties}
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
                              groupCapHit ||
                              maxQty === 0 ||
                              groupMax === 0
                            }
                            className="w-8 h-8 rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                            style={{ ['--tw-ring-color' as any]: accent } as CSSProperties}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </ScrollRow>
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
