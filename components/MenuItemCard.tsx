import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useCart } from '../context/CartContext';
import { useBrand } from '@/components/branding/BrandProvider';
import { formatPrice, normalizePriceValue } from '@/lib/orderDisplay';
import ItemModal from '@/components/modals/ItemModal';
import { toast } from '@/components/ui/toast';
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
  available?: boolean | null;
  out_of_stock?: boolean | null;
}

export default function MenuItemCard({
  item,
  restaurantId,
  restaurantLogoUrl,
  mode,
  onInteraction,
  currencyCode,
}: {
  item: MenuItem;
  restaurantId?: string | number;
  restaurantLogoUrl?: string | null;
  mode?: 'customer' | 'kiosk';
  onInteraction?: () => void;
  currencyCode?: string | null;
}) {
  const [showModal, setShowModal] = useState(false);
  const { addToCart } = useCart();
  const brand = useBrand?.();
  const accent =
    typeof brand?.brand === 'string' && brand.brand ? brand.brand : undefined;
  const resolvedCurrencyCode = currencyCode ?? brand?.currencyCode;
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
  const explicitLogo = useMemo(
    () => normalizeSource(restaurantLogoUrl ?? null),
    [restaurantLogoUrl]
  );
  const restaurantLogo = useMemo(() => {
    if (explicitLogo) return explicitLogo;
    return normalizeSource(brand?.logoUrl ?? null);
  }, [explicitLogo, brand?.logoUrl]);
  const placeholder = useMemo(
    () => getItemPlaceholder(restaurantLogo),
    [restaurantLogo]
  );
  const [placeholderSrc, setPlaceholderSrc] = useState(placeholder.src);
  const restaurantKey = restaurantId != null ? String(restaurantId) : undefined;

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
  const normalizedPrice = normalizePriceValue(price);
  const formattedPrice = formatPrice(normalizedPrice, resolvedCurrencyCode);
  const badges = useMemo(() => {
    const list: string[] = [];
    if (item?.is_vegan) list.push('Vegan');
    else if (item?.is_vegetarian) list.push('Vegetarian');
    if (item?.is_18_plus) list.push('18+');
    return list;
  }, [item?.is_18_plus, item?.is_vegan, item?.is_vegetarian]);

  const addonGroups = useMemo(() => {
    if (!item || typeof item !== 'object') return undefined;
    if (!('addon_groups' in item)) return undefined;
    return (item as { addon_groups?: any[] }).addon_groups;
  }, [item]);

  const hasRequiredAddons = useMemo(() => {
    if (!Array.isArray(addonGroups)) return false;
    return addonGroups.some((group) => group?.required);
  }, [addonGroups]);

  const isOutOfStock =
    (!!item?.stock_status && item.stock_status !== 'in_stock') ||
    item?.available === false ||
    item?.out_of_stock === true;

  const handleClick = () => {
    onInteraction?.();
    if (!restaurantKey) return;
    setShowModal(true);
  };

  const handleAddToCart = (modalItem: any, quantity: number, addons: any[]) => {
    onInteraction?.();
    if (isOutOfStock) {
      toast.error('This item is out of stock.');
      return;
    }

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
  const cardAccent = accent || 'var(--kiosk-accent,#111827)';

  useEffect(() => {
    if (imageUrl) return;
    setPlaceholderSrc(placeholder.src);
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

  const placeholderStyle = useMemo(
    () => (placeholder.style ? ({ ...placeholder.style } as CSSProperties) : undefined),
    [placeholder.style]
  );

  const triggerFlyToCart = (event: MouseEvent<HTMLElement>) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const selectors = window.matchMedia('(max-width: 768px)').matches
      ? ['[data-cart-anchor="fab"]', '[data-cart-anchor="desktop"]']
      : ['[data-cart-anchor="desktop"]', '[data-cart-anchor="fab"]'];

    const anchor = selectors
      .map((selector) => document.querySelector(selector) as HTMLElement | null)
      .find((el) => Boolean(el));

    if (!anchor) return;

    const startRect = event.currentTarget.getBoundingClientRect();
    const targetRect = anchor.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'kiosk-fly-dot';
    fly.style.left = `${startRect.left + startRect.width / 2}px`;
    fly.style.top = `${startRect.top + startRect.height / 2}px`;
    fly.style.background = cardAccent;
    document.body.appendChild(fly);

    const animation = fly.animate(
      [
        {
          transform: 'translate(-50%, -50%) scale(1)',
          opacity: 0.95,
        },
        {
          transform: `translate(${targetRect.left + targetRect.width / 2 - (startRect.left + startRect.width / 2)}px, ${
            targetRect.top + targetRect.height / 2 - (startRect.top + startRect.height / 2)
          }px) scale(0.3)`,
          opacity: 0.65,
        },
      ],
      {
        duration: 650,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        fill: 'forwards',
      }
    );

    animation.onfinish = () => fly.remove();
    animation.oncancel = () => fly.remove();

    anchor.classList.add('cart-pulse');
    anchor.addEventListener(
      'animationend',
      () => {
        anchor.classList.remove('cart-pulse');
      },
      { once: true }
    );
  };

  const handleQuickAdd = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onInteraction?.();
    if (isOutOfStock) {
      toast.error('This item is out of stock.');
      return;
    }
    if (!restaurantKey) {
      console.warn('[menu-item-card] missing restaurant id for quick add', { itemId: item?.id });
      return;
    }

    if (hasRequiredAddons) {
      setShowModal(true);
      return;
    }

    addToCart(String(restaurantKey), {
      item_id: String(item.id),
      name: item.name,
      price,
      quantity: 1,
      addons: undefined,
      notes: undefined,
    });

    triggerFlyToCart(event);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <>
      <div className="relative h-full min-w-0 max-w-full">
        <div
          role="button"
          aria-disabled={isOutOfStock}
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={handleCardKeyDown}
          className={`group relative flex h-full max-w-full flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.06)] transition duration-150 ease-out ${
            isKiosk && !isOutOfStock ? 'hover:-translate-y-1 active:scale-[0.98]' : ''
          } ${isOutOfStock ? 'opacity-60' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
          style={{ ['--tw-ring-color' as any]: cardAccent } as CSSProperties}
        >
          <div className="relative w-full overflow-hidden bg-[var(--muted-bg,#f5f5f5)]">
            <div className="relative h-[200px] sm:h-[180px] lg:h-[240px] w-full overflow-hidden">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={item.name}
                  className={`h-full w-full object-cover transition duration-200 ${isOutOfStock ? 'grayscale' : 'group-hover:scale-[1.02]'}`}
                />
              ) : (
                <img
                  src={placeholderSrc}
                  alt=""
                  className="h-full w-full object-cover"
                  style={placeholderStyle}
                  onError={() => {
                    if (placeholderSrc !== FALLBACK_PLACEHOLDER_SRC) {
                      setPlaceholderSrc(FALLBACK_PLACEHOLDER_SRC);
                      return;
                    }
                  }}
                />
              )}
            </div>
              {isOutOfStock ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <span className="rounded-full bg-black/35 px-3 py-1 text-sm font-semibold text-white">Out of stock</span>
                </div>
              ) : null}

            <button
              type="button"
              disabled={isOutOfStock}
              className="absolute bottom-4 right-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--kiosk-accent,#111827)] text-white shadow-lg shadow-black/20 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Add ${item.name} to cart`}
              onClick={handleQuickAdd}
            >
              <span className="text-2xl leading-none">+</span>
            </button>
          </div>

          <div className="flex flex-1 flex-col">
            <div className="px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex min-w-0 w-full flex-1 flex-col gap-2">
                  <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
                    <h4 className="min-w-0 flex-1 line-clamp-2 text-lg font-semibold text-neutral-900 sm:text-xl">{item.name}</h4>
                    <span className="inline-flex flex-none items-center self-start whitespace-nowrap rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-semibold text-neutral-900 sm:px-3 sm:py-1 sm:text-sm">
                      {formattedPrice}
                    </span>
                  </div>
                  {item.description ? (
                    <div className="relative pr-4">
                      <p className="line-clamp-2 text-sm leading-snug text-slate-500">
                        {item.description}
                      </p>
                      <div
                        aria-hidden
                        className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white to-transparent"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {badges.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {badges.map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border"
                      style={badgeStyles}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {showModal && restaurantKey ? (
        <ItemModal item={itemForModal} restaurantId={restaurantKey} onAddToCart={handleAddToCart} isOutOfStock={isOutOfStock} />
      ) : null}

      <style jsx global>{`
        .kiosk-fly-dot {
          position: fixed;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          z-index: 9999;
          pointer-events: none;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        .cart-pulse {
          animation: cartPulse 320ms ease-out;
        }

        @keyframes cartPulse {
          0% {
            transform: scale(1);
          }
          40% {
            transform: scale(1.08);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}
