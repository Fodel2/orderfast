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
};

const NOTE_LINE_LENGTH = 38;
const CARD_VERTICAL_PADDING = 40;
const HEADER_RESERVED_PX = 88;
const FOOTER_RESERVED_PX = 72;
const BODY_LINE_HEIGHT = 22;
const TOP_CONTROLS_HEIGHT = 72;
const CARD_WIDTH_BASE = 360;
const CARD_GAP = 16;
const NOTES_HEADER_LINES = 2;
const ITEM_SPACER_LINES = 1;
const ACTIVE_STATUSES = ['pending', 'accepted', 'preparing', 'delivering', 'ready_to_collect'];
const TERMINAL_STATUSES = ['completed', 'cancelled'];

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
  String(order.short_order_number ?? 0).padStart(4, '0');

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
  const audioContextRef = useRef<AudioContext | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [lastFetchFailed, setLastFetchFailed] = useState(false);
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
      const availableHeight = gridRef.current?.clientHeight ?? window.innerHeight;
      const nextCardHeight = Math.max(320, availableHeight);
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
  const orderedSegments = useMemo(() => {
    const segments: OrderSegment[] = [];
    orders.forEach((order) => {
      segments.push(...buildOrderSegments(order, maxBodyLines, noteLineLength));
    });
    return segments;
  }, [orders, maxBodyLines, noteLineLength]);
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
    orders.forEach((order, index) => {
      map.set(order.id, index);
    });
    return map;
  }, [orders]);
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

  return (
    <FullscreenAppLayout
      promptTitle="Tap to enter fullscreen"
      promptDescription="Kitchen Display works best in fullscreen mode."
    >
      <div className="h-screen w-full overflow-hidden bg-neutral-950 text-white">
        <div className="flex h-full flex-col gap-6 overflow-hidden px-3 py-6 sm:px-4 lg:px-6">
          <div
            className="flex w-full flex-none items-center justify-end"
            style={{ height: `${TOP_CONTROLS_HEIGHT}px` }}
          >
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-neutral-200 shadow-lg shadow-black/40 backdrop-blur">
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
          <div className="flex w-full flex-1 flex-col space-y-4 overflow-hidden">
            {orders.length === 0 && !isFetching ? (
              <p className="text-center text-base text-neutral-400">
                No active orders yet.
              </p>
            ) : null}
            <div
              ref={gridRef}
              className="flex h-full flex-1 flex-nowrap gap-4 overflow-hidden overscroll-none"
              style={{ height: `${cardHeight}px` }}
            >
              {orderSegments.map((segment) => (
                <div
                  key={`${segment.order.id}-${segment.segmentIndex}`}
                  className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 p-5 shadow-lg shadow-black/20 ${getTintClass(
                    segment.order.id
                  )}`}
                  style={{ width: `${cardWidth}px`, height: `${cardHeight}px` }}
                >
                  <div className="flex h-[88px] flex-wrap items-center justify-between gap-3">
                    {segment.segmentIndex === 1 ? (
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
                          <p
                            className={`text-xl font-semibold ${getPrimaryTextClass(
                              segment.order.id
                            )}`}
                          >
                            {formatElapsed(segment.order.created_at)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <p
                          className={`text-[10px] font-semibold uppercase tracking-[0.3em] ${getContinuedTextClass(
                            segment.order.id
                          )}`}
                        >
                          Continued ({segment.segmentIndex}/{segment.totalSegments})
                        </p>
                        <p className={`text-lg font-semibold ${getPrimaryTextClass(segment.order.id)}`}>
                          {formatElapsed(segment.order.created_at)}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="mt-4 flex-1 overflow-hidden">
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
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Toast message={toastMessage} onClose={() => setToastMessage('')} />
      </div>
    </FullscreenAppLayout>
  );
}
