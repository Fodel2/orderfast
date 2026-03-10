import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { formatPrice } from '@/lib/orderDisplay';
import { getTodayLondonDate } from '@/lib/stockDate';
import { isOutOfStockEntity } from '@/lib/stockAvailability';
import { supabase } from '@/utils/supabaseClient';

type DashboardOrder = {
  id: string;
  short_order_number: number | null;
  status: string | null;
  total_price: number | null;
  delivery_fee: number | null;
  service_fee: number | null;
  created_at: string;
  kod_done_at?: string | null;
};

type DashboardOrderItem = {
  order_id: string;
  name: string | null;
  quantity: number | null;
};

type MenuStockRow = {
  stock_status?: string | null;
  stock_return_date?: string | null;
  available?: boolean | null;
  out_of_stock?: boolean | null;
};

type AddonStockRow = {
  stock_status?: string | null;
  stock_return_date?: string | null;
  available?: boolean | null;
};

type ActivityEvent = {
  id: string;
  title: string;
  timestamp: string;
  tone: 'success' | 'danger' | 'neutral';
};

const COMPLETED_STATUS = 'completed';
const CANCELLED_STATUS = 'cancelled';

const formatLongDate = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(date);

const formatHourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const getLondonDayBounds = (baseDate = new Date()) => {
  const londonDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(baseDate);
  const [year, month, day] = londonDate.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  return { start, end };
};

const getLondonWeekBounds = (baseDate = new Date()) => {
  const today = getLondonDayBounds(baseDate).start;
  const day = today.getUTCDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const weekStart = new Date(today);
  weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return { start: weekStart, end: weekEnd };
};

const getNetRevenue = (order: Pick<DashboardOrder, 'total_price' | 'delivery_fee' | 'service_fee'>) => {
  const totalPrice = Number(order.total_price) || 0;
  const deliveryFee = Number(order.delivery_fee) || 0;
  const serviceFee = Number(order.service_fee) || 0;
  return totalPrice - deliveryFee - serviceFee;
};

