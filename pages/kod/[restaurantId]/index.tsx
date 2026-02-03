import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  WifiIcon,
} from '@heroicons/react/24/outline';
import FullscreenAppLayout from '@/components/layouts/FullscreenAppLayout';
import Toast from '@/components/Toast';
import { supabase } from '@/lib/supabaseClient';

type AudioContextConstructor = typeof AudioContext;

type OrderAddon = {
  id: number;
  name: string;
  quantity: number;
};

type OrderItem = {
  id: number;
  name: string;
  quantity: number;
  notes?: string | null;
  order_addons: OrderAddon[];
};

type Order = {
  id: string;
  short_order_number: number | null;
  order_type: string;
  status: string;
  created_at: string;
  customer_notes?: string | null;
  order_items: OrderItem[];
};

type OrderSegment = {
  order: Order;
  segmentIndex: number;
  totalSegments: number;
  notesLines: string[];
  items: OrderItem[];
  showContinued: boolean;
};

const MAX_CONTENT_LINES = 12;
const NOTE_LINE_LENGTH = 38;
const CARD_ESTIMATED_HEIGHT = 320;
const FOOTER_RESERVED_LINES = 2;
const ACTIVE_STATUSES = ['pending', 'accepted', 'preparing', 'delivering', 'ready_to_collect'];
const TERMINAL_STATUSES = ['completed', 'cancelled'];

