import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  BuildingStorefrontIcon,
  ChevronDownIcon,
  MapPinIcon,
  ShoppingBagIcon,
  TruckIcon,
  XMarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import FullscreenAppLayout from '@/components/layouts/FullscreenAppLayout';
import ItemModal from '@/components/modals/ItemModal';
import ConfirmModal from '@/components/ConfirmModal';
import { supabase } from '@/lib/supabaseClient';
import { ITEM_ADDON_LINK_WITH_GROUPS_SELECT } from '@/lib/queries/addons';
import { calculateCartTotals, formatPrice } from '@/lib/orderDisplay';
import Toast from '@/components/Toast';

type OrderType = 'walk-in' | 'collection' | 'delivery';
type PaymentMethod = 'cash' | 'card';
type ReceiptChoice = 'print' | 'digital' | 'none';

type DeliveryDetails = {
  postcode: string;
  address1: string;
  address2: string;
};

type PosAddon = {
  option_id: string;
  name: string;
  price: number;
  quantity: number;
};

type PosLineItem = {
  lineId: string;
  item_id: string;
  name: string;
  price: number;
  quantity: number;
  addons?: PosAddon[];
  notes?: string;
  addonKey?: string;
};

type Category = {
  id: number;
  name: string;
  description: string | null;
  image_url?: string | null;
};

type Item = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_18_plus: boolean | null;
  stock_status: 'in_stock' | 'scheduled' | 'out' | null;
  available?: boolean | null;
  category_id?: number | null;
  addon_groups?: any[];
};

type ItemLink = { item_id: number; category_id: number };

const emptyDeliveryDetails: DeliveryDetails = {
  postcode: '',
  address1: '',
  address2: '',
};

const orderTypeLabel: Record<OrderType, string> = {
  'walk-in': 'Walk-in',
  collection: 'Collection',
  delivery: 'Delivery',
};

