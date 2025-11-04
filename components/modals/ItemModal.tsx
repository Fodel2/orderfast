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
  const logoUrl = brand?.logoUrl || undefined;
  const focalXRaw = typeof item?.menu_header_focal_x === 'number' ? item.menu_header_focal_x : undefined;
  const focalYRaw = typeof item?.menu_header_focal_y === 'number' ? item.menu_header_focal_y : undefined;
  const focalX = Math.min(100, Math.max(0, Math.round((focalXRaw ?? 0.5) * 100)));
  const focalY = Math.min(100, Math.max(0, Math.round((focalYRaw ?? 0.5) * 100)));
  const showLogoFallback = !imageUrl && !!logoUrl;
  const showImageSection = Boolean(imageUrl || showLogoFallback);

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

    onAddToCart(rest, qty, addons);

    setQty(1);
    setSelections({});
    handleClose();
  };

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[9998] flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-sm transition duration-200 ease-out md:px-6 ${modalAnim ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-[min(640px,90vw)] transition-all duration-200 ease-out ${modalAnim ? 'scale-100' : 'scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={handleClose}
          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/70 text-slate-700 shadow-lg backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ ['--tw-ring-color' as any]: accent } as CSSProperties}
        >
          <span className="text-xl leading-none">×</span>
        </button>
        <div className="max-h-[90vh] overflow-hidden rounded-3xl bg-white text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.28)]">
          <div className="max-h-[90vh] overflow-y-auto">
            {showImageSection ? (
              <div
                className="relative w-full overflow-hidden bg-[var(--muted-bg,#f8f8f8)]"
                style={{ aspectRatio: '4 / 3', maxHeight: '50vh' }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={item?.name || ''}
                    className="h-full w-full object-cover"
                    style={{ objectPosition: `${focalX}% ${focalY}%` }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl!}
                    alt=""
                    className="h-full w-full object-contain opacity-35 mix-blend-multiply"
                  />
                )}
              </div>
            ) : null}
            <div className="space-y-6 px-6 py-6 text-sm text-slate-700 md:px-8 md:py-8 md:text-base">
              <div className="space-y-3 text-slate-900">
                <h2 className="text-xl font-semibold md:text-2xl">{item?.name}</h2>
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {badges.map((b) => (
                      <span
                        key={b}
                        className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium"
                        style={badgeStyles}
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                )}
                {item?.description ? (
                  <p className="text-sm text-slate-600 md:text-base">{item.description}</p>
                ) : null}
              </div>

              {loading ? (
                <p className="text-center text-slate-500">Loading add-ons…</p>
              ) : groups.length > 0 ? (
                <AddonGroups addons={groups} onChange={setSelections} />
              ) : null}
            </div>
            <div className="border-t border-slate-200/80 px-6 py-6 text-sm text-slate-700 md:px-8 md:py-8 md:text-base">
              <div className="flex flex-wrap items-center gap-4 md:gap-5">
                <span className="text-lg font-semibold text-slate-900 md:text-xl">{formattedPrice}</span>
                <div className="ml-auto flex items-center gap-3 rounded-full border border-slate-200/90 bg-slate-50/80 px-3 py-2 md:gap-4">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={decrement}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-slate-700 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{ ['--tw-ring-color' as any]: accent } as CSSProperties}
                  >
                    –
                  </button>
                  <span data-testid="qty" className="min-w-[2.5rem] text-center text-base font-semibold text-slate-900 md:text-lg">
                    {qty}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={increment}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-slate-700 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{ ['--tw-ring-color' as any]: accent } as CSSProperties}
                  >
                    +
                  </button>
                </div>
                <button
                  aria-label="Confirm Add to Plate"
                  onClick={handleFinalAdd}
                  className="btn-primary flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:flex-none md:px-8"
                  style={{ ['--tw-ring-color' as any]: accent || 'currentColor' } as CSSProperties}
                >
                  <PlateAdd size={20} />
                  Add to Plate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
