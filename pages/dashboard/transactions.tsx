import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { formatPrice, formatShortOrderNumber, formatStatusLabel } from '@/lib/orderDisplay';
import { supabase } from '@/utils/supabaseClient';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'custom';
type StatusFilter = 'all' | 'completed' | 'cancelled' | 'refunded';
type OrderTypeFilter = 'all' | 'delivery' | 'collection' | 'dine_in' | 'kiosk' | 'pos';

interface TransactionOrderRow {
  id: string;
  short_order_number: number | null;
  created_at: string;
  customer_name: string | null;
  phone_number: string | null;
  order_type: string | null;
  total_price: number | null;
  status: string;
}

interface TransactionOrderItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  notes: string | null;
}

interface TransactionOrderDetail extends TransactionOrderRow {
  customer_notes: string | null;
  delivery_fee: number | null;
  service_fee: number | null;
  table_number: number | null;
  dine_in_table_number: number | null;
  order_items: TransactionOrderItem[];
}

const getDateRange = (
  preset: DateRangePreset,
  customStartDate: string,
  customEndDate: string
): { start: Date | null; end: Date | null } => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return { start: todayStart, end: null };
    case 'yesterday': {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      return { start: yesterdayStart, end: todayStart };
    }
    case 'this_week': {
      const weekStart = new Date(todayStart);
      const day = weekStart.getDay();
      const diff = day === 0 ? 6 : day - 1;
      weekStart.setDate(weekStart.getDate() - diff);
      return { start: weekStart, end: null };
    }
    case 'last_week': {
      const thisWeekStart = new Date(todayStart);
      const day = thisWeekStart.getDay();
      const diff = day === 0 ? 6 : day - 1;
      thisWeekStart.setDate(thisWeekStart.getDate() - diff);
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      return { start: lastWeekStart, end: thisWeekStart };
    }
    case 'this_month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: monthStart, end: null };
    }
    case 'custom': {
      const customStart = customStartDate ? new Date(`${customStartDate}T00:00:00`) : null;
      const customEnd = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : null;
      return { start: customStart, end: customEnd };
    }
    default:
      return { start: null, end: null };
  }
};