const formatRelativeTime = (timestamp: string) => {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function DashboardHomePage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueWeek, setRevenueWeek] = useState(0);
  const [ordersTodayCount, setOrdersTodayCount] = useState(0);
  const [avgOrderValueToday, setAvgOrderValueToday] = useState(0);

  const [activeOrders, setActiveOrders] = useState(0);
  const [preparedOrders, setPreparedOrders] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [outOfStockMenuItems, setOutOfStockMenuItems] = useState(0);
  const [outOfStockAddons, setOutOfStockAddons] = useState(0);

  const [ordersByHour, setOrdersByHour] = useState<Array<{ hour: number; count: number }>>([]);
  const [topItems, setTopItems] = useState<Array<{ name: string; quantity: number }>>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    let active = true;

    const loadRestaurant = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !active) {
        setLoading(false);
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!active) return;

      if (membershipError || !membership?.restaurant_id) {
        setError('Unable to load restaurant context.');
        setLoading(false);
        return;
      }

      setRestaurantId(membership.restaurant_id);
    };

    loadRestaurant();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      if (!restaurantId) return;
      setLoading(true);
      setError(null);

      const now = new Date();
      const { start: todayStart, end: todayEnd } = getLondonDayBounds(now);
      const { start: weekStart, end: weekEnd } = getLondonWeekBounds(now);
      const londonToday = getTodayLondonDate();

      const [
        weekCompletedOrdersResponse,
        todaysOrdersResponse,
        activeOrdersResponse,
        preparedOrdersResponse,
        menuStockResponse,
        addonGroupsResponse,
        recentOrdersResponse,
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('id,short_order_number,status,total_price,delivery_fee,service_fee,created_at,kod_done_at')
          .eq('restaurant_id', restaurantId)
          .eq('status', COMPLETED_STATUS)
          .gte('created_at', weekStart.toISOString())
          .lt('created_at', weekEnd.toISOString()),
        supabase
          .from('orders')
          .select('id,short_order_number,status,total_price,delivery_fee,service_fee,created_at,kod_done_at')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', todayStart.toISOString())
          .lt('created_at', todayEnd.toISOString()),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .not('status', 'in', `(${COMPLETED_STATUS},${CANCELLED_STATUS})`),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .not('status', 'eq', CANCELLED_STATUS)
          .not('kod_done_at', 'is', null)
          .gte('created_at', todayStart.toISOString())
          .lt('created_at', todayEnd.toISOString()),
        supabase
          .from('menu_items')
          .select('stock_status,stock_return_date,available,out_of_stock')
          .eq('restaurant_id', restaurantId)
          .is('archived_at', null),
        supabase
          .from('addon_groups')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .is('archived_at', null),
        supabase
          .from('orders')
          .select('id,short_order_number,status,created_at,kod_done_at')
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false })
          .limit(25),
      ]);

      if (!active) return;

      const hasCriticalError =
        weekCompletedOrdersResponse.error ||
        todaysOrdersResponse.error ||
        activeOrdersResponse.error ||
        preparedOrdersResponse.error ||
        menuStockResponse.error ||
        addonGroupsResponse.error ||
        recentOrdersResponse.error;

      if (hasCriticalError) {
        setError('Unable to load dashboard analytics right now.');
        setLoading(false);
        return;
      }

      const weekCompletedOrders = (weekCompletedOrdersResponse.data || []) as DashboardOrder[];
      const todaysOrders = (todaysOrdersResponse.data || []) as DashboardOrder[];
      const todaysCompletedOrders = todaysOrders.filter((order) => order.status === COMPLETED_STATUS);

      const todayRevenueValue = todaysCompletedOrders.reduce((sum, order) => sum + getNetRevenue(order), 0);
      const weekRevenueValue = weekCompletedOrders.reduce((sum, order) => sum + getNetRevenue(order), 0);

      setRevenueToday(todayRevenueValue);
      setRevenueWeek(weekRevenueValue);
      setOrdersTodayCount(todaysCompletedOrders.length);
      setCompletedToday(todaysCompletedOrders.length);
      setAvgOrderValueToday(
        todaysCompletedOrders.length ? todayRevenueValue / todaysCompletedOrders.length : 0
      );
      setActiveOrders(activeOrdersResponse.count || 0);
      setPreparedOrders(preparedOrdersResponse.count || 0);

      const menuStockRows = (menuStockResponse.data || []) as MenuStockRow[];
      const outMenuCount = menuStockRows.filter((item) => isOutOfStockEntity(item)).length;
      setOutOfStockMenuItems(outMenuCount);

      const addonGroupIds = (addonGroupsResponse.data || []).map((group) => group.id);
      let addonRows: AddonStockRow[] = [];
      if (addonGroupIds.length) {
        const { data, error: addonOptionsError } = await supabase
          .from('addon_options')
          .select('stock_status,stock_return_date,available')
          .in('group_id', addonGroupIds)
          .is('archived_at', null);

        if (!addonOptionsError && data) {
          addonRows = data as AddonStockRow[];
        }
      }

      if (!active) return;

      const outAddonCount = addonRows.filter((option) => isOutOfStockEntity(option)).length;
      setOutOfStockAddons(outAddonCount);

      const hourlyCounts = new Array<number>(24).fill(0);
      todaysOrders
        .filter((order) => order.status !== CANCELLED_STATUS)
        .forEach((order) => {
          const hour = Number(
            new Intl.DateTimeFormat('en-GB', {
              timeZone: 'Europe/London',
              hour: '2-digit',
              hourCycle: 'h23',
            }).format(new Date(order.created_at))
          );
          if (!Number.isNaN(hour)) hourlyCounts[hour] += 1;
        });
      setOrdersByHour(hourlyCounts.map((count, hour) => ({ hour, count })));

      const completedOrderIdsToday = todaysCompletedOrders.map((order) => order.id);
      if (completedOrderIdsToday.length) {
        const { data: orderItemsData, error: orderItemsError } = await supabase
          .from('order_items')
          .select('order_id,name,quantity')
          .in('order_id', completedOrderIdsToday);

        if (!orderItemsError && orderItemsData) {
          const quantities = new Map<string, number>();
          (orderItemsData as DashboardOrderItem[]).forEach((item) => {
            const name = (item.name || 'Unnamed item').trim() || 'Unnamed item';
            const quantity = Number(item.quantity) || 0;
            quantities.set(name, (quantities.get(name) || 0) + quantity);
          });
          const topItemsData = Array.from(quantities.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, quantity]) => ({ name, quantity }));
          setTopItems(topItemsData);
        } else {
          setTopItems([]);
        }
      } else {
        setTopItems([]);
      }

      const recentOrders = (recentOrdersResponse.data || []) as DashboardOrder[];
      const events: ActivityEvent[] = [];

      recentOrders.forEach((order) => {
        if (events.length >= 8) return;
        const orderLabel = order.short_order_number
          ? `#${String(order.short_order_number).padStart(4, '0')}`
          : `#${order.id.slice(0, 6)}`;

        if (order.status === COMPLETED_STATUS) {
          events.push({
            id: `${order.id}-completed`,
            title: `Order ${orderLabel} completed`,
            timestamp: order.created_at,
            tone: 'success',
          });
        } else if (order.status === CANCELLED_STATUS) {
          events.push({
            id: `${order.id}-cancelled`,
            title: `Order ${orderLabel} cancelled`,
            timestamp: order.created_at,
            tone: 'danger',
          });
        }

        if (order.kod_done_at && events.length < 8) {
          events.push({
            id: `${order.id}-prepared`,
            title: `Order ${orderLabel} marked prepared`,
            timestamp: order.kod_done_at,
            tone: 'neutral',
          });
        }
      });

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(events.slice(0, 8));
      setLoading(false);

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[dashboard-home] loaded', {
          restaurantId,
          londonToday,
        });
      }
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, [restaurantId]);

  const maxHourCount = useMemo(
    () => Math.max(1, ...ordersByHour.map((entry) => entry.count)),
    [ordersByHour]
  );

  return (
    <DashboardLayout>
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Orderfast Home</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">Operations Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                Live read-only analytics for today&apos;s service, weekly performance, and active floor
                operations.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-right shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Reporting date</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatLongDate(new Date())}</p>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Revenue Today', value: formatPrice(revenueToday), tone: 'text-slate-900' },
            { label: 'Revenue This Week', value: formatPrice(revenueWeek), tone: 'text-slate-900' },
            { label: 'Orders Today', value: String(ordersTodayCount), tone: 'text-slate-900' },
            {
              label: 'Average Order Value Today',
              value: formatPrice(avgOrderValueToday),
              tone: 'text-slate-900',
            },
          ].map((metric) => (
            <article
              key={metric.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
              <p className={`mt-3 text-3xl font-semibold ${metric.tone}`}>{loading ? '—' : metric.value}</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Active Orders', value: activeOrders },
            { label: 'Prepared Orders', value: preparedOrders },
            { label: 'Completed Today', value: completedToday },
            { label: 'Out of Stock', value: outOfStockMenuItems + outOfStockAddons },
          ].map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? '—' : metric.value}</p>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <article className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Busy Times</h2>
                <p className="text-sm text-slate-500">Orders by hour today (Europe/London).</p>
              </div>
            </div>

            {ordersByHour.every((entry) => entry.count === 0) ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                No orders yet today. Hourly trend will appear once service starts.
              </div>
            ) : (
              <div className="grid grid-cols-12 items-end gap-2">
                {ordersByHour.filter((entry) => entry.hour >= 6 && entry.hour <= 23).map((entry) => (
                  <div key={entry.hour} className="flex flex-col items-center gap-2">
                    <span className="text-xs text-slate-500">{entry.count}</span>
                    <div className="flex h-40 w-full items-end">
                      <div
                        className="w-full rounded-t-md bg-slate-900/85"
                        style={{ height: `${Math.max((entry.count / maxHourCount) * 100, 4)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500">{formatHourLabel(entry.hour)}</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Stock Alerts</h2>
              <p className="text-sm text-slate-500">Current effective availability across menu and add-ons.</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Out of stock menu items</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? '—' : outOfStockMenuItems}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Unavailable add-ons</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{loading ? '—' : outOfStockAddons}</p>
              </div>
            </div>
            <Link
              href="/dashboard/menu-builder?tab=stock"
              className="mt-5 inline-flex rounded-xl border border-slate-900 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-900 hover:text-white"
            >
              Manage Stock
            </Link>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Top Selling Items Today</h2>
              <p className="text-sm text-slate-500">Based on completed orders only.</p>
            </div>
            {topItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No completed item sales yet today.
              </div>
            ) : (
              <ul className="space-y-3">
                {topItems.map((item, index) => (
                  <li
                    key={`${item.name}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {item.quantity} sold
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
              <p className="text-sm text-slate-500">Latest kitchen and order status updates.</p>
            </div>
            {recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No recent events to display.
              </div>
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((event) => (
                  <li key={event.id} className="flex items-start justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          event.tone === 'success'
                            ? 'bg-emerald-500'
                            : event.tone === 'danger'
                              ? 'bg-rose-500'
                              : 'bg-slate-400'
                        }`}
                      />
                      <p className="text-sm font-medium text-slate-900">{event.title}</p>
                    </div>
                    <span className="ml-3 whitespace-nowrap text-xs text-slate-500">
                      {formatRelativeTime(event.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </div>
    </DashboardLayout>
  );
}
