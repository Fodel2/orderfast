import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { supabase } from '../../utils/supabaseClient';
import { ChefHat } from 'lucide-react';
import OrderDetailsModal, { Order as OrderType } from '../../components/OrderDetailsModal';
import BreakModal from '../../components/BreakModal';
import BreakCountdown from '../../components/BreakCountdown';
import Toast from '@/components/Toast';
import { orderAlertSoundController } from '@/utils/orderAlertSoundController';
import { formatPrice, formatShortOrderNumber, formatStatusLabel } from '@/lib/orderDisplay';
import { getRandomOrderEmptyMessage } from '@/lib/orderEmptyState';
import { useRestaurantAvailability } from '@/hooks/useRestaurantAvailability';

const ACTIVE_STATUSES = [
  'pending',
  'accepted',
  'preparing',
  'delivering',
  'ready_to_collect',
];
const COMPLETE_ELIGIBLE_STATUSES = ['accepted', 'preparing', 'delivering', 'ready_to_collect'];

const isActiveStatus = (status: string | null | undefined) =>
  !!status && ACTIVE_STATUSES.includes(status);

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


interface TableSession {
  id: string;
  restaurant_id: string;
  table_number: number;
  status: 'open' | 'closed';
  opened_at: string;
}

type TableSessionSummary = {
  session: TableSession;
  outstandingTotal: number;
  orderCount: number;
};

