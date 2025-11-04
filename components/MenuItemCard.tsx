import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Utensils } from 'lucide-react';

import { useCart } from '../context/CartContext';
import { useBrand } from '@/components/branding/BrandProvider';
import { formatPrice } from '@/lib/orderDisplay';
import ItemModal from '@/components/modals/ItemModal';

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
  variant,
}: {
  item: MenuItem;
  restaurantId: string | number;
  variant?: 'default' | 'kiosk';
}) {
  const [showModal, setShowModal] = useState(false);
  const { addToCart } = useCart();
  const brand = useBrand?.();
  const accent =
    typeof brand?.brand === 'string' && brand.brand ? brand.brand : undefined;
  const sec = 'var(--brand-secondary, var(--brand-primary))';
  const [secText, setSecText] = useState('#fff');
  const [mix, setMix] = useState(false);
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
        )
      );
    }
  }, []);
  const badgeStyles: CSSProperties = mix
    ? {
        background: `color-mix(in oklab, ${sec} 18%, transparent)`,
        borderColor: `color-mix(in oklab, ${sec} 60%, transparent)`,
        color: secText,
      }
    : { background: `${sec}1A`, borderColor: sec, color: secText };
  const logo = brand?.logoUrl || undefined;

  const price =
    typeof item?.price === 'number' ? item.price : Number(item?.price || 0);
  const imageUrl = item?.image_url || undefined;
  const currency = 'GBP';
  const formattedPrice = formatPrice(price / 100, currency);
  const badges = useMemo(() => {
    const list: string[] = [];
    if (item?.is_vegan) list.push('Vegan');
    else if (item?.is_vegetarian) list.push('Vegetarian');
    if (item?.is_18_plus) list.push('18+');
    return list;
  }, [item?.is_18_plus, item?.is_vegan, item?.is_vegetarian]);

  const handleClick = () => {
    setShowModal(true);
  };

  const handleAddToCart = (modalItem: any, quantity: number, addons: any[]) => {
    const { notes, ...rest } = modalItem || {};
    const itemId = rest?.id ?? item.id;
    const itemName = rest?.name ?? item.name;
    const itemPrice = typeof rest?.price === 'number' ? rest.price : price;
    const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';

    addToCart(String(restaurantId), {
      item_id: String(itemId),
      name: itemName,
      price: itemPrice,
      quantity,
      notes: trimmedNotes ? trimmedNotes : undefined,
      addons: Array.isArray(addons) && addons.length ? addons : undefined,
    });

    setShowModal(false);
  };

  const itemForModal = useMemo(
    () => ({
      ...item,
      __onClose: () => setShowModal(false),
    }),
    [item]
  );

  const isKiosk = variant === 'kiosk';
  const interactiveScale = isKiosk
    ? 'transform-gpu transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]'
    : '';

  return (
    <>
      <div>
        <div
          className={`rounded-xl bg-white/60 backdrop-blur-md shadow-sm p-3 sm:p-4 flex gap-3 sm:gap-4 hover:shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${interactiveScale}`}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          style={{ ['--tw-ring-color' as any]: accent || 'currentColor' } as CSSProperties}
        >
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--muted-bg,#f8f8f8)] sm:h-28 sm:w-28">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            ) : logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                className="h-full w-full object-contain opacity-30 mix-blend-multiply"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Utensils aria-hidden className="h-8 w-8 text-slate-400" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                {item.name}
              </h4>
              <div className="price font-semibold text-gray-900 whitespace-nowrap text-sm sm:text-base">
                {formattedPrice}
              </div>
            </div>
            {item.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">{item.description}</p>
            )}
            {badges.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
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
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="btn-icon min-h-[40px] min-w-[40px] text-sm font-semibold transition-transform duration-150 ease-out hover:scale-[1.05] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ ['--tw-ring-color' as any]: accent || 'currentColor' } as CSSProperties}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                aria-label={`Add ${item?.name} to plate`}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {showModal ? (
        <ItemModal
          item={itemForModal}
          restaurantId={String(restaurantId)}
          onAddToCart={handleAddToCart}
        />
      ) : null}
    </>
  );
}

