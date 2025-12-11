import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { supabase } from '../../utils/supabaseClient';
import { ChefHat } from 'lucide-react';
import OrderDetailsModal, { Order as OrderType } from '../../components/OrderDetailsModal';
import BreakModal from '../../components/BreakModal';
import BreakCountdown from '../../components/BreakCountdown';
import { ORDER_ALERT_AUDIO } from '@/audio/orderAlertBase64';
import { formatPrice } from '@/lib/orderDisplay';

const ACTIVE_STATUSES = [
  'pending',
  'accepted',
  'preparing',
  'delivering',
  'ready_to_collect',
];

const isActiveStatus = (status: string | null | undefined) =>
  !!status && ACTIVE_STATUSES.includes(status);

const EMPTY_MESSAGES = [
  'No orders right now… shall we check the cleaning logs?',
  'All quiet on the frying pan front.',
  'Your ticket printer is sleeping. Shhh...',
  'Kitchen\u2019s calm—dare we restock the napkins?',
  'Nothing cooking yet — maybe time for a tea?',
  'Still no dings. The bell is getting lonely.',
  'No orders, no chaos. Suspiciously peaceful.',
  'Perfect time to clean the sauce bottles again!',
  'No orders… did someone forget to open?',
];

interface OrderAddon {
  id: number;
  option_id: number;
  name: string;
  price: number;
  quantity: number;
}

interface OrderItem {
  id: number;
  item_id: number;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
  order_addons: OrderAddon[];
}

