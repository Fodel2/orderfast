import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  WifiIcon,
} from '@heroicons/react/24/outline';
import { ChefHat } from 'lucide-react';
import FullscreenAppLayout from '@/components/layouts/FullscreenAppLayout';
import Toast from '@/components/Toast';
import BreakModal from '@/components/BreakModal';
import BreakCountdown from '@/components/BreakCountdown';
import OrderRejectButton from '@/components/OrderRejectButton';
import RejectOrderModal, { RejectableOrder } from '@/components/RejectOrderModal';
import { orderAlertSoundController } from '@/utils/orderAlertSoundController';
import { getRandomOrderEmptyMessage } from '@/lib/orderEmptyState';
import { formatShortOrderNumber } from '@/lib/orderDisplay';
import { supabase } from '@/lib/supabaseClient';
import { useRestaurantAvailability } from '@/hooks/useRestaurantAvailability';


type OrderAddon = {
  id: number;
  option_id: number;
  name: string;
  quantity: number;
  price?: number | null;
};

type OrderItem = {
  id: number;
  item_id: number;
  name: string;
  quantity: number;
  price?: number | null;
  notes?: string | null;
  order_addons: OrderAddon[];
};

type Order = RejectableOrder & {
  short_order_number: number | null;
  order_type: string;
  source?: string | null;
  created_at: string;
  customer_notes?: string | null;
  total_price?: number | null;
  kod_done_at?: string | null;
  kod_done_by_user_id?: string | null;
  order_items: OrderItem[];
};

type StockRow = {
  id: number;
  group_id?: number | null;
  name: string;
  stock_status: string | null;
  stock_return_date: string | null;
  out_of_stock_until: string | null;
  stock_last_updated_at: string | null;
  restaurant_id?: string | number | null;
};

type AddonGroup = {
  id: number;
  name: string;
};

type OrderSegment = {
  order: Order;
  segmentIndex: number;
  totalSegments: number;
  notesLines: string[];
  items: OrderItem[];
};

const NOTE_LINE_LENGTH = 38;
const CARD_VERTICAL_PADDING = 32;
const HEADER_RESERVED_PX = 80;
const FOOTER_RESERVED_PX = 64;
const BODY_LINE_HEIGHT = 22;
const TOP_CONTROLS_HEIGHT = 64;
const CARD_WIDTH_BASE = 360;
const CARD_GAP = 16;
const NOTES_HEADER_LINES = 2;
const ITEM_SPACER_LINES = 1;
const ACTIVE_STATUSES = ['pending', 'accepted', 'preparing', 'delivering', 'ready_to_collect'];
const TERMINAL_STATUSES = ['completed', 'cancelled'];
const STOCK_STATUS_LABELS: Record<string, string> = {
  in_stock: 'In Stock',
  back_tomorrow: 'Back Tomorrow',
  off_indefinitely: 'Off Indefinitely',
  scheduled: 'Back Tomorrow',
  out: 'Off Indefinitely',
  out_of_stock: 'Off Indefinitely',
};

const normalizeStockStatus = (status: string | null | undefined) => {
  if (status === 'back_tomorrow' || status === 'scheduled') return 'back_tomorrow';
  if (status === 'off_indefinitely' || status === 'out' || status === 'out_of_stock') {
    return 'off_indefinitely';
  }
  return 'in_stock';
};

const formatGBP = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  );

const getOrderTotalPrice = (order: Order) => {
  if (typeof order.total_price === 'number' && Number.isFinite(order.total_price)) {
    return order.total_price;
  }
  return (order.order_items || []).reduce((sum, item) => {
    const itemPrice = Number((item as any).price || 0);
    const itemTotal = itemPrice * Number(item.quantity || 0);
    const addonsTotal = (item.order_addons || []).reduce((addonSum, addon) => {
      const addonPrice = Number((addon as any).price || 0);
      return addonSum + addonPrice * Number(addon.quantity || 0);
    }, 0);
    return sum + itemTotal + addonsTotal;
  }, 0);
};

const splitNotesLines = (notes: string, lineLength: number) => {
  if (!notes) return [];
  const lines = notes
    .split('\n')
    .flatMap((line) => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) return [''];
      const chunks: string[] = [];
      let current = '';
      words.forEach((word) => {
        if (!current) {
          current = word;
          return;
        }
        if ((current + ` ${word}`).length > lineLength) {
          chunks.push(current);
          current = word;
        } else {
          current = `${current} ${word}`;
        }
      });
      if (current) chunks.push(current);
      return chunks;
    })
    .filter((line) => line.length > 0);

  return lines.length ? lines : [''];
};

const formatOrderNumber = (order: Order) =>
  formatShortOrderNumber(order.short_order_number);

const getItemLineCount = (
  item: OrderItem,
  includeSpacer: boolean,
  lineLength: number
) => {
  const addonCount = item.order_addons?.length ?? 0;
  const notesLines = item.notes ? splitNotesLines(item.notes, lineLength).length : 0;
  return 1 + addonCount + notesLines + (includeSpacer ? ITEM_SPACER_LINES : 0);
};

