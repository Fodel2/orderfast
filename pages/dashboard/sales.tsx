import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { formatPrice } from '@/lib/orderDisplay';
import { supabase } from '@/utils/supabaseClient';

type DatePreset = 'today' | 'last_7_days' | 'this_month' | 'custom_range';

interface SalesOrderRow {
  id: string;
  total_price: number | null;
  source: string | null;
}

interface SalesRefundRow {
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
  custom_range: 'Custom Range',
};

const DEFAULT_TIMEZONE = 'Europe/London';

const getTimeZoneParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getValue = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: getValue('year'),
    month: getValue('month'),
    day: getValue('day'),
    hour: getValue('hour'),
    minute: getValue('minute'),
    second: getValue('second'),
  };
};

const getTimezoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - date.getTime();
};

const zonedDateTimeToUtc = (
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
) => {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimezoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
};

const formatIsoDate = (year: number, month: number, day: number) => {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const addDaysToIsoDate = (isoDate: string, days: number) => {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  const utcDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return formatIsoDate(utcDate.getUTCFullYear(), utcDate.getUTCMonth() + 1, utcDate.getUTCDate());
};

const getTodayInTimezoneIso = (timeZone: string) => {
  const todayParts = getTimeZoneParts(new Date(), timeZone);
  return formatIsoDate(todayParts.year, todayParts.month, todayParts.day);
};

const getDateRangeForPreset = (
  preset: DatePreset,
  timeZone: string,
  customRange: { startDate: string; endDate: string } | null
) => {
  const todayIso = getTodayInTimezoneIso(timeZone);

  if (preset === 'custom_range') {
    if (!customRange?.startDate || !customRange?.endDate) return null;
    const start = parseIsoDate(customRange.startDate);
    const end = parseIsoDate(customRange.endDate);
    if (!start || !end) return null;
    if (customRange.endDate < customRange.startDate) return null;

    const startUtc = zonedDateTimeToUtc(timeZone, start.year, start.month, start.day, 0, 0, 0);
    const endExclusiveIso = addDaysToIsoDate(customRange.endDate, 1);
    const endExclusive = parseIsoDate(endExclusiveIso);
    if (!endExclusive) return null;
    const endExclusiveUtc = zonedDateTimeToUtc(
      timeZone,
      endExclusive.year,
      endExclusive.month,
      endExclusive.day,
      0,
      0,
      0
    );

    return { startIsoUtc: startUtc.toISOString(), endExclusiveIsoUtc: endExclusiveUtc.toISOString() };
  }

  if (preset === 'today') {
    const today = parseIsoDate(todayIso);
    if (!today) return null;
    const startUtc = zonedDateTimeToUtc(timeZone, today.year, today.month, today.day, 0, 0, 0);
    const tomorrow = parseIsoDate(addDaysToIsoDate(todayIso, 1));
    if (!tomorrow) return null;
    const endExclusiveUtc = zonedDateTimeToUtc(
      timeZone,
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
      0,
      0,
      0
    );
    return { startIsoUtc: startUtc.toISOString(), endExclusiveIsoUtc: endExclusiveUtc.toISOString() };
  }

  if (preset === 'last_7_days') {
    const startIso = addDaysToIsoDate(todayIso, -6);
    const start = parseIsoDate(startIso);
    const tomorrow = parseIsoDate(addDaysToIsoDate(todayIso, 1));
    if (!start || !tomorrow) return null;
    const startUtc = zonedDateTimeToUtc(timeZone, start.year, start.month, start.day, 0, 0, 0);
    const endExclusiveUtc = zonedDateTimeToUtc(
      timeZone,
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
      0,
      0,
      0
    );
    return { startIsoUtc: startUtc.toISOString(), endExclusiveIsoUtc: endExclusiveUtc.toISOString() };
  }

  const today = parseIsoDate(todayIso);
  if (!today) return null;
  const monthStartIso = formatIsoDate(today.year, today.month, 1);
  const monthStart = parseIsoDate(monthStartIso);
  const tomorrow = parseIsoDate(addDaysToIsoDate(todayIso, 1));
  if (!monthStart || !tomorrow) return null;

  const startUtc = zonedDateTimeToUtc(timeZone, monthStart.year, monthStart.month, monthStart.day, 0, 0, 0);
  const endExclusiveUtc = zonedDateTimeToUtc(
    timeZone,
    tomorrow.year,
    tomorrow.month,
    tomorrow.day,
    0,
    0,
    0
  );

  return { startIsoUtc: startUtc.toISOString(), endExclusiveIsoUtc: endExclusiveUtc.toISOString() };
};

export default function SalesPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantTimezone, setRestaurantTimezone] = useState(DEFAULT_TIMEZONE);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);
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

      const resolvedRestaurantId = String(membership.restaurant_id);
      setRestaurantId(resolvedRestaurantId);

      const { data: restaurantRow } = await supabase
        .from('restaurants')
        .select('timezone')
        .eq('id', resolvedRestaurantId)
        .maybeSingle();

      if (!active) return;

      const timezone = typeof restaurantRow?.timezone === 'string' ? restaurantRow.timezone.trim() : '';
      if (timezone) {
        setRestaurantTimezone(timezone);
      }
    };

    loadRestaurantId();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (datePreset !== 'custom_range') {
      setCustomRangeError(null);
      return;
    }

    const todayIso = getTodayInTimezoneIso(restaurantTimezone);
    if (!customEndDate) {
      setCustomEndDate(todayIso);
    }
  }, [datePreset, customEndDate, restaurantTimezone]);

  useEffect(() => {
    if (!restaurantId) return;

    if (datePreset === 'custom_range' && !appliedCustomRange) {
      setLoading(false);
      setOrders([]);
      setRefundTotal(0);
      setSalesBySource([]);
      setTopItems([]);
      return;
    }

    let active = true;

    const loadSalesData = async () => {
      setLoading(true);
      setErrorMessage(null);

      const resolvedRange = getDateRangeForPreset(datePreset, restaurantTimezone, appliedCustomRange);

      if (!resolvedRange) {
        setOrders([]);
        setRefundTotal(0);
        setSalesBySource([]);
        setTopItems([]);
        setLoading(false);
        return;
      }

      let orderQuery = supabase
        .from('orders')
        .select('id,total_price,source')
        .eq('restaurant_id', restaurantId)
        .neq('status', 'rejected')
        .neq('status', 'cancelled')
        .gte('created_at', resolvedRange.startIsoUtc)
        .lt('created_at', resolvedRange.endExclusiveIsoUtc);

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

      const sourceMap = includedOrders.reduce<Map<string, { orderCount: number; grossRevenue: number }>>(
        (acc, order) => {
          const source = (order.source || 'Unknown').trim() || 'Unknown';
          const gross = Number(order.total_price) || 0;
          const current = acc.get(source) || { orderCount: 0, grossRevenue: 0 };
          current.orderCount += 1;
          current.grossRevenue += gross;
          acc.set(source, current);
          return acc;
        },
        new Map()
      );

      const sourceRows = Array.from(sourceMap.entries())
        .map(([source, summary]) => ({ source, ...summary }))
        .sort((a, b) => b.grossRevenue - a.grossRevenue);

      setSalesBySource(sourceRows);

      const { data: refundRows, error: refundsError } = await supabase
        .from('order_refunds')
        .select('refund_amount')
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
        const itemMap = ((itemRows ?? []) as SalesItemRow[]).reduce<Map<string, { quantity: number; revenue: number }>>(
          (acc, row) => {
            const name = (row.name || 'Unnamed item').trim() || 'Unnamed item';
            const quantity = Number(row.quantity) || 0;
            const unitPrice = Number(row.price) || 0;
            const current = acc.get(name) || { quantity: 0, revenue: 0 };
            current.quantity += quantity;
            current.revenue += quantity * unitPrice;
            acc.set(name, current);
            return acc;
          },
          new Map()
        );

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
  }, [restaurantId, datePreset, appliedCustomRange, restaurantTimezone]);

  const grossSales = useMemo(
    () => orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0),
    [orders]
  );
  const orderCount = orders.length;
  const netSales = grossSales - refundTotal;
  const averageOrderValue = orderCount > 0 ? grossSales / orderCount : 0;

  const handlePresetSelect = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom_range') {
      setCustomRangeError(null);
    }
  };

  const handleApplyCustomRange = () => {
    if (!customStartDate || !customEndDate) {
      setCustomRangeError('Select both start and end dates.');
      return;
    }

    if (customEndDate < customStartDate) {
      setCustomRangeError('End date cannot be before start date.');
      return;
    }

    setCustomRangeError(null);
    setAppliedCustomRange({ startDate: customStartDate, endDate: customEndDate });
  };

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
            <div className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm sm:w-auto">
              {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((preset) => {
                const isActive = datePreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`flex h-10 w-full items-center justify-center whitespace-nowrap rounded-xl px-2 text-[13px] font-medium leading-none transition sm:px-3 sm:text-sm ${
                      isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {DATE_PRESET_LABELS[preset]}
                  </button>
                );
              })}
            </div>
          </div>

          {datePreset === 'custom_range' && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Start date
                <input
                  type="date"
                  value={customStartDate}
                  max={customEndDate || undefined}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                End date
                <input
                  type="date"
                  value={customEndDate}
                  min={customStartDate || undefined}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>
              <button
                type="button"
                onClick={handleApplyCustomRange}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Apply
              </button>
            </div>
          )}

          {datePreset === 'custom_range' && customRangeError && (
            <p className="mt-2 text-sm text-rose-600">{customRangeError}</p>
          )}
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
            <p className="mt-2 text-sm text-slate-600">Try a different date filter to view sales activity.</p>
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
