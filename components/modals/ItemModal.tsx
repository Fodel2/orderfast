import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import AddonGroups, { validateAddonSelections } from '@/components/AddonGroups';
import PlateAdd from '@/components/icons/PlateAdd';
import { useBrand } from '@/components/branding/BrandProvider';
import { formatPrice } from '@/lib/orderDisplay';
import { getAddonsForItem } from '@/utils/getAddonsForItem';
import type { AddonGroup } from '@/utils/types';

function contrast(c?: string) {
  try {
    if (!c) return '#fff';
    const h = c.replace('#', '');
    const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
    const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
    const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 >= 145 ? '#000' : '#fff';
  } catch {
    return '#fff';
  }
}

type ItemModalProps = {
  item: any;
  restaurantId: string;
  onAddToCart: (item: any, qty: number, addons: any[]) => void;
};

export default function ItemModal({ item, restaurantId, onAddToCart }: ItemModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [selections, setSelections] = useState<Record<string, Record<string, number>>>({});
  const [modalAnim, setModalAnim] = useState(false);
  const [secText, setSecText] = useState('#fff');
  const [mix, setMix] = useState(false);
  const brand = useBrand?.();
  const accent = typeof brand?.brand === 'string' && brand.brand ? brand.brand : undefined;
  const sec = 'var(--brand-secondary, var(--brand-primary))';

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return undefined;
    setModalAnim(true);
    return () => {
      setModalAnim(false);
    };
  }, [mounted]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue('--brand-secondary')
        ?.trim();
      setSecText(contrast(v));
      setMix(
        !!(
          window.CSS &&
          CSS.supports &&
          CSS.supports('color', `color-mix(in oklab, ${sec} 50%, transparent)`)
        ),
      );
    }
  }, [sec]);

  useEffect(() => {
    if (!mounted) return undefined;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [mounted]);

  useEffect(() => {
    let isActive = true;
    const fetchAddons = async () => {
      if (!item?.id) {
        setGroups([]);
        return;
      }
      setLoading(true);
      try {
        const data = await getAddonsForItem(item.id);
        const sanitized = Array.isArray(data) ? data : [];
        if (!isActive) return;
        setGroups(sanitized);
        if (process.env.NODE_ENV === 'development') {
          console.debug('[customer:item-modal] fetched add-on groups', {
            itemId: item.id,
            groupsCount: sanitized.length,
            restaurantId,
          });
          if (!Array.isArray(data)) {
            console.warn('[customer:item-modal] unexpected add-on payload', {
              itemId: item.id,
              receivedType: typeof data,
              restaurantId,
            });
          }
        }
      } catch (err) {
        if (!isActive) return;
        console.error('Failed to load addons', { itemId: item?.id, restaurantId, err });
        setGroups([]);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchAddons();

    return () => {
      isActive = false;
    };
  }, [item?.id, restaurantId]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[customer:item-modal] rendering with add-on groups', {
        itemId: item?.id,
        groupsCount: groups.length,
        restaurantId,
      });
    }
  }, [groups, item?.id, restaurantId]);

  const currency = 'GBP';
  const price = typeof item?.price === 'number' ? item.price : Number(item?.price || 0);
  const formattedPrice = formatPrice(price / 100, currency);
  const imageUrl = item?.image_url || undefined;

  const badges = useMemo(() => {
    const result: string[] = [];
    if (item?.is_vegan) result.push('Vegan');
    else if (item?.is_vegetarian) result.push('Vegetarian');
    if (item?.is_18_plus) result.push('18+');
    return result;
  }, [item?.is_18_plus, item?.is_vegan, item?.is_vegetarian]);

  const badgeStyles: CSSProperties = mix
    ? {
        background: `color-mix(in oklab, ${sec} 18%, transparent)`,
        borderColor: `color-mix(in oklab, ${sec} 60%, transparent)`,
        color: secText,
      }
    : { background: `${sec}1A`, borderColor: sec, color: secText };

  const increment = () => setQty((q) => q + 1);
  const decrement = () => setQty((q) => (q > 1 ? q - 1 : 1));

  const handleClose = () => {
    const closeFn = typeof item?.__onClose === 'function' ? item.__onClose : undefined;
    closeFn?.();
  };

  const handleFinalAdd = () => {
    const errors = validateAddonSelections(groups, selections);
    if (Object.keys(errors).length) {
      alert('Please complete required add-ons');
      return;
    }

    const addons = groups
      .flatMap((g) => {
        const gid = g.group_id ?? g.id;
        const opts = selections[gid] || {};
        return g.addon_options
          .map((opt) => {
            const q = opts[opt.id] || 0;
            if (q > 0) {
              return {
                option_id: opt.id,
                name: opt.name,
                price: opt.price ?? 0,
                quantity: q,
              };
            }
            return null;
          })
          .filter(Boolean) as any;
      })
      .filter(Boolean);

    const { __onClose, ...rest } = item || {};
    const payload = {
      ...rest,
      notes: notes.trim() || undefined,
    };

    onAddToCart(payload, qty, addons);

    setQty(1);
    setNotes('');
    setSelections({});
    handleClose();
  };

  if (!mounted) {
    return null;
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed z-[9999] inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center w-full md:w-auto md:max-w-xl max-h-[92dvh] md:max-h-[88dvh] bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col transition-all duration-200 ease-out ${modalAnim ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
      >
        {imageUrl && (
          <div className="relative w-full overflow-hidden rounded-t-2xl">
            <img
              src={imageUrl}
              alt={item?.name || ''}
              className="w-full h-44 md:h-56 object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 flex flex-col items-start">
              <div className="w-full flex items-end justify-between">
                <div className="text-white drop-shadow-md text-lg md:text-xl font-semibold">
                  {item?.name}
                </div>
                {typeof price === 'number' && (
                  <div className="text-white/95 drop-shadow-md font-semibold">
                    {formattedPrice}
                  </div>
                )}
              </div>
              {badges.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {badges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border"
                    style={badgeStyles}
                  >
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <div
          className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 md:px-6 py-3"
          style={{ borderColor: accent ? `${accent}33` : undefined }}
        >
          <div className="flex items-center justify-between">
            {imageUrl ? (
              <span className="text-sm font-medium">{item?.name}</span>
            ) : (
              <h3 className="text-lg font-semibold">{item?.name}</h3>
            )}
            <div className="flex items-center gap-4">
              {!imageUrl && (
                <span className="text-sm font-medium">{formatPrice(price / 100, currency)}</span>
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={handleClose}
                className="p-2 rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ ['--tw-ring-color' as any]: accent } as CSSProperties}
              >
                ×
              </button>
            </div>
          </div>
          {!imageUrl && badges.length > 0 && (
            <div className="mt-2 flex gap-2">
              {badges.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border"
                  style={badgeStyles}
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-3 space-y-4">
          {loading ? (
            <p className="text-center text-gray-500">Loading...</p>
          ) : groups.length > 0 ? (
            <AddonGroups addons={groups} onChange={setSelections} />
          ) : null}
          <textarea
            className="w-full border rounded p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ ['--tw-ring-color' as any]: accent } as CSSProperties}
            placeholder="Add notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="sticky bottom-0 z-10 bg-white border-t px-4 md:px-6 py-3 pt-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center border rounded">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={decrement}
                className="w-8 h-8 flex items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ ['--tw-ring-color' as any]: accent } as CSSProperties}
              >
                -
              </button>
              <span data-testid="qty" className="w-6 text-center">
                {qty}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={increment}
                className="w-8 h-8 flex items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ ['--tw-ring-color' as any]: accent } as CSSProperties}
              >
                +
              </button>
            </div>
            <button
              aria-label="Confirm Add to Plate"
              onClick={handleFinalAdd}
              className="px-4 py-2 rounded hover:opacity-90 btn-primary flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition"
              style={{ ['--tw-ring-color' as any]: accent || 'currentColor' } as CSSProperties}
            >
              <PlateAdd size={18} />
              Add to Plate
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