const splitNotesLines = (notes: string) => {
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
        if ((current + ` ${word}`).length > NOTE_LINE_LENGTH) {
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
  String(order.short_order_number ?? 0).padStart(4, '0');

const buildOrderSegments = (order: Order): OrderSegment[] => {
  const remainingNotes = splitNotesLines(order.customer_notes ?? '').slice();
  const remainingItems = (order.order_items ?? []).slice();
  const segments: Omit<OrderSegment, 'segmentIndex' | 'totalSegments'>[] = [];

  while (remainingNotes.length > 0 || remainingItems.length > 0) {
    const notesLines: string[] = [];
    const items: OrderItem[] = [];
    const isFirstSegment = segments.length === 0;
    let remainingCapacity = Math.max(
      1,
      MAX_CONTENT_LINES - (isFirstSegment ? FOOTER_RESERVED_LINES : 0)
    );

    if (remainingNotes.length > 0) {
      const take = Math.min(remainingNotes.length, remainingCapacity);
      notesLines.push(...remainingNotes.splice(0, take));
      remainingCapacity -= take;
    }

    while (remainingItems.length > 0) {
      const nextItem = remainingItems[0];
      const addonCount = nextItem.order_addons?.length ?? 0;
      const itemLineCount = 1 + addonCount;
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
      showContinued: remainingNotes.length > 0 || remainingItems.length > 0,
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [lastFetchFailed, setLastFetchFailed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [pageIndex, setPageIndex] = useState(0);
  const [columns, setColumns] = useState(1);
  const [rows, setRows] = useState(1);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [cooldowns, setCooldowns] = useState<Record<string, boolean>>({});

  const preferenceKey = useMemo(
    () => (restaurantId ? `kod_audio_enabled_${restaurantId}` : 'kod_audio_enabled'),
    [restaurantId]
  );
  const [soundEnabled, setSoundEnabled] = useState(false);

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
        status,
        created_at,
        customer_notes,
        order_items(
          id,
          name,
          quantity,
          notes,
          order_addons(
            id,
            name,
            quantity
          )
        )
      `
      )
      .eq('restaurant_id', restaurantId)
      .not('status', 'in', '("completed","cancelled")')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[kod] failed to load orders', error);
      setLastFetchFailed(true);
      setIsFetching(false);
      return;
    }

    setOrders((data as Order[]) ?? []);
    setLastFetchFailed(false);
    setIsFetching(false);
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    fetchOrders();
    let timeoutId: number | undefined;
    let active = true;
    const scheduleNext = () => {
      if (!active) return;
      const jitter = Math.floor(Math.random() * 600) - 300;
      timeoutId = window.setTimeout(async () => {
        await fetchOrders();
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
  }, [fetchOrders, restaurantId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(window.navigator.onLine);
    const handleFocus = () => {
      fetchOrders();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders();
      }
    };
    const handleOnline = () => {
      setIsOnline(true);
      fetchOrders();
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
  }, [fetchOrders]);

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
    const updateLayout = () => {
      const width = window.innerWidth;
      let nextColumns = 1;
      if (width >= 1280) {
        nextColumns = 4;
      } else if (width >= 1024) {
        nextColumns = 3;
      } else if (width >= 640) {
        nextColumns = 2;
      }
      setColumns(nextColumns);
      const availableHeight = gridRef.current?.clientHeight ?? window.innerHeight;
      const nextRows = Math.max(1, Math.floor(availableHeight / CARD_ESTIMATED_HEIGHT));
      setRows(nextRows);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    const observer = gridRef.current ? new ResizeObserver(updateLayout) : null;
    if (gridRef.current && observer) {
      observer.observe(gridRef.current);
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
    const stored = window.localStorage.getItem(preferenceKey);
    setSoundEnabled(stored === 'true');
  }, [preferenceKey]);

  const handleEnableSound = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const AudioContextCtor = (window.AudioContext ||
      (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext) as
      | AudioContextConstructor
      | undefined;

    if (AudioContextCtor) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextCtor();
        }
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } catch (err) {
        console.debug('[kod] unable to initialize audio context', err);
      }
    }

    window.localStorage.setItem(preferenceKey, 'true');
    setSoundEnabled(true);
  }, [preferenceKey]);

  const handleDisableSound = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(preferenceKey, 'false');
    setSoundEnabled(false);
  }, [preferenceKey]);

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
    async (order: Order, nextStatus: string, expectedStatus: string) => {
      if (TERMINAL_STATUSES.includes(order.status)) return;
      await acknowledgeOrder(order.id);
      const { data, error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', order.id)
        .eq('status', expectedStatus)
        .select('id');

      if (error) {
        console.error('[kod] failed to update order status', error);
        setToastMessage('Unable to update order');
        return;
      }

      if (!data || data.length === 0) {
        setToastMessage('Updated elsewhere');
        fetchOrders();
        return;
      }

      fetchOrders();
    },
    [acknowledgeOrder, fetchOrders]
  );

  const handlePrimaryAction = useCallback(
    async (order: Order) => {
      const key = `${order.id}-primary`;
      if (cooldowns[key]) return;
      startCooldown(key);
      if (order.status === 'pending') {
        await updateOrderStatus(order, 'accepted', 'pending');
        return;
      }
      if (order.status === 'accepted') {
        await updateOrderStatus(order, 'completed', 'accepted');
      }
    },
    [cooldowns, startCooldown, updateOrderStatus]
  );

  const pageSize = Math.max(1, columns * rows);
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));

  useEffect(() => {
    setPageIndex((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  const pagedOrders = useMemo(() => {
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return orders.slice(start, end);
  }, [orders, pageIndex, pageSize]);

  const orderSegments = useMemo(
    () => pagedOrders.flatMap((order) => buildOrderSegments(order)),
    [pagedOrders]
  );

  const waitingCount = Math.max(0, orders.length - pageSize);

  return (
    <FullscreenAppLayout
      promptTitle="Tap to enter fullscreen"
      promptDescription="Kitchen Display works best in fullscreen mode."
    >
      <div className="h-screen w-full overflow-hidden bg-neutral-950 text-white">
        <div className="flex h-full flex-col gap-6 overflow-hidden px-3 py-6 sm:px-4 lg:px-6">
          <div className="flex w-full flex-1 flex-col space-y-4 overflow-hidden">
            {orders.length === 0 && !isFetching ? (
              <p className="text-center text-base text-neutral-400">
                No active orders yet.
              </p>
            ) : null}
            <div
              ref={gridRef}
              className="grid h-full flex-1 grid-cols-1 gap-4 overflow-hidden sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {orderSegments.map((segment) => (
                <div
                  key={`${segment.order.id}-${segment.segmentIndex}`}
                  className="flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Order</p>
                      <p className="text-2xl font-semibold text-white">
                        ORDER {formatOrderNumber(segment.order)} ({segment.segmentIndex}/
                        {segment.totalSegments})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
                        {segment.order.order_type}
                      </p>
                      <p className="text-xl font-semibold text-white">
                        {formatElapsed(segment.order.created_at)}
                      </p>
                    </div>
                  </div>
                  {segment.notesLines.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
                        Notes
                      </p>
                      <div className="mt-2 space-y-1 text-sm text-amber-100">
                        {segment.notesLines.map((line, index) => (
                          <p key={`${segment.order.id}-note-${segment.segmentIndex}-${index}`}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex-1 space-y-4">
                    {segment.items.map((item) => (
                      <div key={item.id} className="space-y-2">
                        <p className="text-lg font-semibold text-white">
                          {item.quantity}× {item.name}
                        </p>
                        {item.notes ? (
                          <p className="pl-4 text-sm italic text-neutral-200">{item.notes}</p>
                        ) : null}
                        {item.order_addons?.length ? (
                          <div className="space-y-1 pl-6 text-sm text-neutral-300">
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
                  {segment.segmentIndex === 1 &&
                  ACTIVE_STATUSES.includes(segment.order.status) ? (
                    <div className="mt-auto flex flex-col gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => handlePrimaryAction(segment.order)}
                        disabled={
                          !['pending', 'accepted'].includes(segment.order.status) ||
                          cooldowns[`${segment.order.id}-primary`]
                        }
                        className="rounded-full bg-teal-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {segment.order.status === 'pending' ? 'ACCEPT' : 'COMPLETE'}
                      </button>
                      {segment.showContinued ? (
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-200">
                          Continued…
                        </p>
                      ) : null}
                    </div>
                  ) : segment.showContinued ? (
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-rose-200">
                      Continued…
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div className="fixed right-6 top-6 z-50 flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-neutral-200 shadow-lg shadow-black/40 backdrop-blur">
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
        <Toast message={toastMessage} onClose={() => setToastMessage('')} />
      </div>
    </FullscreenAppLayout>
  );
}
