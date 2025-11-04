import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useBrand } from '@/components/branding/BrandProvider';
import { formatPrice } from '@/lib/orderDisplay';
import ItemModal from '@/components/modals/ItemModal';
import PlateIcon from '@/components/icons/PlateIcon';

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
  menu_header_focal_x?: number | null;
  menu_header_focal_y?: number | null;
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
  const price =
    typeof item?.price === 'number' ? item.price : Number(item?.price || 0);
  const imageUrl = item?.image_url || undefined;
  const showImage = Boolean(imageUrl);
  const focalXRaw =
    typeof item?.menu_header_focal_x === 'number'
      ? item.menu_header_focal_x
      : undefined;
  const focalYRaw =
    typeof item?.menu_header_focal_y === 'number'
      ? item.menu_header_focal_y
      : undefined;
  const focalX = Math.min(100, Math.max(0, Math.round((focalXRaw ?? 0.5) * 100)));
  const focalY = Math.min(100, Math.max(0, Math.round((focalYRaw ?? 0.5) * 100)));
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
        <button
          type="button"
          className={`group w-full overflow-hidden rounded-2xl bg-white/70 text-left shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 hover:shadow-md ${interactiveScale}`}
          onClick={handleClick}
          style={{ ['--tw-ring-color' as any]: accent || 'currentColor' } as CSSProperties}
        >
          <div className="flex h-full flex-col">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--muted-bg,#f4f4f5)]">
              {showImage ? (
                <img
                  src={imageUrl!}
                  alt={item.name}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: `${focalX}% ${focalY}%` }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <PlateIcon size={64} tone={accent} className="text-inherit" />
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2 px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-base font-semibold text-gray-900 sm:text-lg">
                  {item.name}
                </h4>
                <span className="text-sm font-semibold text-gray-900 sm:text-base">
                  {formattedPrice}
                </span>
              </div>

              {item.description ? (
                <p className="line-clamp-2 text-sm text-gray-600">
                  {item.description}
                </p>
              ) : null}

              {badges.length > 0 ? (
                <div className="mt-auto flex flex-wrap gap-1">
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
              ) : null}
            </div>
          </div>
        </button>
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