const buildOrderSegments = (
  order: Order,
  maxBodyLines: number,
  lineLength: number
): OrderSegment[] => {
  const remainingNotes = splitNotesLines(order.customer_notes ?? '', lineLength).slice();
  const remainingItems = (order.order_items ?? []).slice();
  const segments: Omit<OrderSegment, 'segmentIndex' | 'totalSegments'>[] = [];
  const safeBodyLines = Math.max(NOTES_HEADER_LINES + 1, maxBodyLines);

  while (remainingNotes.length > 0 || remainingItems.length > 0) {
    const notesLines: string[] = [];
    const items: OrderItem[] = [];
    let remainingCapacity = Math.max(1, safeBodyLines);

    if (remainingNotes.length > 0) {
      const availableForNotes = Math.max(1, remainingCapacity - NOTES_HEADER_LINES);
      const take = Math.min(remainingNotes.length, availableForNotes);
      notesLines.push(...remainingNotes.splice(0, take));
      remainingCapacity -= take + NOTES_HEADER_LINES;
    }

    while (remainingItems.length > 0) {
      const nextItem = remainingItems[0];
      const itemLineCount = getItemLineCount(nextItem, items.length > 0, lineLength);
      if (
        itemLineCount <= remainingCapacity ||
        (items.length === 0 && notesLines.length === 0)
      ) {
        items.push(remainingItems.shift() as OrderItem);
        remainingCapacity -= itemLineCount;
      } else {
        break;
      }
    }

    segments.push({
      order,
      notesLines,
      items,
    });
  }

  return segments.map((segment, index) => ({
    ...segment,
    segmentIndex: index + 1,
    totalSegments: segments.length,
  }));
};

