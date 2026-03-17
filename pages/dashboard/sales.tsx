import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { formatPrice } from '@/lib/orderDisplay';
import { supabase } from '@/utils/supabaseClient';

type DatePreset = 'today' | 'last_7_days' | 'this_month';

interface SalesOrderRow {
  id: string;
  total_price: number | null;
  source: string | null;
}

interface SalesRefundRow {
  order_id: string;
  refund_amount: number | null;
}

interface SalesItemRow {
  name: string | null;
  quantity: number | null;
  price: number | null;
}

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  last_7_days: 'Last 7 Days',
  this_month: 'This Month',
};

const getDateRangeForPreset = (preset: DatePreset) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'today') {
    return { start: todayStart, end: null as Date | null };
  }

  if (preset === 'last_7_days') {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 6);
    return { start, end: null as Date | null };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end: null as Date | null };
};

export default function SalesPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [refundTotal, setRefundTotal] = useState(0);
  const [salesBySource, setSalesBySource] = useState<
    Array<{ source: string; orderCount: number; grossRevenue: number }>
  >([]);
  const [topItems, setTopItems] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);

  useEffect(() => {
    let active = true;

    const loadRestaurantId = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !active) {
        setRestaurantId(null);
        setLoading(false);
        return;
      }

      const { data: membership, error } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!active) return;

      if (error || !membership?.restaurant_id) {
        setRestaurantId(null);
        setErrorMessage('Unable to resolve your restaurant.');
        setLoading(false);
        return;
      }

      setRestaurantId(String(membership.restaurant_id));
    };

    loadRestaurantId();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!restaurantId) return;

    let active = true;

    const loadSalesData = async () => {
      setLoading(true);
      setErrorMessage(null);

      const { start, end } = getDateRangeForPreset(datePreset);

      let orderQuery = supabase
        .from('orders')
        .select('id,total_price,source')
        .eq('restaurant_id', restaurantId)
        .neq('status', 'rejected')
        .neq('status', 'cancelled')
        .gte('created_at', start.toISOString());

      if (end) {
        orderQuery = orderQuery.lte('created_at', end.toISOString());
      }

      const { data: orderRows, error: ordersError } = await orderQuery;

      if (!active) return;

      if (ordersError) {
        setErrorMessage('Failed to load sales data.');
        setOrders([]);
        setRefundTotal(0);
        setSalesBySource([]);
        setTopItems([]);
        setLoading(false);
        return;
      }

      const includedOrders = (orderRows ?? []) as SalesOrderRow[];
      setOrders(includedOrders);

      if (includedOrders.length === 0) {
        setRefundTotal(0);
        setSalesBySource([]);
        setTopItems([]);
        setLoading(false);
        return;
      }

      const orderIds = includedOrders.map((order) => order.id);

      const sourceMap = includedOrders.reduce<Map<string, { orderCount: number; grossRevenue: number }>>((acc, order) => {
        const source = (order.source || 'Unknown').trim() || 'Unknown';
        const gross = Number(order.total_price) || 0;
        const current = acc.get(source) || { orderCount: 0, grossRevenue: 0 };
        current.orderCount += 1;
        current.grossRevenue += gross;
        acc.set(source, current);
        return acc;
      }, new Map());

      const sourceRows = Array.from(sourceMap.entries())
        .map(([source, summary]) => ({ source, ...summary }))
        .sort((a, b) => b.grossRevenue - a.grossRevenue);

      setSalesBySource(sourceRows);

      const { data: refundRows, error: refundsError } = await supabase
        .from('order_refunds')
        .select('order_id,refund_amount')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'succeeded')
        .in('order_id', orderIds);

      if (!active) return;

      if (refundsError) {
        setRefundTotal(0);
      } else {
        const total = ((refundRows ?? []) as SalesRefundRow[]).reduce(
          (sum, refund) => sum + (Number(refund.refund_amount) || 0),
          0
        );
        setRefundTotal(total);
      }

      const { data: itemRows, error: itemsError } = await supabase
        .from('order_items')
        .select('name,quantity,price')
        .in('order_id', orderIds);

      if (!active) return;

      if (itemsError) {
        setTopItems([]);
      } else {
        const itemMap = ((itemRows ?? []) as SalesItemRow[]).reduce<
          Map<string, { quantity: number; revenue: number }>
        >((acc, row) => {
          const name = (row.name || 'Unnamed item').trim() || 'Unnamed item';
          const quantity = Number(row.quantity) || 0;
          const unitPrice = Number(row.price) || 0;
          const current = acc.get(name) || { quantity: 0, revenue: 0 };
          current.quantity += quantity;
          current.revenue += quantity * unitPrice;
          acc.set(name, current);
          return acc;
        }, new Map());

        const rankedItems = Array.from(itemMap.entries())
          .map(([name, summary]) => ({ name, ...summary }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        setTopItems(rankedItems);
      }

      setLoading(false);
    };

    loadSalesData();

    return () => {
      active = false;
    };
  }, [restaurantId, datePreset]);

  const grossSales = useMemo(
    () => orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0),
    [orders]
  );
  const orderCount = orders.length;
  const netSales = grossSales - refundTotal;
  const averageOrderValue = orderCount > 0 ? grossSales / orderCount : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Sales</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">Sales Reporting</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                Gross sales, refunds, order mix, and top items for your selected date range.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm">
              {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((preset) => {
                const active = datePreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDatePreset(preset)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {DATE_PRESET_LABELS[preset]}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {errorMessage && (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {errorMessage}
          </section>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Gross Sales', value: formatPrice(grossSales) },
            { label: 'Refunds', value: formatPrice(refundTotal) },
            { label: 'Net Sales', value: formatPrice(netSales) },
            { label: 'Orders', value: String(orderCount) },
            { label: 'Average Order Value', value: formatPrice(averageOrderValue) },
          ].map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? '—' : metric.value}</p>
            </article>
          ))}
        </section>

        {!loading && orders.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">No sales data for this range</h2>
            <p className="mt-2 text-sm text-slate-600">
              Try a different date filter to view sales activity.
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Sales by Source</h2>
                <p className="text-sm text-slate-500">Order count and gross revenue grouped by source.</p>
              </div>
              {salesBySource.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No source data in this date range.
                </div>
              ) : (
                <ul className="space-y-3">
                  {salesBySource.map((row) => (
                    <li key={row.source} className="rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900">{row.source}</p>
                        <p className="text-sm font-semibold text-slate-900">{formatPrice(row.grossRevenue)}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{row.orderCount} orders</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Top Selling Items</h2>
                <p className="text-sm text-slate-500">Quantity sold and item revenue in this date range.</p>
              </div>
              {topItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No item sales in this date range.
                </div>
              ) : (
                <ul className="space-y-3">
                  {topItems.map((item) => (
                    <li key={item.name} className="rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <p className="text-sm font-semibold text-slate-900">{formatPrice(item.revenue)}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.quantity} sold</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
