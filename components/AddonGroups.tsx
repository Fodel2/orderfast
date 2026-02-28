import { useState, useEffect, useRef } from "react";
import type { AddonGroup } from "../utils/types";
import { useBrand } from "@/components/branding/BrandProvider";
import { formatPrice } from "@/lib/orderDisplay";
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
        className="addon-scroll overflow-x-auto scroll-smooth snap-x snap-mandatory flex gap-3 px-2 pr-4 md:pr-6 pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
      <style>{`.addon-scroll::-webkit-scrollbar{display:none;}`}</style>
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
  const currencyCode = brand?.currencyCode;

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[customer:addons] AddonGroups received groups', {
        groupsCount: addons.length,
        optionCounts: addons.map((group) => ({
          groupId: group.group_id ?? group.id,
          options: Array.isArray(group.addon_options) ? group.addon_options.length : 0,
        })),
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
    <div className="space-y-4">
      {addons.map((group) => {

        const gid = group.group_id ?? group.id;
        const hasError = Boolean(errors[gid]);
        const multipleChoice =
          typeof group.multiple_choice === "string"
            ? group.multiple_choice === "true"
            : !!group.multiple_choice;
        const max_group_select =
          group?.max_group_select ?? (group as any)?.maxGroupSelect ?? Infinity;
        const max_option_quantity =
          group?.max_option_quantity ?? (group as any)?.maxOptionQuantity ?? Infinity;
        const options = Array.isArray(group.addon_options)
          ? group.addon_options
          : [];

        if (process.env.NODE_ENV === 'development') {
          console.debug('[customer:addons] rendering group', {
            groupId: gid,
            optionCount: options.length,
          });
        }

        return (
          <div
            key={gid}
            className={`rounded-2xl border bg-white/95 p-3.5 shadow-sm md:px-5 md:py-4 ${
              hasError ? 'border-rose-200' : 'border-slate-200/80'
            }`}
            aria-invalid={hasError || undefined}
          >
              <div className="mb-1.5 flex items-center justify-between">
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
                {options.map((option) => {
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

                  const formatDate = (value?: string | null) => {
                    if (!value) return undefined;
                    const d = new Date(value);
                    return Number.isNaN(d.getTime()) ? undefined : d.toLocaleDateString();
                  };

                  const isOutOfStock =
                    option.available === false ||
                    option.stock_status !== 'in_stock';
                  const handleTileClick = () => {
                    if (isOutOfStock) return;
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

                  const selectedStyle: CSSProperties =
                    quantity > 0
                      ? {
                          backgroundColor: accent ? `${accent}14` : undefined,
                          boxShadow: accent
                            ? `inset 0 0 0 2px ${accent}`
                            : undefined,
                          borderColor: 'transparent',
                        }
                      : {};

                  const disabled =
                    isOutOfStock ||
                    (multipleChoice && groupCapHit && quantity === 0) ||
                    maxQty === 0 ||
                    groupMax === 0;

                  const outOfStockLabel = (() => {
                    if (!isOutOfStock) return undefined;
                    if (option.stock_status === 'out') return 'Out of stock';
                    if (option.stock_status === 'scheduled') {
                      const scheduledDate = formatDate(option.stock_return_date);
                      return scheduledDate ? `Back ${scheduledDate}` : 'Back tomorrow';
                    }
                    const nextStockDate =
                      formatDate(option.out_of_stock_until) ||
                      formatDate(option.stock_return_date);
                    if (nextStockDate) return `Back ${nextStockDate}`;
                    return 'Unavailable';
                  })();

                  return (
                    <div
                      key={option.id}
                      onClick={handleTileClick}
                      data-selected={quantity > 0}
                      tabIndex={0}
                      className={`relative min-w-[148px] md:min-w-[164px] px-3 py-2.5 rounded-xl border bg-slate-50/80 border-slate-200 hover:bg-slate-100 flex-shrink-0 snap-start transition cursor-pointer text-center text-slate-900 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 data-[selected=true]:scale-[1.01] ${
                        disabled ? 'pointer-events-none opacity-50' : ''
                      }`}
                      style={{
                        ...selectedStyle,
                        ['--tw-ring-color' as any]: accent,
                      } as CSSProperties}
                    >
                      <div className="font-medium">{option.name}</div>
                      {Number(option.price) > 0 && (
                        <div className="text-sm text-gray-500">
                          +{formatPrice(option.price, currencyCode)}
                        </div>
                      )}

                      {outOfStockLabel && (
                        <div className="mt-2 text-xs font-medium text-rose-600">
                          {outOfStockLabel}
                        </div>
                      )}

                      {quantity > 0 && multipleChoice && (
                        <div className="mt-2.5 flex items-center justify-center gap-2">
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
                            className="h-8 w-8 rounded-full border border-gray-300 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
                              disabled ||
                              quantity >= maxQty ||
                              groupCapHit ||
                              maxQty === 0 ||
                              groupMax === 0
                            }
                            className="h-8 w-8 rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
            </div>
          );
        })}
      </div>
  );
}