interface Order {
  id: string;
  restaurant_id?: string;
  user_id?: string | null;
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
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [todayHours, setTodayHours] = useState<
    | { open_time: string | null; close_time: string | null; closed: boolean }
    | null
  >(null);
  const [toastMessage, setToastMessage] = useState('');
  const [openTableSessions, setOpenTableSessions] = useState<TableSessionSummary[]>([]);
  const [selectedTableSession, setSelectedTableSession] = useState<TableSessionSummary | null>(null);
  const [tableSessionOrders, setTableSessionOrders] = useState<Order[]>([]);
  const [tableActionLoading, setTableActionLoading] = useState(false);
  const pendingOrderIdsRef = useRef<Set<string>>(new Set());
  const isAlertPlayingRef = useRef(false);
  const autoAcceptBeepingRef = useRef(false);
  const acknowledgedOrderIdsRef = useRef<Set<string>>(new Set());
  const [flashingOrderIds, setFlashingOrderIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const isOrdersPage = router.pathname === '/dashboard/orders';
  const randomMessage = useMemo(() => getRandomOrderEmptyMessage(), []);
  const {
    isOpen,
    breakUntil,
    showBreakModal,
    setShowBreakModal,
    toggleOpen,
    startBreak,
    endBreak,
  } = useRestaurantAvailability(restaurantId);

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
    orderAlertSoundController.stop('Orders');
    isAlertPlayingRef.current = false;
  }, [isKioskDevice, isOrdersPage]);

  const startAlertLoop = useCallback(() => {
    if (!isOrdersPage || isKioskDevice()) return;
    if (pendingOrderIdsRef.current.size === 0) return;
    if (isAlertPlayingRef.current) return;
    orderAlertSoundController
      .playLoop('Orders')
      .then((played) => {
        isAlertPlayingRef.current = played;
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
    const wasLooping = isAlertPlayingRef.current;
    if (wasLooping) {
      stopAlertLoop();
    }
    orderAlertSoundController.playBeeps('Orders', {
      count: 5,
      intervalMs: 1000,
      onComplete: (wasLoopingBefore) => {
        autoAcceptBeepingRef.current = false;
        if (wasLoopingBefore && pendingOrderIdsRef.current.size > 0) {
          syncAlertLoop();
        }
      },
    });
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
          user_id,
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


  const fetchTableSessions = useCallback(async (rid: string) => {
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('table_sessions')
      .select('id,restaurant_id,table_number,status,opened_at')
      .eq('restaurant_id', rid)
      .eq('status', 'open')
      .order('opened_at', { ascending: true });

    if (sessionsError || !sessionsData?.length) {
      setOpenTableSessions([]);
      return;
    }

    const sessionIds = sessionsData.map((session) => session.id);
    const { data: sessionOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id,table_session_id,status,total_price')
      .in('table_session_id', sessionIds);

    if (ordersError) {
      console.error('[orders] failed to fetch table session orders', ordersError);
      setOpenTableSessions(
        (sessionsData as TableSession[]).map((session) => ({ session, outstandingTotal: 0, orderCount: 0 }))
      );
      return;
    }

    const summaryMap = new Map<string, { outstandingTotal: number; orderCount: number }>();
    ((sessionOrders || []) as Array<{ table_session_id: string | null; status: string | null; total_price: number | null }>).forEach((order) => {
      const sessionId = order.table_session_id;
      if (!sessionId) return;
      const current = summaryMap.get(sessionId) || { outstandingTotal: 0, orderCount: 0 };
      current.orderCount += 1;
      if (order.status !== 'cancelled' && order.status !== 'completed') {
        current.outstandingTotal += Number(order.total_price || 0);
      }
      summaryMap.set(sessionId, current);
    });

    setOpenTableSessions(
      (sessionsData as TableSession[]).map((session) => {
        const summary = summaryMap.get(session.id) || { outstandingTotal: 0, orderCount: 0 };
        return { session, ...summary };
      })
    );
  }, []);

  const loadTableSessionOrders = useCallback(async (sessionId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        restaurant_id,
        user_id,
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
      .eq('table_session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[orders] failed to load table session details', error);
      setTableSessionOrders([]);
      return;
    }

    setTableSessionOrders((data as Order[]) || []);
  }, []);

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

      if (ruError || !ruData) {
        if (ruError) console.error('Error loading restaurant', ruError);
        setLoading(false);
        return;
      }

      setRestaurantId(ruData.restaurant_id);
      await fetchTableSessions(ruData.restaurant_id);

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(
          `
          id,
          restaurant_id,
          user_id,
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

      if (!ordersError && ordersData) {
        setOrders(ordersData as Order[]);
        await fetchTableSessions(ruData.restaurant_id);
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
    return () => {
      orderAlertSoundController.stop('Orders');
    };
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
      if (!newRow) return;

      let scopedRow = newRow;
      if (!matchesRestaurant(scopedRow.restaurant_id)) {
        const hydratedScoped = await fetchOrderWithItems(scopedRow.id);
        if (!hydratedScoped || !matchesRestaurant(hydratedScoped.restaurant_id)) {
          console.debug('[orders] ignoring insert for different restaurant', {
            restaurantId,
            incoming: scopedRow?.restaurant_id,
          });
          return;
        }
        scopedRow = hydratedScoped;
      }

      if (scopedRow.status === 'pending') {
        pendingOrderIdsRef.current.add(scopedRow.id);
      } else {
        pendingOrderIdsRef.current.delete(scopedRow.id);
      }

      if (!isActiveStatus(scopedRow.status)) {
        syncAlertLoop();
        return;
      }

      const hydrated = (await hydrateOrder(scopedRow)) ?? {
        ...scopedRow,
        order_items: scopedRow.order_items ?? [],
      };
      if (!hydrated) {
        console.error('[orders] failed to hydrate inserted order', scopedRow.id);
        return;
      }

      setOrders((prev) => {
        if (prev.some((order) => order.id === hydrated.id)) {
          return prev;
        }
        return [hydrated, ...prev].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
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

  
  const refreshOrders = useCallback(
    async (activeRestaurantId: string) => {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(
          `
          id,
          restaurant_id,
          user_id,
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
        .eq('restaurant_id', activeRestaurantId)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false });

      if (!ordersError && ordersData) {
        setOrders(ordersData as Order[]);
        await fetchTableSessions(activeRestaurantId);
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
    },
    [fetchTableSessions, isAutoAcceptedOrder, syncAlertLoop]
  );

  const updateStatus = async (id: string, status: string) => {
    const targetOrder = orders.find((o) => o.id === id);
    if (status === 'accepted' && targetOrder?.status === 'accepted') {
      return;
    }
    const updatePayload: { status: string; accepted_at?: string | null } = { status };
    if (targetOrder?.accepted_at) {
      updatePayload.accepted_at = targetOrder.accepted_at;
    }

    const allowedStatuses =
      status === 'accepted'
        ? ['pending']
        : status === 'completed'
        ? COMPLETE_ELIGIBLE_STATUSES
        : ACTIVE_STATUSES;
    const { data, error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', id)
      .in('status', allowedStatuses)
      .select('id,restaurant_id,user_id,total_price');

    if (error) {
      console.error('[orders] failed to update order status', error);
      setToastMessage('Unable to update order');
      return;
    }

    if (!data || data.length === 0) {
      setToastMessage('Updated elsewhere');
      if (restaurantId) {
        await refreshOrders(restaurantId);
      }
      const refreshedOrder = await fetchOrderWithItems(id);
      setSelectedOrder(refreshedOrder ?? null);
      return;
    }

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

    if (status === 'completed' && data?.[0]) {
      await awardLoyaltyPointsForCompletedOrder(data[0] as Pick<Order, 'id' | 'restaurant_id' | 'user_id' | 'total_price'>);
    }
  };

  const awardLoyaltyPointsForCompletedOrder = useCallback(
    async (order: Pick<Order, 'id' | 'restaurant_id' | 'user_id' | 'total_price'>) => {
      if (!order.restaurant_id || !order.user_id || !order.total_price || order.total_price <= 0) return;

      const { data: existingEarn } = await supabase
        .from('loyalty_ledger')
        .select('id')
        .eq('restaurant_id', order.restaurant_id)
        .eq('ref_order_id', order.id)
        .eq('entry_type', 'earn')
        .limit(1);

      if (existingEarn && existingEarn.length > 0) return;

      const { data: config, error: configError } = await supabase
        .from('loyalty_config')
        .select('enabled,points_per_currency_unit')
        .eq('restaurant_id', order.restaurant_id)
        .maybeSingle();

      if (configError || !config?.enabled) return;

      const pointsPerPound = Math.max(1, Math.floor(Number(config.points_per_currency_unit || 1)));
      const spendInPounds = Number(order.total_price) / 100;
      const pointsToAward = Math.floor(spendInPounds * pointsPerPound);
      if (pointsToAward <= 0) return;

      const { error: insertError } = await supabase.from('loyalty_ledger').insert({
        restaurant_id: order.restaurant_id,
        customer_id: order.user_id,
        entry_type: 'earn',
        points: pointsToAward,
        currency_value: spendInPounds,
        ref_order_id: order.id,
        note: 'Order completed loyalty points',
      });

      if (insertError && process.env.NODE_ENV !== 'production') {
        console.error('[orders] failed to award loyalty points', insertError);
      }
    },
    []
  );

  const handleOpenOrder = useCallback(
    async (order: Order) => {
      try {
        const hydrated = await hydrateOrder(order);
        const fallback = {
          ...order,
          order_items: Array.isArray(order.order_items) ? order.order_items : [],
        };
        if (!hydrated && process.env.NODE_ENV !== 'production') {
          console.warn('[orders] unable to hydrate order before opening modal', {
            orderId: order.id,
            order_items: order.order_items,
          });
        }
        setSelectedOrder((hydrated ?? fallback) as Order);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[orders] failed to open order modal', error);
        }
        setSelectedOrder({
          ...order,
          order_items: Array.isArray(order.order_items) ? order.order_items : [],
        });
      }
    },
    [hydrateOrder]
  );

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


  const handleOpenTableSession = useCallback(
    async (summary: TableSessionSummary) => {
      setSelectedTableSession(summary);
      await loadTableSessionOrders(summary.session.id);
    },
    [loadTableSessionOrders]
  );

  const closeTableSession = useCallback(async () => {
    if (!selectedTableSession) return;
    setTableActionLoading(true);
    const sessionId = selectedTableSession.session.id;

    const { data: completedOrders, error: ordersError } = await supabase
      .from('orders')
      .update({ status: 'completed' })
      .eq('table_session_id', sessionId)
      .not('status', 'in', '(completed,cancelled)')
      .select('id,restaurant_id,user_id,total_price');

    if (ordersError) {
      setToastMessage('Failed to complete table orders.');
      setTableActionLoading(false);
      return;
    }

    await Promise.all(
      (completedOrders || []).map((order) =>
        awardLoyaltyPointsForCompletedOrder(order as Pick<Order, 'id' | 'restaurant_id' | 'user_id' | 'total_price'>)
      )
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error: sessionError } = await supabase
      .from('table_sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: session?.user?.id || null })
      .eq('id', sessionId)
      .eq('status', 'open');

    setTableActionLoading(false);

    if (sessionError) {
      setToastMessage('Failed to close table session.');
      return;
    }

    setToastMessage('Table closed and orders completed.');
    setSelectedTableSession(null);
    setTableSessionOrders([]);
    if (restaurantId) {
      await fetchTableSessions(restaurantId);
      await refreshOrders(restaurantId);
    }
  }, [awardLoyaltyPointsForCompletedOrder, fetchTableSessions, refreshOrders, restaurantId, selectedTableSession]);

  const cancelTableSession = useCallback(async () => {
    if (!selectedTableSession) return;
    setTableActionLoading(true);
    const sessionId = selectedTableSession.session.id;

    const { error: ordersError } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('table_session_id', sessionId)
      .in('status', ['pending', 'accepted']);

    if (ordersError) {
      setToastMessage('Failed to cancel active table orders.');
      setTableActionLoading(false);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error: sessionError } = await supabase
      .from('table_sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: session?.user?.id || null })
      .eq('id', sessionId)
      .eq('status', 'open');

    setTableActionLoading(false);

    if (sessionError) {
      setToastMessage('Failed to close table session.');
      return;
    }

    setToastMessage('Table session cancelled.');
    setSelectedTableSession(null);
    setTableSessionOrders([]);
    if (restaurantId) {
      await fetchTableSessions(restaurantId);
      await refreshOrders(restaurantId);
    }
  }, [awardLoyaltyPointsForCompletedOrder, fetchTableSessions, refreshOrders, restaurantId, selectedTableSession]);

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
      <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Open Tables</h2>
          <span className="text-sm text-gray-500">{openTableSessions.length} open</span>
        </div>
        {openTableSessions.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {openTableSessions.map((summary) => (
              <button
                key={summary.session.id}
                onClick={() => void handleOpenTableSession(summary)}
                className="rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50"
              >
                <p className="font-semibold text-gray-900">Table {summary.session.table_number}</p>
                <p className="text-xs text-gray-500">Opened {new Date(summary.session.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="mt-2 text-sm text-gray-600">Outstanding: {formatPrice(summary.outstandingTotal)}</p>
                <p className="text-sm text-gray-600">Orders: {summary.orderCount}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No open table sessions.</p>
        )}
      </section>
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
                onClick={() => handleOpenOrder(o)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">#
                      {formatShortOrderNumber(o.short_order_number)}
                    </h3>
                    <p className="text-sm text-gray-500">{o.customer_name || 'Guest'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(o.total_price)}</p>
                    <p className="text-sm">{formatStatusLabel(o.status)}</p>
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
      {selectedTableSession ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Table {selectedTableSession.session.table_number} summary</h3>
                <p className="text-sm text-gray-500">Opened {new Date(selectedTableSession.session.opened_at).toLocaleString()}</p>
              </div>
              <button className="rounded border px-2 py-1 text-sm" onClick={() => { setSelectedTableSession(null); setTableSessionOrders([]); }}>
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {tableSessionOrders.map((order) => (
                <div key={order.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">#{formatShortOrderNumber(order.short_order_number)}</p>
                    <p className="text-sm text-gray-600">{formatStatusLabel(order.status)}</p>
                  </div>
                  <p className="text-sm text-gray-600">{(order.order_items || []).map((item) => `${item.quantity}× ${item.name}`).join(', ') || 'No items'}</p>
                  <p className="mt-1 text-sm font-semibold">{formatPrice(order.total_price)}</p>
                </div>
              ))}
              {!tableSessionOrders.length ? <p className="text-sm text-gray-500">No orders linked to this table session.</p> : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                disabled={tableActionLoading}
                onClick={() => void closeTableSession()}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Close & Take Payment
              </button>
              <button
                disabled={tableActionLoading}
                onClick={() => {
                  const confirmed = window.confirm('Cancel this table session and cancel pending/accepted orders?');
                  if (confirmed) void cancelTableSession();
                }}
                className="rounded border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
              >
                Cancel Session
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