export default function PosHomePage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const storageKey = useMemo(
    () => (restaurantId ? `orderfast_pos_cart_${restaurantId}` : null),
    [restaurantId]
  );

  const [stage, setStage] = useState<'orderType' | 'deliveryDetails' | 'sell' | 'checkout' | 'paymentComplete'>(
    'orderType'
  );
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>(emptyDeliveryDetails);
  const [orderNote, setOrderNote] = useState('');
  const [cartItems, setCartItems] = useState<PosLineItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemLinks, setItemLinks] = useState<ItemLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeModalItem, setActiveModalItem] = useState<Item | null>(null);
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showOrderDrawer, setShowOrderDrawer] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
  const [receiptChoice, setReceiptChoice] = useState<ReceiptChoice | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      const savedOrderType = parsed?.orderType as OrderType | null;
      setOrderType(savedOrderType ?? null);
      setDeliveryDetails(parsed?.deliveryDetails ?? emptyDeliveryDetails);
      setOrderNote(parsed?.orderNote ?? '');
      setCartItems(Array.isArray(parsed?.cartItems) ? parsed.cartItems : []);
      if (savedOrderType) {
        if (savedOrderType === 'delivery' && !parsed?.deliveryDetails?.postcode) {
          setStage('deliveryDetails');
        } else {
          setStage('sell');
        }
      }
    } catch (error) {
      console.error('[pos] failed to restore cart', error);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    const payload = {
      orderType,
      deliveryDetails,
      orderNote,
      cartItems,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [cartItems, deliveryDetails, orderNote, orderType, storageKey]);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const categoriesPromise = supabase
          .from('menu_categories')
          .select('id,name,description,sort_order,image_url')
          .eq('restaurant_id', restaurantId)
          .is('archived_at', null)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true });

        const itemsPromise = supabase
          .from('menu_items')
          .select(
            'id,name,description,price,image_url,is_vegetarian,is_vegan,is_18_plus,stock_status,category_id,available'
          )
          .eq('restaurant_id', restaurantId)
          .is('archived_at', null)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true });

        const [catRes, itemRes] = await Promise.all([categoriesPromise, itemsPromise]);

        if (!active) return;

        if (catRes.error) console.error('[pos] failed to fetch categories', catRes.error);
        if (itemRes.error) console.error('[pos] failed to fetch items', itemRes.error);

        const liveItems = (itemRes.data || []).filter((it: any) => it?.available !== false);
        const liveItemIds = liveItems.map((row) => row.id);
        let linkRows: ItemLink[] = [];
        let addonRows: any[] = [];

        if (liveItemIds.length > 0) {
          const [{ data: links }, { data: addons }] = await Promise.all([
            supabase.from('menu_item_categories').select('item_id,category_id').in('item_id', liveItemIds),
            supabase
              .from('item_addon_links')
              .select(ITEM_ADDON_LINK_WITH_GROUPS_SELECT)
              .in('item_id', liveItemIds)
              .is('addon_groups.archived_at', null)
              .is('addon_groups.addon_options.archived_at', null),
          ]);

          if (!active) return;

          linkRows = (links || []) as ItemLink[];
          addonRows = addons || [];
        }

        const addonMap: Record<number, any[]> = {};
        const sortByOrder = (a: any, b: any) => {
          const aOrder = a?.sort_order ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b?.sort_order ?? Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
        };

        addonRows.forEach((row) => {
          if (!row?.item_id) return;
          const groups = Array.isArray(row?.addon_groups?.addon_options)
            ? [
                {
                  ...row.addon_groups,
                  addon_options: row.addon_groups.addon_options
                    .filter((opt: any) => opt?.archived_at == null && opt?.available !== false)
                    .sort(sortByOrder),
                },
              ]
            : row?.addon_groups
            ? [
                {
                  ...row.addon_groups,
                  addon_options: (row.addon_groups.addon_options || [])
                    .filter((opt: any) => opt?.archived_at == null && opt?.available !== false)
                    .sort(sortByOrder),
                },
              ]
            : [];
          addonMap[row.item_id] = [...(addonMap[row.item_id] || []), ...groups].sort(sortByOrder);
        });

        const itemsWithAddons = liveItems.map((item: any) => ({
          ...item,
          addon_groups: addonMap[item.id] || [],
        }));

        setCategories((catRes.data as Category[]) || []);
        setItems(itemsWithAddons as Item[]);
        setItemLinks(linkRows);
      } catch (error) {
        console.error('[pos] failed to load menu', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [restaurantId]);

  const categorizedItems = useMemo(() => {
    if (!categories.length) return [];
    return categories
      .map((category) => {
        const catItems = items.filter(
          (item) =>
            item.category_id === category.id ||
            itemLinks.some((link) => link.category_id === category.id && link.item_id === item.id)
        );
        return { ...category, items: catItems };
      })
      .filter((category) => category.items.length > 0);
  }, [categories, itemLinks, items]);

  useEffect(() => {
    if (!categorizedItems.length) {
      setActiveCategoryId(null);
      return;
    }
    if (!activeCategoryId || !categorizedItems.some((cat) => cat.id === activeCategoryId)) {
      setActiveCategoryId(categorizedItems[0].id);
    }
  }, [activeCategoryId, categorizedItems]);

  const visibleItems = useMemo(() => {
    if (!activeCategoryId) return items;
    return items.filter(
      (item) =>
        item.category_id === activeCategoryId ||
        itemLinks.some((link) => link.category_id === activeCategoryId && link.item_id === item.id)
    );
  }, [activeCategoryId, itemLinks, items]);

  const totals = useMemo(() => calculateCartTotals(cartItems), [cartItems]);

  const buildAddonKey = (addons?: PosAddon[]) => {
    if (!addons || addons.length === 0) return '';
    return addons
      .map((addon) => `${addon.option_id}:${addon.quantity}`)
      .sort()
      .join('|');
  };

  const addLineItem = useCallback(
    (item: Item, quantity: number, addons?: PosAddon[]) => {
      if (!restaurantId) return;
      const addonKey = buildAddonKey(addons);
      setCartItems((prev) => {
        const existing = prev.find(
          (line) => line.item_id === String(item.id) && (line.addonKey || '') === addonKey
        );
        if (existing) {
          return prev.map((line) =>
            line.lineId === existing.lineId
              ? { ...line, quantity: line.quantity + quantity }
              : line
          );
        }
        const lineId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        return [
          ...prev,
          {
            lineId,
            item_id: String(item.id),
            name: item.name,
            price: item.price,
            quantity,
            addons: addons && addons.length ? addons : undefined,
            addonKey,
          },
        ];
      });
    },
    [restaurantId]
  );

  const handleItemTap = (item: Item) => {
    if (!restaurantId) return;
    const groups = Array.isArray(item.addon_groups) ? item.addon_groups : [];
    if (groups.length > 0) {
      setActiveModalItem(item);
      return;
    }
    addLineItem(item, 1, []);
  };

  const updateLineQuantity = (lineId: string, newQty: number) => {
    setCartItems((prev) =>
      newQty <= 0
        ? prev.filter((line) => line.lineId !== lineId)
        : prev.map((line) => (line.lineId === lineId ? { ...line, quantity: newQty } : line))
    );
  };

  const removeLineItem = (lineId: string) => {
    setCartItems((prev) => prev.filter((line) => line.lineId !== lineId));
  };

  const clearOrder = () => {
    setCartItems([]);
    setOrderNote('');
    setExpandedLines({});
  };

  const resetOrderType = () => {
    clearOrder();
    setOrderType(null);
    setDeliveryDetails(emptyDeliveryDetails);
    setStage('orderType');
    if (storageKey && typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
  };

  const startNewOrder = () => {
    clearOrder();
    setOrderType(null);
    setDeliveryDetails(emptyDeliveryDetails);
    setStage('orderType');
    setPaymentMethod(null);
    setCashReceived('');
    setReceiptChoice(null);
    setReceiptNumber(null);
    setShowOrderDrawer(false);
    if (storageKey && typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
  };

  const handleSelectOrderType = (selection: OrderType) => {
    setOrderType(selection);
    if (selection === 'delivery') {
      setStage('deliveryDetails');
      return;
    }
    setStage('sell');
  };

  const handleDeliveryContinue = () => {
    if (!deliveryDetails.postcode.trim()) return;
    setStage('sell');
  };

  const toggleLineDetails = (lineId: string) => {
    setExpandedLines((prev) => ({ ...prev, [lineId]: !prev[lineId] }));
  };

  const orderTypeSummary = orderType ? orderTypeLabel[orderType] : 'Order';

  const renderOrderSummary = (inline?: boolean) => (
    <div className={`flex h-full flex-col ${inline ? '' : ''}`}>
      <div className="flex items-start justify-between border-b border-gray-200 px-4 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Order</p>
          <p className="text-lg font-semibold text-gray-900">
            {orderTypeSummary}
            {orderType === 'delivery' && deliveryDetails.postcode
              ? ` · ${deliveryDetails.postcode}`
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowConfirmClear(true)}
          className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          New Order
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {cartItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-gray-500">
            <div className="rounded-full bg-gray-100 p-3">
              <ShoppingBagIcon className="h-6 w-6 text-gray-400" />
            </div>
            <p>Items added to this order will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cartItems.map((line) => {
              const addonTotal = (line.addons || []).reduce(
                (sum, addon) => sum + addon.price * addon.quantity * line.quantity,
                0
              );
              const lineTotal = line.price * line.quantity + addonTotal;
              const hasDetails = (line.addons && line.addons.length > 0) || line.notes;
              const isExpanded = expandedLines[line.lineId];
              return (
                <div key={line.lineId} className="rounded-2xl border border-gray-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => hasDetails && toggleLineDetails(line.lineId)}
                      className="flex flex-1 items-start gap-2 text-left"
                    >
                      <span className="mt-0.5 text-sm font-semibold text-gray-900">
                        {line.quantity}×
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold text-gray-900">{line.name}</span>
                        {hasDetails ? (
                          <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                            Details
                            <ChevronDownIcon
                              className={`h-4 w-4 transition ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatPrice(lineTotal)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeLineItem(line.lineId)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rose-600"
                        aria-label={`Remove ${line.name}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-full bg-gray-50 px-3 py-1">
                    <div className="flex items-center gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => updateLineQuantity(line.lineId, line.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold text-gray-600 hover:bg-white"
                        aria-label={`Decrease ${line.name}`}
                      >
                        –
                      </button>
                      <span className="min-w-[1.5rem] text-center text-sm font-semibold text-gray-900">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateLineQuantity(line.lineId, line.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold text-gray-600 hover:bg-white"
                        aria-label={`Increase ${line.name}`}
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-semibold text-gray-500">Line total</span>
                  </div>
                  {isExpanded ? (
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      {(line.addons || []).map((addon) => (
                        <div key={`${line.lineId}-${addon.option_id}`} className="flex justify-between gap-2">
                          <span>{addon.name} × {addon.quantity * line.quantity}</span>
                          <span>{formatPrice(addon.price * addon.quantity * line.quantity)}</span>
                        </div>
                      ))}
                      {line.notes ? <p className="italic text-gray-500">{line.notes}</p> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="border-t border-gray-200 px-4 py-4">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          Order note
        </label>
        <textarea
          value={orderNote}
          onChange={(event) => setOrderNote(event.target.value)}
          placeholder="Add a note for the kitchen"
          rows={2}
          className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
        />
        <div className="mt-4 space-y-2 text-sm text-gray-700">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-gray-900">{formatPrice(totals.total)}</span>
          </div>
          <div className="flex items-center justify-between text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatPrice(totals.total)}</span>
          </div>
        </div>
        {stage === 'sell' ? (
          <button
            type="button"
            onClick={() => setStage('checkout')}
            disabled={cartItems.length === 0}
            className="mt-4 w-full rounded-full bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
          >
            Checkout
          </button>
        ) : null}
      </div>
    </div>
  );

  const headerTitle =
    stage === 'checkout' || stage === 'paymentComplete' ? 'Checkout' : 'Sell Screen';

  const parsedCashReceived = Number.isNaN(Number(cashReceived)) ? 0 : Number(cashReceived);
  const cashDelta = parsedCashReceived - totals.total;
  const cashIsEnough = cashDelta >= 0;

  return (
    <FullscreenAppLayout>
      <div className="flex min-h-screen w-full flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-600">Till / POS</p>
            <h1 className="text-xl font-semibold text-gray-900">{headerTitle}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {stage === 'sell' ? (
              <button
                type="button"
                onClick={resetOrderType}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600"
              >
                Change order type
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              Exit to Dashboard
            </button>
          </div>
        </header>

        {stage === 'orderType' ? (
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
              <button
                type="button"
                onClick={() => handleSelectOrderType('walk-in')}
                className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm transition hover:border-gray-300"
              >
                <BuildingStorefrontIcon className="h-10 w-10 text-teal-600" />
                <div>
                  <p className="text-lg font-semibold text-gray-900">Walk-in</p>
                  <p className="text-sm text-gray-500">Immediate service</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleSelectOrderType('collection')}
                className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm transition hover:border-gray-300"
              >
                <ShoppingBagIcon className="h-10 w-10 text-teal-600" />
                <div>
                  <p className="text-lg font-semibold text-gray-900">Collection</p>
                  <p className="text-sm text-gray-500">Pickup order</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleSelectOrderType('delivery')}
                className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm transition hover:border-gray-300"
              >
                <TruckIcon className="h-10 w-10 text-teal-600" />
                <div>
                  <p className="text-lg font-semibold text-gray-900">Delivery</p>
                  <p className="text-sm text-gray-500">Send to address</p>
                </div>
              </button>
            </div>
          </div>
        ) : null}

        {stage === 'deliveryDetails' ? (
          <div className="flex flex-1 items-center justify-center px-6 py-10">
            <div className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <MapPinIcon className="h-6 w-6 text-teal-600" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Delivery details</h2>
                    <p className="text-sm text-gray-500">Capture postcode before starting.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetOrderType}
                  className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600"
                >
                  Change order type
                </button>
              </div>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Postcode</label>
                  <input
                    value={deliveryDetails.postcode}
                    onChange={(event) =>
                      setDeliveryDetails((prev) => ({ ...prev, postcode: event.target.value }))
                    }
                    placeholder="e.g. SW1A 1AA"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Address line 1</label>
                  <input
                    value={deliveryDetails.address1}
                    onChange={(event) =>
                      setDeliveryDetails((prev) => ({ ...prev, address1: event.target.value }))
                    }
                    placeholder="Optional"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Address line 2</label>
                  <input
                    value={deliveryDetails.address2}
                    onChange={(event) =>
                      setDeliveryDetails((prev) => ({ ...prev, address2: event.target.value }))
                    }
                    placeholder="Optional"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={handleDeliveryContinue}
                  disabled={!deliveryDetails.postcode.trim()}
                  className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
                >
                  Continue to Menu
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {stage === 'sell' ? (
          <div className="flex flex-1 overflow-hidden md:grid md:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-1 flex-col bg-white md:border-r md:border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Category</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {orderType ? orderTypeLabel[orderType] : 'Sell'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOrderDrawer(true)}
                  className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 md:hidden"
                >
                  View Order ({cartItems.reduce((sum, line) => sum + line.quantity, 0)})
                </button>
              </div>
              <div className="border-b border-gray-200 px-6 py-3">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {categorizedItems.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategoryId(category.id)}
                      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        category.id === activeCategoryId
                          ? 'border-teal-600 bg-teal-50 text-teal-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {loading ? (
                  <div className="text-sm text-gray-500">Loading menu…</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {visibleItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleItemTap(item)}
                        className="flex flex-col rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-gray-300"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                              {item.name}
                            </p>
                          </div>
                          <span className="whitespace-nowrap text-sm font-semibold text-gray-900">
                            {formatPrice(item.price)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <aside className="hidden min-w-[320px] max-w-[400px] shrink-0 flex-col bg-gray-50 md:flex md:w-[360px] md:overflow-y-auto">
              {renderOrderSummary(true)}
            </aside>
          </div>
        ) : null}

        {stage === 'checkout' ? (
          <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 px-6 py-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Order type</p>
                <p className="text-lg font-semibold text-gray-900">
                  {orderType ? orderTypeLabel[orderType] : 'Order'}
                </p>
                {orderType === 'delivery' ? (
                  <p className="mt-1 text-sm text-gray-500">
                    {deliveryDetails.postcode}
                    {deliveryDetails.address1 ? ` · ${deliveryDetails.address1}` : ''}
                    {deliveryDetails.address2 ? ` · ${deliveryDetails.address2}` : ''}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setStage('sell');
                  setPaymentMethod(null);
                  setCashReceived('');
                }}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                Back to Sell Screen
              </button>
            </div>

            <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Order summary</h2>
                <div className="mt-4 space-y-3">
                  {cartItems.map((line) => {
                    const addonTotal = (line.addons || []).reduce(
                      (sum, addon) => sum + addon.price * addon.quantity * line.quantity,
                      0
                    );
                    const lineTotal = line.price * line.quantity + addonTotal;
                    return (
                      <div key={line.lineId} className="border-b border-gray-100 pb-3 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {line.quantity}× {line.name}
                            </p>
                            {(line.addons || []).map((addon) => (
                              <p
                                key={`${line.lineId}-${addon.option_id}`}
                                className="ml-4 mt-1 text-xs text-gray-500"
                              >
                                + {addon.name} × {addon.quantity * line.quantity}
                              </p>
                            ))}
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{formatPrice(lineTotal)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 space-y-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-gray-900">{formatPrice(totals.total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-semibold text-gray-900">
                    <span>Total</span>
                    <span>{formatPrice(totals.total)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Payment method</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`rounded-2xl border px-4 py-5 text-center text-sm font-semibold transition ${
                      paymentMethod === 'cash'
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`rounded-2xl border px-4 py-5 text-center text-sm font-semibold transition ${
                      paymentMethod === 'card'
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Card
                  </button>
                </div>

                {paymentMethod === 'card' ? (
                  <div className="mt-6 space-y-4">
                    <p className="text-sm text-gray-600">Use external card reader to take payment.</p>
                    <button
                      type="button"
                      onClick={() => {
                        const generated = `${Math.floor(1000 + Math.random() * 9000)}`;
                        setReceiptNumber(generated);
                        setReceiptChoice(null);
                        setStage('paymentComplete');
                      }}
                      className="w-full rounded-full bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
                    >
                      Confirm Payment
                    </button>
                  </div>
                ) : null}

                {paymentMethod === 'cash' ? (
                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Cash received</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={cashReceived}
                        onChange={(event) => setCashReceived(event.target.value)}
                        placeholder="0.00"
                        className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
                      />
                    </div>
                    <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                      {cashIsEnough ? (
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">Change due</span>
                          <span className="font-semibold text-gray-900">{formatPrice(cashDelta)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-700">Remaining</span>
                          <span className="font-semibold text-rose-600">
                            {formatPrice(Math.abs(cashDelta))}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const generated = `${Math.floor(1000 + Math.random() * 9000)}`;
                        setReceiptNumber(generated);
                        setReceiptChoice(null);
                        setStage('paymentComplete');
                      }}
                      disabled={!cashIsEnough}
                      className="w-full rounded-full bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
                    >
                      Confirm Payment
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {stage === 'paymentComplete' ? (
          <div className="flex flex-1 flex-col items-center justify-center bg-gray-50 px-6 py-12">
            <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-600">Payment</p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900">Payment complete</h2>
              {receiptNumber ? (
                <p className="mt-2 text-sm text-gray-500">Order #{receiptNumber} (temporary)</p>
              ) : null}

              <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-left">
                <div className="text-sm font-semibold text-gray-900">Receipt?</div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(['print', 'digital', 'none'] as ReceiptChoice[]).map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => {
                        setReceiptChoice(choice);
                        if (choice === 'print') {
                          setToastMessage('Printing not configured yet.');
                        }
                        if (choice === 'digital') {
                          setToastMessage('Digital receipts coming soon.');
                        }
                      }}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                        receiptChoice === choice
                          ? 'border-teal-600 bg-teal-50 text-teal-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {choice === 'print' ? 'Print' : choice === 'digital' ? 'Digital' : 'None'}
                    </button>
                  ))}
                </div>
              </div>

              {receiptChoice ? (
                <button
                  type="button"
                  onClick={startNewOrder}
                  className="mt-6 w-full rounded-full bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
                >
                  Start new order
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {activeModalItem ? (
        <ItemModal
          item={{ ...activeModalItem, __onClose: () => setActiveModalItem(null) }}
          restaurantId={String(restaurantId ?? '')}
          onAddToCart={(item, qty, addons) => {
            addLineItem(activeModalItem, qty, addons as PosAddon[]);
            setActiveModalItem(null);
          }}
        />
      ) : null}

      {showOrderDrawer ? (
        <div className="fixed inset-0 z-[60] flex md:hidden">
          <div className="flex h-full w-full flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
              <p className="text-sm font-semibold text-gray-900">Order summary</p>
              <button
                type="button"
                onClick={() => setShowOrderDrawer(false)}
                className="rounded-full border border-gray-200 p-2 text-gray-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            {renderOrderSummary(true)}
          </div>
        </div>
      ) : null}

      <Toast message={toastMessage} onClose={() => setToastMessage('')} />

      <ConfirmModal
        show={showConfirmClear}
        title="Start a new order?"
        message="This will clear the current items and note."
        onConfirm={() => {
          clearOrder();
          setShowConfirmClear(false);
        }}
        onCancel={() => setShowConfirmClear(false)}
      />
    </FullscreenAppLayout>
  );
}
