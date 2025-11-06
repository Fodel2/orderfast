import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useCart } from '../context/CartContext';
import { useBrand } from '@/components/branding/BrandProvider';
import { formatPrice } from '@/lib/orderDisplay';
import ItemModal from '@/components/modals/ItemModal';
import {
  FALLBACK_PLACEHOLDER_SRC,
  getItemPlaceholder,
  normalizeSource,
} from '@/lib/media/placeholders';

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

type RestaurantSummary = {
  id: string | number;
  logo_url?: string | null;
} | null;

export default function MenuItemCard({
  item,
  restaurantId,
  restaurant,
  mode,
}: {
  item: MenuItem;
  restaurantId?: string | number;
  restaurant?: RestaurantSummary;
  mode?: 'customer' | 'kiosk';
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
  const restaurantLogo = useMemo(() => {
    const direct = normalizeSource(restaurant?.logo_url ?? null);
    if (direct) return direct;
    return normalizeSource(brand?.logoUrl ?? null);
  }, [restaurant?.logo_url, brand?.logoUrl]);
  const placeholder = useMemo(
    () => getItemPlaceholder(restaurantLogo),
    [restaurantLogo]
  );
  const [placeholderSrc, setPlaceholderSrc] = useState(placeholder.src);
  const [placeholderLoaded, setPlaceholderLoaded] = useState(false);
  const resolvedRestaurantId = restaurantId ?? restaurant?.id;
  const restaurantKey = resolvedRestaurantId != null ? String(resolvedRestaurantId) : undefined;

  const price =
    typeof item?.price === 'number' ? item.price : Number(item?.price || 0);
  const imageUrl = useMemo(() => {
    const source = item?.image_url;
    if (typeof source === 'string') {
      const trimmed = source.trim();
      return trimmed.length ? trimmed : undefined;
    }
    return source ?? undefined;
  }, [item?.image_url]);
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
    if (!restaurantKey) return;
    setShowModal(true);
  };

  const handleAddToCart = (modalItem: any, quantity: number, addons: any[]) => {
    if (!restaurantKey) {
      console.warn('[menu-item-card] missing restaurant id for addToCart', {
        itemId: item?.id,
      });
      return;
    }
    const { notes, ...rest } = modalItem || {};
    const itemId = rest?.id ?? item.id;
    const itemName = rest?.name ?? item.name;
    const itemPrice = typeof rest?.price === 'number' ? rest.price : price;
    const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';

    addToCart(restaurantKey, {
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

  const isKiosk = mode === 'kiosk';
  const interactiveScale = isKiosk
    ? 'transform-gpu transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]'
    : '';

  useEffect(() => {
    if (imageUrl) return;
    setPlaceholderSrc(placeholder.src);
    setPlaceholderLoaded(false);
  }, [imageUrl, placeholder.src]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production') return;
    if (imageUrl) return;

    console.debug('[menu-item-card] placeholder sources', {
      itemId: item?.id ?? null,
      imageUrl: imageUrl ?? null,
      restaurantLogo: restaurantLogo ?? null,
      placeholderSrc: placeholder.src,
    });
  }, [imageUrl, restaurantLogo, placeholder.src, item?.id]);

  const placeholderStyle = useMemo(() => {
    const base = placeholder.style ?? {};
    const { opacity, ...rest } = base;
    const parsedOpacity =
      typeof opacity === 'number'
        ? opacity
        : typeof opacity === 'string'
          ? Number.parseFloat(opacity)
          : undefined;
    const finalOpacity =
      typeof parsedOpacity === 'number' && Number.isFinite(parsedOpacity)
        ? parsedOpacity
        : undefined;
    return {
      ...rest,
      opacity: placeholderLoaded ? finalOpacity ?? 1 : 0,
    } as CSSProperties;
  }, [placeholder.style, placeholderLoaded]);

  return (
    <>
      <div>
        <button
          type="button"
          className={`w-full rounded-xl bg-white/60 backdrop-blur-md shadow-sm p-3 sm:p-4 flex gap-3 sm:gap-4 hover:shadow-md transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${interactiveScale}`}
          onClick={handleClick}
          style={{ ['--tw-ring-color' as any]: accent || 'currentColor' } as CSSProperties}
        >
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--muted-bg,#f8f8f8)] sm:h-28 sm:w-28">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={placeholderSrc}
                alt=""
                className="h-full w-full object-cover transition-opacity duration-300"
                style={placeholderStyle}
                onLoad={() => setPlaceholderLoaded(true)}
                onError={() => {
                  if (placeholderSrc !== FALLBACK_PLACEHOLDER_SRC) {
                    setPlaceholderLoaded(false);
                    setPlaceholderSrc(FALLBACK_PLACEHOLDER_SRC);
                    return;
                  }
                  setPlaceholderLoaded(true);
                }}
              />
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
          </div>
        </button>
      </div>

      {showModal && restaurantKey ? (
        <ItemModal item={itemForModal} restaurantId={restaurantKey} onAddToCart={handleAddToCart} />
      ) : null}
    </>
  );
}

