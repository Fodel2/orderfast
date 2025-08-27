import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCart } from '../context/CartContext';
import { getAddonsForItem } from '../utils/getAddonsForItem';
import type { AddonGroup } from '../utils/types';
import AddonGroups, { validateAddonSelections } from './AddonGroups';
import PlateAdd from '@/components/icons/PlateAdd';
import { useBrand } from '@/components/branding/BrandProvider';

interface MenuItem {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  is_vegan?: boolean | null;
  is_vegetarian?: boolean | null;
  is_18_plus?: boolean | null;
  stock_status?: 'in_stock' | 'scheduled' | 'out' | null;
}


export default function MenuItemCard({
  item,
  restaurantId,
}: {
  item: MenuItem;
  restaurantId: string | number;
}) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [selections, setSelections] = useState<
    Record<string, Record<string, number>>
  >({});
  const { addToCart } = useCart();
  const brand = useBrand?.();
  const accent =
    typeof brand?.brand === 'string' && brand.brand ? brand.brand : undefined;
  const logo = brand?.logoUrl;
  const [mounted, setMounted] = useState(false);
  const [modalAnim, setModalAnim] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (showModal) {
      setModalAnim(true);
    } else {
      setModalAnim(false);
    }
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [showModal]);

  const price =
    typeof item?.price === 'number' ? item.price : Number(item?.price || 0);
  const imageUrl = item?.image_url || undefined;
  const badges: string[] = [];
  if (item?.is_vegan) badges.push('Vegan');
  if (item?.is_vegetarian) badges.push('Vegetarian');
  if (item?.is_18_plus) badges.push('18+');

  const loadAddons = async () => {
    setLoading(true);
    try {
      const data = await getAddonsForItem(item.id);
      setGroups(data);
      if (process.env.NODE_ENV === 'development') {
        console.debug('[addons]', {
          itemId: item.id,
          groupsCount: data?.length,
          groups: data,
        });
      }
    } catch (err) {
      console.error('Failed to load addons', err);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    setShowModal(true);
    loadAddons();
  };

  const increment = () => setQty((q) => q + 1);
  const decrement = () => setQty((q) => (q > 1 ? q - 1 : 1));

  const handleFinalAdd = () => {
    const errors = validateAddonSelections(groups, selections);
    if (Object.keys(errors).length) {
      alert('Please complete required add-ons');
      return;
    }

    const addons = groups.flatMap((g) => {
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
    });

    addToCart(String(restaurantId), {
      item_id: String(item.id),
      name: item.name,
      price: price,
      quantity: qty,
      notes: notes.trim() || undefined,
      addons: addons.length ? addons : undefined,
    });

    setQty(1);
    setNotes('');
    setSelections({});
    setShowModal(false);
  };

  const modalNode = (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
        onClick={() => setShowModal(false)}
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
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0.00))',
              }}
            />
            <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 flex flex-col items-start">
              <div className="w-full flex items-end justify-between">
                <div className="text-white drop-shadow-md text-lg md:text-xl font-semibold">
                  {item?.name}
                </div>
                {typeof price === 'number' && (
                  <div className="text-white/95 drop-shadow-md font-semibold">
                    {((price) / 100).toLocaleString(undefined, {
                      style: 'currency',
                      currency: 'GBP',
                    })}
                  </div>
                )}
              </div>
              {badges.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {badges.map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: accent
                          ? `${accent}1F`
                          : 'rgba(0,0,0,0.06)',
                        color: accent || 'inherit',
                      }}
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
              <span className="text-sm font-medium">{item.name}</span>
            ) : (
              <h3 className="text-lg font-semibold">{item.name}</h3>
            )}
            <div className="flex items-center gap-4">
              {!imageUrl && (
                <span className="text-sm font-medium">
                  ${(price / 100).toFixed(2)}
                </span>
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowModal(false)}
                className="p-2 rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ ['--tw-ring-color' as any]: accent } as React.CSSProperties}
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
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: accent
                      ? `${accent}1F`
                      : 'rgba(0,0,0,0.06)',
                    color: accent || 'inherit',
                  }}
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
          ) : groups.length === 0 ? (
            <p className="text-center text-gray-500">No add-ons available</p>
          ) : (
            <AddonGroups addons={groups} onChange={setSelections} />
          )}
          <textarea
            className="w-full border rounded p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ ['--tw-ring-color' as any]: accent } as React.CSSProperties}
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
                style={{ ['--tw-ring-color' as any]: accent } as React.CSSProperties}
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
                style={{ ['--tw-ring-color' as any]: accent } as React.CSSProperties}
              >
                +
              </button>
            </div>
            <button
              aria-label="Confirm Add to Plate"
              onClick={handleFinalAdd}
              className="px-4 py-2 rounded hover:opacity-90 btn-primary flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition"
              style={{ ['--tw-ring-color' as any]: accent || 'currentColor' } as React.CSSProperties}
            >
              <PlateAdd size={18} />
              Add to Plate
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div>
        <div
          className="rounded-xl bg-white/70 backdrop-blur-md shadow-sm p-3 sm:p-4 flex gap-3 sm:gap-4 hover:shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          style={{ ['--tw-ring-color' as any]: accent || 'currentColor' } as React.CSSProperties}
        >
          <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 overflow-hidden rounded-xl">
            {item?.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-white/50 backdrop-blur-md flex items-center justify-center">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" className="w-12 h-12 opacity-40 filter grayscale object-contain" />
                ) : null}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center min-w-0">
                <h4 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                  {item.name}
                </h4>
                {(item.is_vegan || item.is_vegetarian || item.is_18_plus) && (
                  <span className="ml-1 flex text-sm">
                    {item.is_vegan && (
                      <span role="img" aria-label="vegan">
                        🌱
                      </span>
                    )}
                    {item.is_vegetarian && (
                      <span role="img" aria-label="vegetarian">
                        🧀
                      </span>
                    )}
                    {item.is_18_plus && (
                      <span role="img" aria-label="18 plus">
                        🔞
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="price font-semibold text-gray-900 whitespace-nowrap text-sm sm:text-base">
                ${ (price / 100).toFixed(2) }
              </div>
            </div>
            {item.description && (
              <p className="text-sm text-gray-700 line-clamp-2 mt-0.5">{item.description}</p>
            )}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="btn-icon min-w-[40px] min-h-[40px] transition-transform duration-150 ease-out hover:scale-[1.05] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ ['--tw-ring-color' as any]: accent || 'currentColor' } as React.CSSProperties}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                aria-label={`Add ${item?.name} to plate`}
              >
                <PlateAdd size={22} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showModal && mounted ? createPortal(modalNode, document.body) : null}
    </>
  );
}