interface Order {
  id: string;
  restaurant_id?: string;
  short_order_number: number | null;
  source?: string | null;
  order_type: 'delivery' | 'collection' | 'kiosk' | string;
  customer_name: string | null;
  phone_number: string | null;
  delivery_address: any;
  scheduled_for: string | null;
  customer_notes: string | null;
  status: string;
  total_price: number | null;
  created_at: string;
  accepted_at?: string | null;
  order_items: OrderItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [now, setNow] = useState(Date.now());
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [breakUntil, setBreakUntil] = useState<string | null>(null);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [todayHours, setTodayHours] = useState<
    | { open_time: string | null; close_time: string | null; closed: boolean }
    | null
  >(null);
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingOrderIdsRef = useRef<Set<string>>(new Set());
  const isAlertPlayingRef = useRef(false);
  const autoAcceptBeepingRef = useRef(false);
  const acknowledgedOrderIdsRef = useRef<Set<string>>(new Set());
  const [flashingOrderIds, setFlashingOrderIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const isOrdersPage = router.pathname === '/dashboard/orders';
  const randomMessage = useMemo(
    () =>
      EMPTY_MESSAGES[
        Math.floor(Math.random() * EMPTY_MESSAGES.length)
      ],
    []
  );

  const isKioskDevice = useCallback(
    () => router.pathname.startsWith('/kiosk/'),
    [router.pathname]
  );

  const isAutoAcceptedOrder = useCallback(
    (order: Order) =>
      !!order.accepted_at &&
      order.status !== 'pending' &&
      (order.order_type === 'kiosk' || order.source === 'kiosk' || order.source === 'app'),
    []
  );

  const matchesRestaurant = useCallback(
    (value: string | null | undefined) =>
      !!value && !!restaurantId && String(value) === String(restaurantId),
    [restaurantId]
  );

  const stopAlertLoop = useCallback(() => {
    if (!isOrdersPage || isKioskDevice()) return;
    const audio = alertAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    isAlertPlayingRef.current = false;
  }, [isKioskDevice, isOrdersPage]);

  const startAlertLoop = useCallback(() => {
    if (!isOrdersPage || isKioskDevice()) return;
    if (pendingOrderIdsRef.current.size === 0) return;
    let audio = alertAudioRef.current;
    if (!audio) {
      audio = new Audio(ORDER_ALERT_AUDIO);
      audio.loop = true;
      alertAudioRef.current = audio;
    }

    if (isAlertPlayingRef.current) return;

    audio.loop = true;
    audio
      .play()
      .then(() => {
        isAlertPlayingRef.current = true;
      })
      .catch((err) => console.error('[orders] audio playback failed', err));
  }, [isKioskDevice, isOrdersPage]);

  const syncAlertLoop = useCallback(() => {
    if (!isOrdersPage || isKioskDevice()) return;
    if (pendingOrderIdsRef.current.size > 0) {
      startAlertLoop();
    } else {
      stopAlertLoop();
    }
  }, [isKioskDevice, isOrdersPage, startAlertLoop, stopAlertLoop]);

  const playAutoAcceptBeeps = useCallback(async () => {
    if (!isOrdersPage || isKioskDevice() || autoAcceptBeepingRef.current) return;
    autoAcceptBeepingRef.current = true;
    let audio = alertAudioRef.current;
    if (!audio) {
      audio = new Audio(ORDER_ALERT_AUDIO);
      alertAudioRef.current = audio;
    }
    const wasLooping = isAlertPlayingRef.current;
    if (wasLooping) {
      stopAlertLoop();
    }
    audio.loop = false;

    const playBeep = () => {
      try {
        audio.pause();
        audio.currentTime = 0;
        void audio.play();
      } catch (err) {
        console.error('[orders] auto-accept alert playback failed', err);
      }
    };

    playBeep();
    for (let i = 1; i < 5; i++) {
      window.setTimeout(playBeep, i * 1000);
    }

    window.setTimeout(() => {
      autoAcceptBeepingRef.current = false;
      if (wasLooping && pendingOrderIdsRef.current.size > 0) {
        syncAlertLoop();
      }
    }, 5000);
  }, [autoAcceptBeepingRef, isKioskDevice, isOrdersPage, stopAlertLoop, syncAlertLoop]);

  const startAutoFlashForOrder = useCallback((orderId: string) => {
    setFlashingOrderIds((prev) => {
      if (prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });
  }, []);

  const clearFlashForOrder = useCallback((orderId: string) => {
    setFlashingOrderIds((prev) => {
      if (!prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  }, []);

  const trackAutoAcceptedOrder = useCallback(
    (order: Order) => {
      if (isAutoAcceptedOrder(order) && !acknowledgedOrderIdsRef.current.has(order.id)) {
        startAutoFlashForOrder(order.id);
      } else {
        clearFlashForOrder(order.id);
      }
    },
    [clearFlashForOrder, isAutoAcceptedOrder, startAutoFlashForOrder]
  );

  const acknowledgeOrder = useCallback(
    (orderId: string | null) => {
      if (!orderId) return;
      acknowledgedOrderIdsRef.current.add(orderId);
      clearFlashForOrder(orderId);
    },
    [clearFlashForOrder]
  );

  const fetchOrderWithItems = useCallback(
    async (orderId: string) => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          id,
          restaurant_id,
          short_order_number,
          source,
          order_type,
          customer_name,
          phone_number,
          delivery_address,
          scheduled_for,
          customer_notes,
          status,
          total_price,
          created_at,
          accepted_at,
          order_items(
            id,
            item_id,
            name,
            price,
            quantity,
            notes,
            order_addons(id,option_id,name,price,quantity)
          )
        `
        )
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('[orders] failed to fetch order', { orderId, error });
        return null;
      }

      return data as Order;
    },
    []
  );

  const hydrateOrder = useCallback(
    async (order: Order) => {
      if (order.order_items && order.order_items.length > 0) {
        return order;
      }
      return fetchOrderWithItems(order.id);
    },
    [fetchOrderWithItems]
  );

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      const { data: ruData, error: ruError } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      console.log('restaurant_users result', { ruData, ruError });

      if (ruError || !ruData) {
        if (ruError) console.error('Error loading restaurant', ruError);
        setLoading(false);
        return;
      }

      setRestaurantId(ruData.restaurant_id);

      const { data: restData, error: restError } = await supabase
        .from('restaurants')
        .select('is_open, break_until')
        .eq('id', ruData.restaurant_id)
        .single();
      if (!restError && restData) {
        setIsOpen(restData.is_open);
        setBreakUntil(restData.break_until);
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(
          `
          id,
          restaurant_id,
          short_order_number,
          source,
          order_type,
          customer_name,
          phone_number,
          delivery_address,
          scheduled_for,
          customer_notes,
          status,
          total_price,
          created_at,
          accepted_at,
          order_items(
            id,
            item_id,
            name,
            price,
            quantity,
            notes,
            order_addons(id,option_id,name,price,quantity)
          )
        `
        )
        .eq('restaurant_id', ruData.restaurant_id)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false });

      console.log('orders query result', { ordersData, ordersError });

      if (!ordersError && ordersData) {
        setOrders(ordersData as Order[]);
        const pending = new Set<string>();
        const flashing = new Set<string>();
        (ordersData as Order[]).forEach((o) => {
          if (o.status === 'pending') {
            pending.add(o.id);
          }
          if (isAutoAcceptedOrder(o)) {
            flashing.add(o.id);
          }
        });
        pendingOrderIdsRef.current = pending;
        setFlashingOrderIds(flashing);
        syncAlertLoop();
      } else if (ordersError) {
        console.error('Error fetching orders', ordersError);
      }

      // Count out-of-stock menu items
      const { count: menuCount } = await supabase
        .from('menu_items')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', ruData.restaurant_id)
        .or('available.eq.false,stock_status.neq.in_stock');

      let addonCount = 0;
      const { data: groups } = await supabase
        .from('addon_groups')
        .select('id')
        .eq('restaurant_id', ruData.restaurant_id)
        .is('archived_at', null);
      if (groups && groups.length) {
        const { count: ac } = await supabase
          .from('addon_options')
          .select('*', { count: 'exact', head: true })
          .in('group_id', groups.map((g) => g.id))
          .is('archived_at', null)
          .or('available.eq.false,stock_status.neq.in_stock');
        addonCount = ac || 0;
      }
      setOutOfStockCount((menuCount || 0) + addonCount);

      setLoading(false);
    };

    load();
  }, [isAutoAcceptedOrder, router, syncAlertLoop]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!restaurantId || !isOrdersPage) return;

    const loadHours = async () => {
      const today = new Date().getDay();
      const { data } = await supabase
        .from('opening_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('day_of_week', today)
        .maybeSingle();
      if (data) {
        setTodayHours({
          open_time: data.open_time,
          close_time: data.close_time,
          closed: data.is_closed,
        });
      }
    };

    loadHours();

    const channel = supabase
      .channel('hours-' + restaurantId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'opening_hours',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => loadHours()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !isOrdersPage) return;

    const handleInsert = async (
      payload: RealtimePostgresChangesPayload<Order>
    ) => {
      if (!isOrdersPage) return;
      const newRow = payload.new as Order;
      if (!newRow || !matchesRestaurant(newRow.restaurant_id)) {
        console.debug('[orders] ignoring insert for different restaurant', {
          restaurantId,
          incoming: newRow?.restaurant_id,
        });
        return;
      }

      if (newRow.status === 'pending') {
        pendingOrderIdsRef.current.add(newRow.id);
      } else {
        pendingOrderIdsRef.current.delete(newRow.id);
      }

      if (!isActiveStatus(newRow.status)) {
        syncAlertLoop();
        return;
      }

      const hydrated = (await hydrateOrder(newRow)) ?? {
        ...newRow,
        order_items: newRow.order_items ?? [],
      };
      if (!hydrated) {
        console.error('[orders] failed to hydrate inserted order', newRow.id);
        return;
      }

      setOrders((prev) => {
        const remaining = prev.filter((o) => o.id !== hydrated.id);
        return [hydrated, ...remaining];
      });

      if (isAutoAcceptedOrder(hydrated)) {
        trackAutoAcceptedOrder(hydrated);
        await playAutoAcceptBeeps();
      } else {
        trackAutoAcceptedOrder(hydrated);
      }

      syncAlertLoop();
    };

    const handleUpdate = async (
      payload: RealtimePostgresChangesPayload<Order>
    ) => {
      if (!isOrdersPage) return;
      const updated = payload.new as Order;
      const oldStatus = (payload.old as { status?: string } | null)?.status;
      if (!updated || !matchesRestaurant(updated.restaurant_id)) {
        console.debug('[orders] ignoring update for different restaurant', {
          restaurantId,
          incoming: updated?.restaurant_id,
        });
        return;
      }

      if (updated.status === 'pending') {
        pendingOrderIdsRef.current.add(updated.id);
      } else {
        pendingOrderIdsRef.current.delete(updated.id);
      }

      if (!isActiveStatus(updated.status)) {
        setOrders((prev) => prev.filter((o) => o.id !== updated.id));
        clearFlashForOrder(updated.id);
        syncAlertLoop();
        return;
      }

      let mergedOrder: Order | null = null;
      setOrders((prev) => {
        const existing = prev.find((o) => o.id === updated.id);
        if (existing) {
          const mergedItems =
            updated.order_items && updated.order_items.length > 0
              ? updated.order_items
              : existing.order_items;
          mergedOrder = { ...existing, ...updated, order_items: mergedItems };
          const others = prev.filter((o) => o.id !== updated.id);
          return [mergedOrder, ...others];
        }
        return prev;
      });

      if (!mergedOrder) {
        const hydrated = (await hydrateOrder(updated)) ?? {
          ...updated,
          order_items: updated.order_items ?? [],
        };
        if (hydrated) {
          setOrders((prev) => {
            const remaining = prev.filter((o) => o.id !== hydrated.id);
            return [hydrated, ...remaining];
          });
        } else {
          console.error('[orders] failed to hydrate updated order', updated.id);
        }
      }

      const merged = mergedOrder ?? (updated as Order);
      if (merged) {
        if (isAutoAcceptedOrder(merged as Order) && oldStatus !== 'pending') {
          trackAutoAcceptedOrder(merged as Order);
        } else {
          clearFlashForOrder(merged.id);
        }
      }

      syncAlertLoop();
    };

    const channelName = `orders-realtime-${restaurantId}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          try {
            await handleInsert(payload as RealtimePostgresChangesPayload<Order>);
          } catch (err) {
            console.error('[orders] failed to handle realtime insert', err, payload);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          try {
            await handleUpdate(payload as RealtimePostgresChangesPayload<Order>);
          } catch (err) {
            console.error('[orders] failed to handle realtime update', err, payload);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug(`[orders] realtime subscribed for restaurant ${restaurantId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(
            `[orders] realtime channel error on ${channelName} for restaurant ${restaurantId}. This may be a permissions or schema issue.`
          );
        } else if (status === 'TIMED_OUT') {
          console.error(
            `[orders] realtime channel timed out on ${channelName}; orders will not update live until reloaded.`
          );
        } else if (status === 'CLOSED') {
          console.warn(`[orders] realtime channel ${channelName} closed unexpectedly.`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      pendingOrderIdsRef.current.clear();
      acknowledgedOrderIdsRef.current.clear();
      setFlashingOrderIds(new Set());
      stopAlertLoop();
    };
  }, [
    hydrateOrder,
    isOrdersPage,
    matchesRestaurant,
    playAutoAcceptBeeps,
    clearFlashForOrder,
    trackAutoAcceptedOrder,
    restaurantId,
    stopAlertLoop,
    syncAlertLoop,
  ]);

  // Automatically end break when time passes
  useEffect(() => {
    if (!breakUntil) return;
    if (new Date(breakUntil).getTime() <= Date.now()) {
      endBreak();
      return;
    }
    const timer = setInterval(() => {
      if (breakUntil && new Date(breakUntil).getTime() <= Date.now()) {
        endBreak();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [breakUntil]);

  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel('restaurant-' + restaurantId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `id=eq.${restaurantId}`,
        },
        (payload) => {
          const newRow: any = payload.new;
          setIsOpen(newRow.is_open);
          setBreakUntil(newRow.break_until);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);


  const updateStatus = async (id: string, status: string) => {
    const targetOrder = orders.find((o) => o.id === id);
    const updatePayload: { status: string; accepted_at?: string | null } = { status };
    if (targetOrder?.accepted_at) {
      updatePayload.accepted_at = targetOrder.accepted_at;
    }

    await supabase.from('orders').update(updatePayload).eq('id', id);
    if (status === 'pending') {
      pendingOrderIdsRef.current.add(id);
    } else {
      pendingOrderIdsRef.current.delete(id);
    }
    syncAlertLoop();
    setOrders((prev) => {
      const updatedOrders = prev.map((o) =>
        o.id === id ? { ...o, status, accepted_at: targetOrder?.accepted_at ?? null } : o
      );
      if (ACTIVE_STATUSES.includes(status)) {
        return updatedOrders;
      }
      return updatedOrders.filter((o) => o.id !== id);
    });
    setSelectedOrder((prev) =>
      prev && prev.id === id
        ? { ...prev, status, accepted_at: targetOrder?.accepted_at ?? null }
        : prev
    );

    const updatedOrder = targetOrder
      ? ({ ...targetOrder, status, accepted_at: targetOrder.accepted_at ?? null } as Order)
      : null;
    if (updatedOrder) {
      trackAutoAcceptedOrder(updatedOrder);
    } else {
      clearFlashForOrder(id);
    }
  };

  const toggleOpen = async () => {
    if (!restaurantId || isOpen === null) return;
    if (!isOpen && breakUntil && new Date(breakUntil).getTime() > Date.now()) {
      await endBreak();
      return;
    }
    const newState = !isOpen;
    const { error } = await supabase
      .from('restaurants')
      .update({ is_open: newState })
      .eq('id', restaurantId);
    if (!error) {
      setIsOpen(newState);
    }
  };

  const startBreak = async (mins: number) => {
    if (!restaurantId) return;
    const until = new Date(Date.now() + mins * 60000).toISOString();
    const { error } = await supabase
      .from('restaurants')
      .update({ is_open: false, break_until: until })
      .eq('id', restaurantId);
    if (!error) {
      setIsOpen(false);
      setBreakUntil(until);
    }
  };

  const endBreak = async () => {
    if (!restaurantId) return;
    const { error } = await supabase
      .from('restaurants')
      .update({ is_open: true, break_until: null })
      .eq('id', restaurantId);
    if (!error) {
      setIsOpen(true);
      setBreakUntil(null);
    }
  };

  const formatTime = (t: string | null) => {
    if (!t) return '';
    const d = new Date(`1970-01-01T${t}`);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };


  const isOpenNow = () => {
    if (!todayHours || todayHours.closed || !todayHours.open_time || !todayHours.close_time) return false;
    const nowDate = new Date();
    const [oh, om] = todayHours.open_time.split(':').map(Number);
    const [ch, cm] = todayHours.close_time.split(':').map(Number);
    const openDate = new Date();
    openDate.setHours(oh, om, 0, 0);
    const closeDate = new Date();
    closeDate.setHours(ch, cm, 0, 0);
    return nowDate >= openDate && nowDate <= closeDate;
  };

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="flex flex-col flex-1 h-full">
        <h1 className="text-2xl font-bold mb-2">Live Orders</h1>
      {breakUntil && new Date(breakUntil).getTime() > now && (
        <BreakCountdown breakUntil={breakUntil} onEnd={endBreak} />
      )}
      {outOfStockCount > 0 && (
        <div
          onClick={() => router.push('/dashboard/menu-builder?tab=stock')}
          className="mb-2 cursor-pointer rounded bg-orange-600 px-2 py-1 text-white text-xs"
        >
          {outOfStockCount} item{outOfStockCount === 1 ? '' : 's'} currently out of stock
        </div>
      )}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {todayHours ? (
            todayHours.closed ? (
              <span>Closed Today</span>
            ) : (
              <>
                <span>
                  Open Today: {formatTime(todayHours.open_time)} –{' '}
                  {formatTime(todayHours.close_time)}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-semibold ${isOpenNow() ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                >
                  {isOpenNow() ? 'Open Now' : 'Closed Now'}
                </span>
              </>
            )
          ) : (
            <span>Loading hours...</span>
          )}
        </div>
        {isOpen !== null && (
          <div className="relative flex items-center space-x-2">
            <button
              onClick={toggleOpen}
              className={`px-2 py-1 rounded text-white text-sm ${isOpen ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {isOpen ? 'Close Now' : 'Open Now'}
            </button>
            {isOpen && (
              <button
                onClick={() => setShowBreakModal(true)}
                className="px-2 py-1 rounded text-white text-sm bg-blue-600 hover:bg-blue-700"
              >
                Take a Break
              </button>
            )}
          </div>
        )}
      </div>
      {orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((o) => {
            const age = now - new Date(o.created_at).getTime();
            const shouldFlashAuto = flashingOrderIds.has(o.id);
            const highlight =
              o.status === 'pending'
                ? age < 120000
                  ? 'bg-red-100 animate-pulse'
                  : 'bg-red-300 animate-pulse'
                : shouldFlashAuto
                  ? 'bg-red-100 animate-pulse'
                  : 'bg-white';
            return (
              <div
                key={o.id}
                className={`${highlight} border rounded-lg shadow-md p-4 cursor-pointer`}
                onClick={() => setSelectedOrder(o)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">#
                      {String(o.short_order_number ?? 0).padStart(4, '0')}
                    </h3>
                    <p className="text-sm text-gray-500">{o.customer_name || 'Guest'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(o.total_price)}</p>
                    <p className="text-sm capitalize">{o.status}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-center">
          <div className="flex flex-col items-center gap-4 p-8 border rounded-lg shadow-sm">
            <ChefHat className="text-gray-300 text-7xl" />
            <p className="text-gray-500">{randomMessage}</p>
          </div>
        </div>
      )}
      </div>
      <BreakModal
        show={showBreakModal}
        onClose={() => setShowBreakModal(false)}
        onSelect={startBreak}
      />
      <OrderDetailsModal
        order={selectedOrder as OrderType | null}
        onClose={() => {
          if (selectedOrder) {
            acknowledgeOrder(selectedOrder.id);
          }
          setSelectedOrder(null);
        }}
        onUpdateStatus={updateStatus}
      />
    </DashboardLayout>
  );
}