export default function KitchenDisplayPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const [orders, setOrders] = useState<Order[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [lastFetchFailed, setLastFetchFailed] = useState(false);
  const [isPreparedView, setIsPreparedView] = useState(false);
  const [preparedCount, setPreparedCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockSection, setStockSection] = useState<'items' | 'addons'>('items');
  const [stockSearch, setStockSearch] = useState('');
  const [debouncedStockSearch, setDebouncedStockSearch] = useState('');
  const [items, setItems] = useState<StockRow[]>([]);
  const [addons, setAddons] = useState<StockRow[]>([]);
  const [addonGroups, setAddonGroups] = useState<Record<number, string>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');
  const [stockInlineError, setStockInlineError] = useState('');
  const [updatingRowId, setUpdatingRowId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [pageIndex, setPageIndex] = useState(0);
  const [columns, setColumns] = useState(1);
  const rows = 1;
  const [maxBodyLines, setMaxBodyLines] = useState(12);
  const [noteLineLength, setNoteLineLength] = useState(NOTE_LINE_LENGTH);
  const [cardWidth, setCardWidth] = useState(CARD_WIDTH_BASE);
  const [cardHeight, setCardHeight] = useState(480);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [cooldowns, setCooldowns] = useState<Record<string, boolean>>({});
  const orderedSegmentsRef = useRef(0);
  const pageIndexRef = useRef(0);
  const pendingOrderIdsRef = useRef<Set<string>>(new Set());
  const [rejectOrder, setRejectOrder] = useState<Order | null>(null);
  const emptyMessage = useMemo(() => getRandomOrderEmptyMessage(), []);
  const {
    isOpen,
    breakUntil,
    showBreakModal,
    setShowBreakModal,
    toggleOpen,
    startBreak,
    endBreak,
  } = useRestaurantAvailability(restaurantId);

  const mutedPreferenceKey = useMemo(
    () => (restaurantId ? `kod_sound_muted_${restaurantId}` : 'kod_sound_muted'),
    [restaurantId]
  );
  const legacyPreferenceKey = useMemo(
    () => (restaurantId ? `kod_audio_enabled_${restaurantId}` : 'kod_audio_enabled'),
    [restaurantId]
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);

  const stopAlertLoop = useCallback(() => {
    orderAlertSoundController.stop('KOD');
  }, []);

  const ensureAudioContext = useCallback(async () => {
    const context = orderAlertSoundController.ensureAudioContext();
    if (!context) return null;
    if (context.state === 'suspended') {
      setNeedsAudioUnlock(true);
    } else {
      setNeedsAudioUnlock(false);
    }
    return context;
  }, []);

  const startAlertLoop = useCallback(() => {
    if (!soundEnabled) return;
    if (pendingOrderIdsRef.current.size === 0) return;
    orderAlertSoundController
      .playLoop('KOD')
      .then((played) => {
        if (played) {
          setNeedsAudioUnlock(false);
        } else {
          setNeedsAudioUnlock(true);
        }
      })
      .catch((err) => {
        console.error('[kod] audio playback failed', err);
        setNeedsAudioUnlock(true);
      });
  }, [soundEnabled]);

  const syncAlertLoop = useCallback(() => {
    if (!soundEnabled) {
      stopAlertLoop();
      return;
    }
    if (pendingOrderIdsRef.current.size > 0) {
      startAlertLoop();
    } else {
      stopAlertLoop();
    }
  }, [soundEnabled, startAlertLoop, stopAlertLoop]);

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    setIsFetching(true);
    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        short_order_number,
        order_type,
        source,
        status,
        total_price,
        kod_done_at,
        kod_done_by_user_id,
        created_at,
        customer_notes,
        order_items(
          id,
          item_id,
          name,
          price,
          quantity,
          notes,
          order_addons(
            id,
            option_id,
            name,
            price,
            quantity
          )
        )
      `
      )
      .eq('restaurant_id', restaurantId)
      .eq('status', 'accepted')
      .is('kod_done_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[kod] failed to load orders', error);
      setLastFetchFailed(true);
      setIsFetching(false);
      return;
    }

    const nextOrders = (data as Order[]) ?? [];
    setOrders(nextOrders);
    pendingOrderIdsRef.current = new Set(
      nextOrders.filter((order) => order.status === 'pending').map((order) => order.id)
    );
    syncAlertLoop();
    setLastFetchFailed(false);
    setIsFetching(false);
  }, [restaurantId, syncAlertLoop]);

  const fetchPreparedOrders = useCallback(async () => {
    if (!restaurantId) return;
    const { data: startData, error: startError } = await supabase.rpc(
      'get_restaurant_business_day_start',
      { p_restaurant_id: restaurantId }
    );
    if (startError || !startData) {
      console.error('[kod] failed to resolve business day start', startError);
      setPreparedCount(0);
      return;
    }

    const businessDayStart = new Date(startData as string).toISOString();
    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        short_order_number,
        order_type,
        source,
        status,
        total_price,
        kod_done_at,
        kod_done_by_user_id,
        created_at,
        customer_notes,
        order_items(
          id,
          item_id,
          name,
          price,
          quantity,
          notes,
          order_addons(
            id,
            option_id,
            name,
            price,
            quantity
          )
        )
      `
      )
      .eq('restaurant_id', restaurantId)
      .gte('created_at', businessDayStart)
      .not('status', 'eq', 'cancelled')
      .not('kod_done_at', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[kod] failed to load prepared orders', error);
      setPreparedCount(0);
      return;
    }

    const preparedOrders = (data as Order[]) ?? [];
    setPreparedCount(preparedOrders.length);
    if (isPreparedView) {
      setOrders(preparedOrders);
    }
  }, [isPreparedView, restaurantId]);

  const fetchStockRows = useCallback(async (forceOpen = false) => {
    if (!forceOpen && !isStockModalOpen) return;

    if (!restaurantId) {
      console.error('Stock modal missing restaurant_id');
      setStockError('Restaurant context missing.');
      setStockLoading(false);
      return;
    }

    setStockLoading(true);
    setStockError('');
    setStockInlineError('');

    const { data: itemsData, error: itemsError } = await supabase
      .from('menu_items')
      .select('id,restaurant_id,name,stock_status,stock_return_date,out_of_stock_until,stock_last_updated_at')
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null)
      .order('name', { ascending: true });

    const { data: groups, error: groupsError } = await supabase
      .from('addon_groups')
      .select('id,name')
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null)
      .order('name', { ascending: true });

    if (itemsError || groupsError) {
      console.error('[kod] failed to load stock rows', { itemsError, groupsError });
      setStockError('Unable to load stock rows.');
      setStockLoading(false);
      return;
    }

    const safeGroups = (groups as AddonGroup[]) ?? [];
    const groupIds = safeGroups.map((group) => group.id);
    const nextGroupMap = safeGroups.reduce<Record<number, string>>((acc, group) => {
      acc[group.id] = group.name;
      return acc;
    }, {});

    let addonData: StockRow[] = [];
    if (groupIds.length > 0) {
      const { data, error } = await supabase
        .from('addon_options')
        .select('id,group_id,name,stock_status,stock_return_date,out_of_stock_until,stock_last_updated_at')
        .in('group_id', groupIds)
        .is('archived_at', null)
        .order('name', { ascending: true });

      if (error) {
        console.error('[kod] failed to load addon stock rows', error);
        setStockError('Unable to load add-ons.');
        setStockLoading(false);
        return;
      }
      addonData = (data as StockRow[]) ?? [];
    }

    setItems(itemsData ?? []);
    setAddonGroups(nextGroupMap);
    setAddons(addonData ?? []);
    setStockLoading(false);

    if (process.env.NODE_ENV !== 'production') {
      console.debug('Stock loaded', {
        items: itemsData?.length ?? 0,
        addons: addonData?.length ?? 0,
      });
    }
  }, [isStockModalOpen, restaurantId]);


  const openStockModal = useCallback(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('Stock modal load', { restaurantId });
    }
    setIsStockModalOpen(true);
    void fetchStockRows(true);
  }, [fetchStockRows, restaurantId]);

  const refreshCurrentView = useCallback(async () => {
    if (isPreparedView) {
      await fetchPreparedOrders();
    } else {
      await fetchOrders();
    }
  }, [fetchOrders, fetchPreparedOrders, isPreparedView]);

  useEffect(() => {
    if (!restaurantId) return;
    const fetchCurrentView = isPreparedView ? fetchPreparedOrders : fetchOrders;
    fetchCurrentView();
    let timeoutId: number | undefined;
    let active = true;
    const scheduleNext = () => {
      if (!active) return;
      const jitter = Math.floor(Math.random() * 600) - 300;
      timeoutId = window.setTimeout(async () => {
        await fetchCurrentView();
        scheduleNext();
      }, 5000 + jitter);
    };
    scheduleNext();
    return () => {
      active = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [fetchOrders, fetchPreparedOrders, isPreparedView, restaurantId]);


  useEffect(() => {
    if (!restaurantId) return;
    fetchPreparedOrders();
  }, [fetchPreparedOrders, restaurantId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedStockSearch(stockSearch);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [stockSearch]);


  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setCurrentUserId(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(window.navigator.onLine);
    const handleFocus = () => {
      void refreshCurrentView();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshCurrentView();
      }
    };
    const handleOnline = () => {
      setIsOnline(true);
      void refreshCurrentView();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshCurrentView]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateLayout = () => {
      const containerWidthPx = gridRef.current?.getBoundingClientRect().width ?? 0;
      const effectiveWidth = containerWidthPx || window.innerWidth;
      const nextColumns =
        effectiveWidth >= 1600 ? 4 : effectiveWidth >= 1200 ? 3 : effectiveWidth >= 800 ? 2 : 1;
      const gapValue = gridRef.current
        ? window.getComputedStyle(gridRef.current).columnGap ||
          window.getComputedStyle(gridRef.current).gap
        : `${CARD_GAP}px`;
      const gapPx = Number.parseFloat(gapValue || '0') || 0;
      const resolvedColumns = Math.max(1, nextColumns);
      const ticketWidthPx = Math.max(
        1,
        (effectiveWidth - gapPx * (resolvedColumns - 1)) / resolvedColumns
      );
      setColumns(resolvedColumns);
      setCardWidth(ticketWidthPx);
      setNoteLineLength(
        Math.max(20, Math.floor((ticketWidthPx / CARD_WIDTH_BASE) * NOTE_LINE_LENGTH))
      );
      if (process.env.NODE_ENV !== 'production') {
        console.log('[kod] layout', {
          containerWidthPx,
          ticketWidthPx,
          gapPx,
          visibleCapacity: resolvedColumns,
          totalTickets: orderedSegmentsRef.current,
          pageIndex: pageIndexRef.current,
        });
      }
      const availableHeight = gridRef.current?.getBoundingClientRect().height ?? 0;
      const fallbackHeight =
        window.innerHeight - TOP_CONTROLS_HEIGHT - CARD_VERTICAL_PADDING * 2 - 48;
      const nextCardHeight = Math.max(320, availableHeight || fallbackHeight);
      setCardHeight(nextCardHeight);
      const usableBodyHeight =
        nextCardHeight - HEADER_RESERVED_PX - FOOTER_RESERVED_PX - CARD_VERTICAL_PADDING;
      const nextMaxBodyLines = Math.max(
        NOTES_HEADER_LINES + 1,
        Math.floor(usableBodyHeight / BODY_LINE_HEIGHT)
      );
      setMaxBodyLines(nextMaxBodyLines);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    const observer = gridRef.current ? new ResizeObserver(updateLayout) : null;
    if (gridRef.current && observer) {
      observer.observe(gridRef.current);
    }
    if (document.fonts?.ready) {
      document.fonts.ready.then(updateLayout).catch(() => undefined);
    }

    return () => {
      window.removeEventListener('resize', updateLayout);
      if (observer && gridRef.current) {
        observer.unobserve(gridRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedMuted = window.localStorage.getItem(mutedPreferenceKey);
    let muted = storedMuted === 'true';
    if (storedMuted === null) {
      const legacy = window.localStorage.getItem(legacyPreferenceKey);
      if (legacy === 'false') {
        muted = true;
      }
    }
    window.localStorage.setItem(mutedPreferenceKey, muted ? 'true' : 'false');
    setSoundEnabled(!muted);
  }, [legacyPreferenceKey, mutedPreferenceKey]);

  const handleEnableSound = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      await orderAlertSoundController.resumeAudioContext();
    } catch (err) {
      console.debug('[kod] unable to resume audio context', err);
    }
    void ensureAudioContext();

    window.localStorage.setItem(mutedPreferenceKey, 'false');
    setSoundEnabled(true);
    setNeedsAudioUnlock(false);
  }, [ensureAudioContext, mutedPreferenceKey]);

  const handleDisableSound = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(mutedPreferenceKey, 'true');
    setSoundEnabled(false);
    setNeedsAudioUnlock(false);
  }, [mutedPreferenceKey]);

  useEffect(() => {
    syncAlertLoop();
    return () => {
      stopAlertLoop();
    };
  }, [soundEnabled, stopAlertLoop, syncAlertLoop]);

  useEffect(() => {
    if (!soundEnabled) {
      setNeedsAudioUnlock(false);
      return;
    }
    void ensureAudioContext();
  }, [ensureAudioContext, soundEnabled]);

  const formatElapsed = useCallback((createdAt: string) => {
    const createdTime = new Date(createdAt).getTime();
    if (Number.isNaN(createdTime)) return '--';
    const totalSeconds = Math.max(0, Math.floor((now - createdTime) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }, [now]);

  const startCooldown = useCallback((key: string) => {
    setCooldowns((prev) => ({ ...prev, [key]: true }));
    window.setTimeout(() => {
      setCooldowns((prev) => ({ ...prev, [key]: false }));
    }, 1500);
  }, []);

  const acknowledgeOrder = useCallback(
    async (orderId: string) => {
      if (!orderId) return;
      const payload = restaurantId
        ? { order_id: orderId, restaurant_id: restaurantId }
        : { order_id: orderId };
      const { error } = await supabase
        .from('order_acknowledgements')
        .insert(payload);
      if (error) {
        console.error('[kod] failed to acknowledge order', error);
      }
    },
    [restaurantId]
  );

  const updateOrderStatus = useCallback(
    async (order: Order, nextStatus: string, allowedStatuses: string[]) => {
      if (TERMINAL_STATUSES.includes(order.status)) return;
      await acknowledgeOrder(order.id);
      const { data, error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', order.id)
        .in('status', allowedStatuses)
        .select('id');

      if (error) {
        console.error('[kod] failed to update order status', error);
        setToastMessage('Unable to update order');
        return;
      }

      if (!data || data.length === 0) {
        setToastMessage('Updated elsewhere');
        void refreshCurrentView();
        return;
      }

      void refreshCurrentView();
    },
    [acknowledgeOrder, refreshCurrentView]
  );

  const handlePrimaryAction = useCallback(
    async (order: Order) => {
      const key = `${order.id}-primary`;
      if (cooldowns[key]) return;
      startCooldown(key);

      if (isPreparedView) {
        if (order.status === 'completed') return;
        await updateOrderStatus(order, 'completed', ['accepted', 'preparing', 'ready_to_collect', 'delivering']);
        await fetchPreparedOrders();
        return;
      }

      if (!['accepted', 'preparing', 'ready_to_collect', 'delivering'].includes(order.status)) {
        return;
      }

      await acknowledgeOrder(order.id);
      const { error } = await supabase
        .from('orders')
        .update({ kod_done_at: new Date().toISOString(), kod_done_by_user_id: currentUserId })
        .eq('id', order.id)
        .in('status', ['accepted', 'preparing', 'ready_to_collect', 'delivering']);

      if (error) {
        console.error('[kod] failed to mark order prepared', error);
        setToastMessage('Unable to mark as done');
        return;
      }

      await fetchOrders();
      await fetchPreparedOrders();
    },
    [acknowledgeOrder, cooldowns, currentUserId, fetchOrders, fetchPreparedOrders, isPreparedView, startCooldown, updateOrderStatus]
  );

  const handleUndoPrepared = useCallback(async (order: Order) => {
    if (order.status === 'completed') return;
    const key = `${order.id}-undo`;
    if (cooldowns[key]) return;
    startCooldown(key);
    const { error } = await supabase
      .from('orders')
      .update({ kod_done_at: null, kod_done_by_user_id: null })
      .eq('id', order.id)
      .in('status', ['accepted', 'preparing', 'ready_to_collect', 'delivering']);
    if (error) {
      console.error('[kod] failed to undo prepared state', error);
      setToastMessage('Unable to undo');
      return;
    }
    await fetchPreparedOrders();
  }, [cooldowns, fetchPreparedOrders, startCooldown]);

  const handleStockStatusChange = useCallback(async (table: 'menu_items' | 'addon_options', row: StockRow, nextStatus: 'in_stock' | 'back_tomorrow' | 'off_indefinitely') => {
    const rowKey = `${table}-${row.id}`;
    if (updatingRowId === rowKey) return;

    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextTimestamp = new Date().toISOString();
    const nextDateValue = nextStatus === 'back_tomorrow' ? tomorrow.toISOString() : null;
    const dbStatus: 'in_stock' | 'scheduled' | 'out' =
      nextStatus === 'in_stock' ? 'in_stock' : nextStatus === 'back_tomorrow' ? 'scheduled' : 'out';

    const previousRow = { ...row };
    const nextRow: StockRow = {
      ...row,
      stock_status: dbStatus,
      stock_last_updated_at: nextTimestamp,
      stock_return_date: nextDateValue,
      out_of_stock_until: nextDateValue,
    };

    setStockInlineError('');
    setUpdatingRowId(rowKey);
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[kod-stock] update start', { rowKey, nextStatus });
    }

    const applyRow = (rows: StockRow[]) => rows.map((current) => (current.id === row.id ? nextRow : current));
    const revertRow = (rows: StockRow[]) => rows.map((current) => (current.id === row.id ? previousRow : current));

    if (table === 'menu_items') {
      setItems(applyRow);
    } else {
      setAddons(applyRow);
    }

    const updatePayload: Record<string, string | null> = {
      stock_status: dbStatus,
      stock_last_updated_at: nextTimestamp,
      stock_return_date: nextDateValue,
      out_of_stock_until: nextDateValue,
    };

    let query = supabase.from(table).update(updatePayload).eq('id', row.id);
    if (table === 'menu_items') {
      query = query.eq('restaurant_id', restaurantId);
    }
    const { error } = await query;
    if (error) {
      if (table === 'menu_items') {
        setItems(revertRow);
      } else {
        setAddons(revertRow);
      }
      setStockInlineError('Unable to update stock for this row.');
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[kod-stock] update failure', { rowKey, nextStatus, error });
      }
      setUpdatingRowId(null);
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[kod-stock] update success', { rowKey, nextStatus });
    }
    setUpdatingRowId(null);
  }, [restaurantId, updatingRowId]);

  const pageSize = Math.max(1, columns * rows);
  const visibleOrders = orders;

  const orderedSegments = useMemo(() => {
    const segments: OrderSegment[] = [];
    visibleOrders.forEach((order) => {
      segments.push(...buildOrderSegments(order, maxBodyLines, noteLineLength));
    });
    return segments;
  }, [visibleOrders, maxBodyLines, noteLineLength]);
  const totalPages = Math.max(1, Math.ceil(orderedSegments.length / pageSize));

  useEffect(() => {
    setPageIndex((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);
  useEffect(() => {
    orderedSegmentsRef.current = orderedSegments.length;
  }, [orderedSegments.length]);
  useEffect(() => {
    pageIndexRef.current = pageIndex;
  }, [pageIndex]);

  const orderSegments = useMemo(
    () => orderedSegments.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [orderedSegments, pageIndex, pageSize]
  );
  const orderTintIndex = useMemo(() => {
    const map = new Map<string, number>();
    visibleOrders.forEach((order, index) => {
      map.set(order.id, index);
    });
    return map;
  }, [visibleOrders]);
  const totalTickets = orderedSegments.length;
  const waitingCount = Math.max(0, totalTickets - pageSize * (pageIndex + 1));
  const tintClasses = ['bg-black text-white', 'bg-white text-black'];
  const getTintClass = (orderId: string) =>
    tintClasses[(orderTintIndex.get(orderId) ?? 0) % tintClasses.length];
  const getPrimaryTextClass = (orderId: string) =>
    (orderTintIndex.get(orderId) ?? 0) % 2 === 0 ? 'text-white' : 'text-black';
  const getMutedTextClass = (orderId: string) =>
    (orderTintIndex.get(orderId) ?? 0) % 2 === 0 ? 'text-neutral-400' : 'text-neutral-600';
  const getSecondaryTextClass = (orderId: string) =>
    (orderTintIndex.get(orderId) ?? 0) % 2 === 0 ? 'text-neutral-200' : 'text-neutral-700';
  const getContinuedTextClass = (orderId: string) =>
    (orderTintIndex.get(orderId) ?? 0) % 2 === 0 ? 'text-rose-200' : 'text-rose-700';
  const getNotesHeaderClass = (orderId: string) =>
    (orderTintIndex.get(orderId) ?? 0) % 2 === 0 ? 'text-amber-200' : 'text-amber-700';
  const getNotesBodyClass = (orderId: string) =>
    (orderTintIndex.get(orderId) ?? 0) % 2 === 0 ? 'text-amber-100' : 'text-amber-800';
  const isLightTicket = (orderId: string) => (orderTintIndex.get(orderId) ?? 0) % 2 !== 0;
  const getRejectButtonClass = (orderId: string) =>
    `rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
      isLightTicket(orderId)
        ? 'border-black bg-black text-white hover:bg-neutral-900'
        : 'border-white bg-white text-black hover:bg-neutral-100'
    }`;
  const getRejectTooltipBubbleClass = (orderId: string) =>
    `shadow-lg shadow-black/50 ${
      isLightTicket(orderId) ? 'bg-black text-white' : 'bg-neutral-950 text-white'
    }`;
  const getRejectTooltipArrowClass = (orderId: string) =>
    `shadow-lg shadow-black/50 ${isLightTicket(orderId) ? 'bg-black' : 'bg-neutral-950'}`;
  const isKioskOrder = (order: Order) =>
    order.order_type === 'kiosk' || order.source === 'kiosk';

  const stockSearchTerm = debouncedStockSearch.trim().toLowerCase();
  const filteredMenuStockRows = useMemo(
    () =>
      items.filter((row) =>
        stockSearchTerm ? row.name.toLowerCase().includes(stockSearchTerm) : true
      ),
    [items, stockSearchTerm]
  );
  const filteredAddonStockRows = useMemo(
    () =>
      addons.filter((row) =>
        stockSearchTerm ? row.name.toLowerCase().includes(stockSearchTerm) : true
      ),
    [addons, stockSearchTerm]
  );
  const groupedAddonRows = useMemo(() => {
    return filteredAddonStockRows.reduce<Record<string, StockRow[]>>((acc, row) => {
      const groupName = addonGroups[row.group_id || 0] || 'Ungrouped';
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push(row);
      return acc;
    }, {});
  }, [addonGroups, filteredAddonStockRows]);

  return (
    <FullscreenAppLayout
      promptTitle="Tap to enter fullscreen"
      promptDescription="Kitchen Display works best in fullscreen mode."
    >
      <div className="h-screen w-full overflow-hidden bg-neutral-950 text-white">
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden px-3 py-4 sm:px-4 lg:px-6">
          <div
            className="flex w-full flex-none items-center justify-between gap-2"
            style={{ height: `${TOP_CONTROLS_HEIGHT}px` }}
          >
            <div className="flex max-w-full flex-wrap items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-neutral-200 shadow-lg shadow-black/40 backdrop-blur">
              <button
                type="button"
                onClick={() => {
                  setIsPreparedView((prev) => !prev);
                  setPageIndex(0);
                }}
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] transition ${
                  isPreparedView
                    ? "border-teal-400/60 bg-teal-500/20 text-teal-100 hover:bg-teal-500/30"
                    : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                Prepared ({preparedCount})
              </button>
              <button
                type="button"
                onClick={openStockModal}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-white/10"
              >
                Stock
              </button>
              <ArrowPathIcon
                className={`h-4 w-4 ${isFetching ? 'animate-spin text-teal-300' : 'text-neutral-400'}`}
              />
              {!isOnline ? (
                <span className="flex items-center gap-2 text-rose-300">
                  <WifiIcon className="h-4 w-4" />
                  Offline
                </span>
              ) : null}
              {isOnline && lastFetchFailed ? (
                <span className="text-amber-300">Sync error</span>
              ) : null}
              {needsAudioUnlock && soundEnabled ? (
                <button
                  type="button"
                  onClick={handleEnableSound}
                  className="flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-100 transition hover:bg-amber-500/20"
                >
                  <SpeakerWaveIcon className="h-4 w-4" />
                  Tap to enable sound
                </button>
              ) : null}
              {soundEnabled ? (
                <button
                  type="button"
                  onClick={handleDisableSound}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-white/10"
                >
                  <SpeakerWaveIcon className="h-4 w-4" />
                  Sound On
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableSound}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-white/10"
                >
                  <SpeakerXMarkIcon className="h-4 w-4" />
                  Enable Sound
                </button>
              )}
              {breakUntil && new Date(breakUntil).getTime() > now ? (
                <BreakCountdown
                  breakUntil={breakUntil}
                  onEnd={endBreak}
                  variant="kod"
                  className="mb-0"
                />
              ) : null}
              {isOpen !== null ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleOpen}
                    className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] transition ${
                      isOpen
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
                        : 'border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30'
                    }`}
                  >
                    {isOpen ? 'Close Now' : 'Open Now'}
                  </button>
                  {isOpen ? (
                    <button
                      type="button"
                      onClick={() => setShowBreakModal(true)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-white/10"
                    >
                      Take a Break
                    </button>
                  ) : null}
                </div>
              ) : null}
              {waitingCount > 0 ? (
                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white">
                  +{waitingCount} waiting
                </div>
              ) : null}
              {totalPages > 1 ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                    disabled={pageIndex === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous orders"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
                    disabled={pageIndex >= totalPages - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next orders"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex w-full flex-1 min-h-0 flex-col space-y-4 overflow-hidden">
            {visibleOrders.length === 0 && !isFetching ? (
              <div className="flex flex-1 items-center justify-center text-center">
                <div className="flex max-w-md flex-col items-center gap-4 rounded-3xl border border-white/10 bg-neutral-900/80 p-8 shadow-lg shadow-black/40">
                  <ChefHat className="h-16 w-16 text-neutral-600" />
                  <p className="text-sm text-neutral-200">{emptyMessage}</p>
                </div>
              </div>
            ) : null}
            <div
              ref={gridRef}
              className="flex min-h-0 flex-1 flex-nowrap gap-4 overflow-hidden overscroll-none"
            >
              {orderSegments.map((segment) => (
                <div
                  key={`${segment.order.id}-${segment.segmentIndex}`}
                  className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 shadow-lg shadow-black/20 ${getTintClass(
                    segment.order.id
                  )} ${segment.segmentIndex === 1 ? 'p-5' : 'px-5 pb-5 pt-0'}`}
                  style={{ width: `${cardWidth}px`, height: `${cardHeight}px` }}
                >
                  {segment.segmentIndex === 1 ? (
                    <div className="flex h-[88px] flex-wrap items-center justify-between gap-3">
                      <>
                        <div>
                          <p
                            className={`text-xs uppercase tracking-[0.2em] ${getMutedTextClass(
                              segment.order.id
                            )}`}
                          >
                            Order
                          </p>
                          <p
                            className={`text-2xl font-semibold ${getPrimaryTextClass(
                              segment.order.id
                            )}`}
                          >
                            ORDER {formatOrderNumber(segment.order)} ({segment.segmentIndex}/
                            {segment.totalSegments})
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-xs uppercase tracking-[0.2em] ${getMutedTextClass(
                              segment.order.id
                            )}`}
                          >
                            {segment.order.order_type}
                          </p>
                          <p className={`text-sm font-semibold ${getSecondaryTextClass(segment.order.id)}`}>
                            {formatElapsed(segment.order.created_at)}
                          </p>
                          <p
                            className={`text-xl font-semibold ${getPrimaryTextClass(
                              segment.order.id
                            )}`}
                          >
                            {formatGBP(getOrderTotalPrice(segment.order))}
                          </p>
                        </div>
                      </>
                    </div>
                  ) : (
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-[0.3em] ${getContinuedTextClass(
                        segment.order.id
                      )}`}
                    >
                      Continued ({segment.segmentIndex}/{segment.totalSegments})
                    </p>
                  )}
                  <div className={`${segment.segmentIndex === 1 ? 'mt-4' : 'mt-0'} flex-1 overflow-hidden`}>
                    {segment.notesLines.length > 0 ? (
                      <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
                        <p
                          className={`text-xs font-semibold uppercase tracking-[0.3em] ${getNotesHeaderClass(
                            segment.order.id
                          )}`}
                        >
                          Notes
                        </p>
                        <div
                          className={`mt-2 space-y-1 text-sm ${getNotesBodyClass(
                            segment.order.id
                          )}`}
                        >
                          {segment.notesLines.map((line, index) => (
                            <p key={`${segment.order.id}-note-${segment.segmentIndex}-${index}`}>
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className={`${segment.notesLines.length > 0 ? 'mt-4' : ''} space-y-4`}>
                      {segment.items.map((item) => (
                        <div key={item.id} className="space-y-2">
                          <p className={`text-lg font-semibold ${getPrimaryTextClass(segment.order.id)}`}>
                            {item.quantity}× {item.name}
                          </p>
                          {item.notes ? (
                            <p
                              className={`pl-4 text-sm italic ${getSecondaryTextClass(
                                segment.order.id
                              )}`}
                            >
                              {item.notes}
                            </p>
                          ) : null}
                          {item.order_addons?.length ? (
                            <div
                              className={`space-y-1 pl-6 text-sm ${getSecondaryTextClass(
                                segment.order.id
                              )}`}
                            >
                              {item.order_addons.map((addon) => (
                                <p key={addon.id}>
                                  {addon.quantity}× {addon.name}
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex h-[72px] flex-col justify-end gap-2 pt-4">
                    {segment.segmentIndex === segment.totalSegments ? (
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handlePrimaryAction(segment.order)}
                          disabled={
                            (isPreparedView
                              ? segment.order.status === 'completed'
                              : !['accepted', 'preparing', 'ready_to_collect', 'delivering'].includes(segment.order.status)) || cooldowns[`${segment.order.id}-primary`]
                          }
                          className="flex-1 rounded-full bg-teal-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isPreparedView ? (segment.order.status === 'completed' ? 'VIEW' : 'COMPLETE') : 'DONE'}
                        </button>
                        {isPreparedView && segment.order.status !== 'completed' ? (
                          <button
                            type="button"
                            onClick={() => handleUndoPrepared(segment.order)}
                            disabled={cooldowns[`${segment.order.id}-undo`]}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Undo
                          </button>
                        ) : null}
                        {!isPreparedView &&
                        !isKioskOrder(segment.order) &&
                        !['completed', 'cancelled', 'rejected'].includes(segment.order.status) ? (
                          <OrderRejectButton
                            status={segment.order.status}
                            onConfirm={() => setRejectOrder(segment.order)}
                            buttonClassName={getRejectButtonClass(segment.order.id)}
                            tooltipClassName="text-[10px]"
                            tooltipBubbleClassName={`${getRejectTooltipBubbleClass(segment.order.id)} border border-white/10`}
                            tooltipArrowClassName={`${getRejectTooltipArrowClass(segment.order.id)} border border-white/10`}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {isStockModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Stock"
            onClick={() => { setIsStockModalOpen(false); setStockInlineError(''); }}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-white/15 bg-neutral-950 p-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Stock</h2>
                <button
                  type="button"
                  className="rounded-full border border-white/20 p-2 text-white hover:bg-white/10"
                  onClick={() => { setIsStockModalOpen(false); setStockInlineError(''); }}
                  aria-label="Close stock modal"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStockSection('items')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${stockSection === 'items' ? 'border-teal-400/50 bg-teal-500/20 text-teal-100' : 'border-white/15 bg-white/5 text-white'}`}
                >
                  Items
                </button>
                <button
                  type="button"
                  onClick={() => setStockSection('addons')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${stockSection === 'addons' ? 'border-teal-400/50 bg-teal-500/20 text-teal-100' : 'border-white/15 bg-white/5 text-white'}`}
                >
                  Add-ons
                </button>
                <div className="relative ml-auto w-full max-w-xs">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-neutral-400" />
                  <input
                    value={stockSearch}
                    onChange={(event) => setStockSearch(event.target.value)}
                    placeholder={`Search ${stockSection === 'items' ? 'items' : 'add-ons'}`}
                    className="w-full rounded-lg border border-white/15 bg-neutral-900 py-2 pl-8 pr-3 text-sm text-white outline-none focus:border-teal-400"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10">
                {stockLoading ? (
                  <div className="p-4 text-sm text-neutral-300">Loading stock…</div>
                ) : null}
                {!stockLoading && stockError ? (
                  <div className="flex items-center justify-between gap-3 p-4">
                    <p className="text-sm text-rose-200">{stockError}</p>
                    <button
                      type="button"
                      onClick={() => void fetchStockRows()}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:bg-white/20"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
                {!stockLoading && !stockError && stockInlineError ? (
                  <div className="p-4 text-sm text-rose-200">{stockInlineError}</div>
                ) : null}
                {!stockLoading && !stockError && stockSection === 'items' && filteredMenuStockRows.length === 0 ? (
                  <div className="p-4 text-sm text-neutral-300">No menu items found for this restaurant.</div>
                ) : null}
                {!stockLoading && !stockError && stockSection === 'addons' && Object.keys(addonGroups).length === 0 ? (
                  <div className="p-4 text-sm text-neutral-300">No add-on groups found.</div>
                ) : null}
                {!stockLoading && !stockError && stockSection === 'addons' && Object.keys(addonGroups).length > 0 && filteredAddonStockRows.length === 0 ? (
                  <div className="p-4 text-sm text-neutral-300">No add-ons found for this restaurant.</div>
                ) : null}
                {!stockLoading && !stockError && stockSection === 'items'
                  ? filteredMenuStockRows.map((row) => {
                      const normalizedStatus = normalizeStockStatus(row.stock_status);
                      const statusKey = `menu_items-${row.id}`;
                      return (
                        <div key={statusKey} className="flex items-center justify-between gap-3 border-b border-white/5 p-3 last:border-b-0">
                          <div>
                            <p className="font-medium text-white">{row.name}</p>
                            <p className="text-xs text-neutral-400">{STOCK_STATUS_LABELS[row.stock_status || normalizedStatus] || row.stock_status || 'in_stock'}</p>
                          </div>
                          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                            {(['in_stock', 'back_tomorrow', 'off_indefinitely'] as const).map((statusOption) => (
                              <button
                                key={`${statusKey}-${statusOption}`}
                                type="button"
                                disabled={updatingRowId === statusKey}
                                onClick={() => handleStockStatusChange('menu_items', row, statusOption)}
                                className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${normalizedStatus === statusOption ? 'bg-teal-500 text-black' : 'text-white hover:bg-white/10'} disabled:opacity-40`}
                              >
                                {STOCK_STATUS_LABELS[statusOption]}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  : null}
                {!stockLoading && !stockError && stockSection === 'addons'
                  ? Object.entries(groupedAddonRows).map(([groupName, rows]) => (
                      <div key={groupName} className="border-b border-white/5 p-3 last:border-b-0">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">{groupName}</p>
                        <div className="space-y-2">
                          {rows.map((row) => {
                            const normalizedStatus = normalizeStockStatus(row.stock_status);
                            const statusKey = `addon_options-${row.id}`;
                            return (
                              <div key={statusKey} className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-white">{row.name}</p>
                                  <p className="text-xs text-neutral-400">{STOCK_STATUS_LABELS[row.stock_status || normalizedStatus] || row.stock_status || 'in_stock'}</p>
                                </div>
                                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                                  {(['in_stock', 'back_tomorrow', 'off_indefinitely'] as const).map((statusOption) => (
                                    <button
                                      key={`${statusKey}-${statusOption}`}
                                      type="button"
                                      disabled={updatingRowId === statusKey}
                                      onClick={() => handleStockStatusChange('addon_options', row, statusOption)}
                                      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${normalizedStatus === statusOption ? 'bg-teal-500 text-black' : 'text-white hover:bg-white/10'} disabled:opacity-40`}
                                    >
                                      {STOCK_STATUS_LABELS[statusOption]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </div>
        ) : null}
        <BreakModal
          show={showBreakModal}
          onClose={() => setShowBreakModal(false)}
          onSelect={startBreak}
          variant="kod"
        />
        {rejectOrder ? (
          <RejectOrderModal
            order={rejectOrder}
            show={!!rejectOrder}
            onClose={() => setRejectOrder(null)}
            onRejected={() => {
              setRejectOrder(null);
              void refreshCurrentView();
            }}
            tone="kod"
          />
        ) : null}
        <Toast message={toastMessage} onClose={() => setToastMessage('')} />
      </div>
    </FullscreenAppLayout>
  );
}