export default function TransactionsPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [orders, setOrders] = useState<TransactionOrderRow[]>([]);
  const [itemCountByOrderId, setItemCountByOrderId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [datePreset, setDatePreset] = useState<DateRangePreset>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedOrder, setSelectedOrder] = useState<TransactionOrderDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

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

      const { data: membership, error } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error || !membership?.restaurant_id) {
        if (active) {
          setErrorMessage('Unable to load restaurant context.');
          setLoading(false);
        }
        return;
      }

      if (active) {
        setRestaurantId(membership.restaurant_id);
      }
    };

    loadRestaurant();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadOrders = async () => {
      if (!restaurantId) return;
      setLoading(true);
      setErrorMessage(null);

      const { start, end } = getDateRange(datePreset, customStartDate, customEndDate);

      let query = supabase
        .from('orders')
        .select('id,short_order_number,created_at,customer_name,phone_number,order_type,total_price,status')
        .eq('restaurant_id', restaurantId)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false });

      if (start) {
        query = query.gte('created_at', start.toISOString());
      }

      if (end) {
        query = query.lte('created_at', end.toISOString());
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (orderTypeFilter !== 'all') {
        query = query.eq('order_type', orderTypeFilter);
      }

      const { data, error } = await query;

      if (!active) return;

      if (error) {
        setErrorMessage('Failed to load transactions.');
        setOrders([]);
        setItemCountByOrderId({});
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as TransactionOrderRow[];
      setOrders(rows);

      if (rows.length === 0) {
        setItemCountByOrderId({});
        setLoading(false);
        return;
      }

      const { data: orderItems, error: itemError } = await supabase
        .from('order_items')
        .select('order_id')
        .in(
          'order_id',
          rows.map((order) => order.id)
        );

      if (!active) return;

      if (itemError) {
        setItemCountByOrderId({});
      } else {
        const counts = (orderItems ?? []).reduce<Record<string, number>>((acc, item: any) => {
          const key = item.order_id;
          if (!key) return acc;
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {});
        setItemCountByOrderId(counts);
      }

      setLoading(false);
    };

    loadOrders();

    return () => {
      active = false;
    };
  }, [restaurantId, datePreset, customStartDate, customEndDate, statusFilter, orderTypeFilter]);

  const filteredOrders = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return orders;

    return orders.filter((order) => {
      const shortOrderNumber = formatShortOrderNumber(order.short_order_number).toLowerCase();
      const customer = (order.customer_name || '').toLowerCase();
      const phone = (order.phone_number || '').toLowerCase();
      return (
        shortOrderNumber.includes(trimmed) ||
        customer.includes(trimmed) ||
        phone.includes(trimmed)
      );
    });
  }, [orders, searchQuery]);

  const handleOpenOrder = useCallback(async (orderId: string) => {
    setIsDetailLoading(true);

    const { data, error } = await supabase
      .from('orders')
      .select(
        'id,short_order_number,created_at,customer_name,phone_number,order_type,total_price,status,customer_notes,delivery_fee,service_fee,table_number,dine_in_table_number,order_items(id,name,quantity,price,notes)'
      )
      .eq('id', orderId)
      .maybeSingle();

    if (error || !data) {
      setSelectedOrder(null);
      setIsDetailLoading(false);
      return;
    }

    setSelectedOrder(data as TransactionOrderDetail);
    setIsDetailLoading(false);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedOrder(null);
  }, []);

  useEffect(() => {
    if (!selectedOrder) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeModal, selectedOrder]);

  const modalTableNumber =
    selectedOrder?.order_type === 'dine_in'
      ? selectedOrder?.dine_in_table_number ?? selectedOrder?.table_number
      : null;

  const itemsTotal =
    selectedOrder?.order_items?.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0) ?? 0;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-600">Read-only historical ledger for completed and cancelled orders.</p>
        </div>

        <div className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Date range
            <select
              value={datePreset}
              onChange={(event) => setDatePreset(event.target.value as DateRangePreset)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This week</option>
              <option value="last_week">Last week</option>
              <option value="this_month">This month</option>
              <option value="custom">Custom range</option>
            </select>
          </label>

          {datePreset === 'custom' && (
            <>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Start date
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                End date
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded (placeholder)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Order type
            <select
              value={orderTypeFilter}
              onChange={(event) => setOrderTypeFilter(event.target.value as OrderTypeFilter)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="delivery">delivery</option>
              <option value="collection">collection</option>
              <option value="dine_in">dine_in</option>
              <option value="kiosk">kiosk</option>
              <option value="pos">pos</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700 lg:col-span-2">
            Search
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search short order #, customer, or phone"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Created at</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Order type</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={7}>
                    Loading transactions...
                  </td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td className="px-4 py-6 text-red-600" colSpan={7}>
                    {errorMessage}
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={7}>
                    No transactions found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer border-t border-gray-100 transition hover:bg-gray-50"
                    onClick={() => handleOpenOrder(order.id)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{formatShortOrderNumber(order.short_order_number)}</td>
                    <td className="px-4 py-3 text-gray-700">{new Date(order.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-700">{order.customer_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{order.order_type || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{itemCountByOrderId[order.id] ?? 0}</td>
                    <td className="px-4 py-3 text-gray-700">{formatPrice(Number(order.total_price) || 0)}</td>
                    <td className="px-4 py-3 text-gray-700">{formatStatusLabel(order.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(selectedOrder || isDetailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              closeModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Order details</h2>
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {isDetailLoading || !selectedOrder ? (
              <p className="text-sm text-gray-500">Loading order details...</p>
            ) : (
              <>
                <div className="grid gap-3 rounded-lg border border-gray-200 p-4 text-sm sm:grid-cols-2">
                  <p><span className="font-medium text-gray-900">Order number:</span> {formatShortOrderNumber(selectedOrder.short_order_number)}</p>
                  <p><span className="font-medium text-gray-900">Created:</span> {new Date(selectedOrder.created_at).toLocaleString()}</p>
                  <p><span className="font-medium text-gray-900">Customer:</span> {selectedOrder.customer_name || '—'}</p>
                  <p><span className="font-medium text-gray-900">Phone:</span> {selectedOrder.phone_number || '—'}</p>
                  <p><span className="font-medium text-gray-900">Order type:</span> {selectedOrder.order_type || '—'}</p>
                  <p><span className="font-medium text-gray-900">Table number:</span> {modalTableNumber ?? '—'}</p>
                  <p className="sm:col-span-2"><span className="font-medium text-gray-900">Customer notes:</span> {selectedOrder.customer_notes || '—'}</p>
                </div>

                <div className="mt-5 rounded-lg border border-gray-200 p-4">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Items</h3>
                  <div className="space-y-2">
                    {selectedOrder.order_items.length === 0 ? (
                      <p className="text-sm text-gray-500">No items recorded.</p>
                    ) : (
                      selectedOrder.order_items.map((item) => (
                        <div key={item.id} className="rounded-md border border-gray-100 p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-gray-700">{item.quantity} × {formatPrice(Number(item.price) || 0)}</p>
                          </div>
                          {item.notes && <p className="mt-1 text-xs text-gray-500">Notes: {item.notes}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-gray-200 p-4 text-sm">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Totals</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><span>Items total</span><span>{formatPrice(itemsTotal)}</span></div>
                    <div className="flex items-center justify-between"><span>Delivery fee</span><span>{formatPrice(Number(selectedOrder.delivery_fee) || 0)}</span></div>
                    <div className="flex items-center justify-between"><span>Service fee</span><span>{formatPrice(Number(selectedOrder.service_fee) || 0)}</span></div>
                    <div className="flex items-center justify-between border-t border-gray-200 pt-2 font-semibold text-gray-900"><span>Final total</span><span>{formatPrice(Number(selectedOrder.total_price) || 0)}</span></div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Refund (placeholder)
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Send Goodwill Voucher (placeholder)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
