import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { formatPrice, formatShortOrderNumber, formatStatusLabel } from '@/lib/orderDisplay';
import { supabase } from '@/utils/supabaseClient';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'custom';
type StatusFilter = 'all' | 'completed' | 'cancelled' | 'refunded';
type OrderTypeFilter = 'all' | 'delivery' | 'collection' | 'dine_in' | 'kiosk' | 'pos';

interface TransactionOrderRow {
  id: string;
  user_id?: string | null;
  short_order_number: number | null;
  created_at: string;
  customer_name: string | null;
  phone_number: string | null;
  order_type: string | null;
  total_price: number | null;
  status: string;
}

interface TransactionOrderAddon {
  id: string | number;
  order_item_id: string | number;
  option_id: string | number | null;
  name: string;
  price: number;
  quantity: number;
}

interface TransactionOrderItem {
  id: string | number;
  item_id: string | number | null;
  name: string;
  quantity: number;
  price: number;
  notes: string | null;
  addons: TransactionOrderAddon[];
}

interface TransactionOrderDetail extends TransactionOrderRow {
  customer_notes: string | null;
  delivery_fee: number | null;
  service_fee: number | null;
  dine_in_table_number: number | null;
  order_items: TransactionOrderItem[];
}

type GoodwillWizardStep = 'details' | 'review' | 'confirm' | 'success';

const GOODWILL_PRESETS = [5, 10, 15, 20] as const;
const MESSAGE_HELPER = 'This will be displayed on the voucher and visible to customers';
const MESSAGE_MAX_LENGTH = 240;

const ORDER_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const getSupabaseErrorDetails = (error: unknown) => {
  const value =
    error as
      | {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
          status?: number;
          statusCode?: number;
        }
      | null;
  return {
    message: value?.message ?? 'Unknown error',
    details: value?.details ?? '',
    hint: value?.hint ?? '',
    code: value?.code ?? '',
    status: value?.status ?? value?.statusCode ?? null,
  };
};

const isAuthLikeError = (error: unknown) => {
  const details = getSupabaseErrorDetails(error);
  if (details.status === 401 || details.status === 403) return true;
  if (details.code === 'PGRST301') return true;
  const message = details.message.toLowerCase();
  return message.includes('jwt') || message.includes('auth') || message.includes('permission');
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseCurrencyInput = (value: string) => {
  const normalized = value.replace(/[^0-9.]/g, '').trim();
  if (!normalized) return null;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(2));
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

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderSummary, setSelectedOrderSummary] = useState<TransactionOrderRow | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailItemsError, setDetailItemsError] = useState<string | null>(null);
  const [detailAddonsError, setDetailAddonsError] = useState<string | null>(null);
  const [detailDebug, setDetailDebug] = useState<{
    orderItemsCount: number;
    orderItemIds: Array<string | number>;
    addonsCount: number;
    addonsPayload: any[];
    addonsQueryAttempted: boolean;
    addonsQueryError: string | null;
  }>({
    orderItemsCount: 0,
    orderItemIds: [],
    addonsCount: 0,
    addonsPayload: [],
    addonsQueryAttempted: false,
    addonsQueryError: null,
  });
  const [detailData, setDetailData] = useState<TransactionOrderDetail | null>(null);
  const [goodwillStep, setGoodwillStep] = useState<GoodwillWizardStep>('details');
  const [goodwillOpen, setGoodwillOpen] = useState(false);
  const [selectedGoodwillPreset, setSelectedGoodwillPreset] = useState<number | 'custom'>(10);
  const [customGoodwillValue, setCustomGoodwillValue] = useState('');
  const [goodwillExpiryDate, setGoodwillExpiryDate] = useState('');
  const [goodwillMessage, setGoodwillMessage] = useState('');
  const [goodwillFieldError, setGoodwillFieldError] = useState<string | null>(null);
  const [goodwillSubmitError, setGoodwillSubmitError] = useState<string | null>(null);
  const [issuingGoodwill, setIssuingGoodwill] = useState(false);
  const [goodwillSuccessValue, setGoodwillSuccessValue] = useState<number | null>(null);
  const [goodwillSuccessExpiry, setGoodwillSuccessExpiry] = useState<string>('');
  const detailRequestRef = useRef(0);

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
        .select('id,user_id,short_order_number,created_at,customer_name,phone_number,order_type,total_price,status')
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

  const fetchOrderDetail = useCallback(
    async (orderId: string | null, summary?: TransactionOrderRow | null) => {
      setDetailItemsError(null);
      setDetailAddonsError(null);
      setDetailDebug({
        orderItemsCount: 0,
        orderItemIds: [],
        addonsCount: 0,
        addonsPayload: [],
        addonsQueryAttempted: false,
        addonsQueryError: null,
      });
      if (!orderId || !restaurantId || !ORDER_ID_REGEX.test(orderId)) {
        setIsDetailLoading(false);
        setDetailError('Unable to load order details. Please try again.');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setIsDetailLoading(false);
        setDetailError('Your session has expired. Please refresh and sign in again.');
        if (process.env.NODE_ENV !== 'production') {
          console.error('Transactions detail load failed', {
            selectedOrderId: orderId,
            restaurantId,
            userId: null,
            orderError: null,
            itemsError: null,
          });
        }
        return;
      }

      const requestId = ++detailRequestRef.current;

      setIsDetailLoading(true);
      setDetailError(null);

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(
          'id,user_id,short_order_number,created_at,customer_name,phone_number,order_type,dine_in_table_number,customer_notes,total_price,delivery_fee,service_fee,status'
        )
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (requestId !== detailRequestRef.current) return;

      if (process.env.NODE_ENV !== 'production' && orderError) {
        console.error('Transactions detail load failed', {
          selectedOrderId: orderId,
          restaurantId,
          userId: session.user.id,
          orderError,
          itemsError: null,
          orderErrorInfo: getSupabaseErrorDetails(orderError),
        });
      }

      if (orderError) {
        setDetailData(null);
        setDetailError(
          isAuthLikeError(orderError)
            ? 'You are not authorized to view this order. Please refresh and sign in again.'
            : 'Unable to load order details right now.'
        );
        setIsDetailLoading(false);
        return;
      }

      if (!orderData) {
        setDetailData(null);
        setDetailError('Order not found.');
        setIsDetailLoading(false);
        return;
      }

      const detailBase: TransactionOrderDetail = {
        id: orderData.id,
        user_id: orderData.user_id ?? null,
        short_order_number: orderData.short_order_number,
        created_at: orderData.created_at,
        customer_name: orderData.customer_name,
        phone_number: orderData.phone_number,
        order_type: orderData.order_type,
        total_price: orderData.total_price,
        status: orderData.status,
        customer_notes: orderData.customer_notes,
        delivery_fee: orderData.delivery_fee,
        service_fee: orderData.service_fee,
        dine_in_table_number: orderData.dine_in_table_number,
        order_items: [],
      };

      setDetailData(detailBase);
      setSelectedOrderSummary(summary ?? null);

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('id,order_id,item_id,name,quantity,price,notes')
        .eq('order_id', orderId);

      if (requestId !== detailRequestRef.current) return;

      if (process.env.NODE_ENV !== 'production' && itemsError) {
        console.error('Transactions detail load failed', {
          selectedOrderId: orderId,
          restaurantId,
          userId: session.user.id,
          orderError: null,
          itemsError,
          itemsErrorInfo: getSupabaseErrorDetails(itemsError),
        });
      }

      if (itemsError) {
        setDetailItemsError('Order items could not be loaded right now.');
        setDetailError(null);
        setIsDetailLoading(false);
        return;
      }

      const itemRows = (itemsData ?? []) as any[];
      const orderItemIds = itemRows.map((item) => item?.id).filter(Boolean) as Array<string | number>;

      if (process.env.NODE_ENV !== 'production') {
        console.debug('Transactions modal order items', itemRows);
        console.debug('Transactions modal order item ids', orderItemIds);
      }

      setDetailDebug((prev) => ({
        ...prev,
        orderItemsCount: itemRows.length,
        orderItemIds,
      }));

      let addonsByItemId: Record<string, TransactionOrderAddon[]> = {};
      let addonsQueryFailed = false;

      if (orderItemIds.length > 0) {
        const { data: addonsData, error: addonsError } = await supabase
          .from('order_addons')
          .select('id,order_item_id,option_id,name,price,quantity')
          .in('order_item_id', orderItemIds);

        if (requestId !== detailRequestRef.current) return;

        if (process.env.NODE_ENV !== 'production' && addonsError) {
          console.error('Transactions detail addons load failed', {
            selectedOrderId: orderId,
            restaurantId,
            userId: session.user.id,
            addonsError,
            addonsErrorInfo: getSupabaseErrorDetails(addonsError),
          });
        }

        if (addonsError) {
          addonsQueryFailed = true;
          setDetailAddonsError('Order add-ons could not be loaded right now.');
          setDetailDebug((prev) => ({
            ...prev,
            addonsQueryAttempted: true,
            addonsQueryError: JSON.stringify(getSupabaseErrorDetails(addonsError)),
          }));
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.debug('Transactions modal order addons', addonsData ?? []);
          }
          const normalizedAddons: TransactionOrderAddon[] = ((addonsData ?? []) as any[]).map((addon) => ({
            id: addon.id,
            order_item_id: addon.order_item_id,
            option_id: addon.option_id ?? null,
            name: addon.name,
            price: Number(addon.price) || 0,
            quantity: Number(addon.quantity) || 0,
          }));

          addonsByItemId = normalizedAddons.reduce<Record<string, TransactionOrderAddon[]>>((acc, addon) => {
            const key = String(addon.order_item_id);
            if (!acc[key]) acc[key] = [];
            acc[key].push(addon);
            return acc;
          }, {});
          setDetailDebug((prev) => ({
            ...prev,
            addonsQueryAttempted: true,
            addonsQueryError: null,
            addonsCount: normalizedAddons.length,
            addonsPayload: addonsData ?? [],
          }));
          setDetailAddonsError(null);
        }
      } else {
        setDetailDebug((prev) => ({
          ...prev,
          addonsQueryAttempted: false,
          addonsQueryError: null,
          addonsCount: 0,
          addonsPayload: [],
        }));
      }

      if (orderItemIds.length > 0 && process.env.NODE_ENV !== 'production' && !addonsQueryFailed && Object.keys(addonsByItemId).length === 0) {
        setDetailAddonsError('No order_addons were returned for these order_item_ids.');
      }

      const normalizedItems: TransactionOrderItem[] = itemRows.map((item: any) => {
        const itemId = item.id;
        return {
          id: itemId,
          item_id: item.item_id ?? null,
          name: item.name,
          quantity: Number(item.quantity) || 0,
          price: Number(item.price) || 0,
          notes: item.notes || null,
          addons: addonsByItemId[String(itemId)] || [],
        };
      });

      setDetailData({
        ...detailBase,
        order_items: normalizedItems,
      });
      setDetailError(null);
      setDetailItemsError(null);
      setIsDetailLoading(false);
    },
    [restaurantId]
  );

  const handleOpenOrder = useCallback(
    async (order: TransactionOrderRow) => {
      setSelectedOrderId(order.id);
      setSelectedOrderSummary(order);
      setIsDetailModalOpen(true);
      setIsDetailLoading(true);
      setDetailError(null);
      setDetailItemsError(null);
      setDetailAddonsError(null);
      setDetailDebug({
        orderItemsCount: 0,
        orderItemIds: [],
        addonsCount: 0,
        addonsPayload: [],
        addonsQueryAttempted: false,
        addonsQueryError: null,
      });
      setDetailData(null);
      setGoodwillOpen(false);
      setGoodwillStep('details');
      setGoodwillFieldError(null);
      setGoodwillSubmitError(null);
      setIssuingGoodwill(false);
      setGoodwillSuccessValue(null);
      setGoodwillSuccessExpiry('');
      await fetchOrderDetail(order.id, order);
    },
    [fetchOrderDetail]
  );

  const closeModal = useCallback(() => {
    detailRequestRef.current += 1;
    setIsDetailModalOpen(false);
    setSelectedOrderId(null);
    setSelectedOrderSummary(null);
    setIsDetailLoading(false);
    setDetailError(null);
    setDetailItemsError(null);
    setDetailAddonsError(null);
    setDetailDebug({
      orderItemsCount: 0,
      orderItemIds: [],
      addonsCount: 0,
      addonsPayload: [],
      addonsQueryAttempted: false,
      addonsQueryError: null,
    });
    setDetailData(null);
    setGoodwillOpen(false);
    setGoodwillStep('details');
    setGoodwillFieldError(null);
    setGoodwillSubmitError(null);
    setIssuingGoodwill(false);
    setGoodwillSuccessValue(null);
    setGoodwillSuccessExpiry('');
  }, []);

  useEffect(() => {
    if (!isDetailModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeModal, isDetailModalOpen]);

  const modalOrder = detailData || selectedOrderSummary;
  const modalTableNumber = detailData?.order_type === 'dine_in' ? detailData?.dine_in_table_number : null;
  const modalStatus = formatStatusLabel(modalOrder?.status) || 'Unknown';
  const modalOrderType = modalOrder?.order_type ? formatStatusLabel(modalOrder.order_type) : 'Unknown';
  const statusChipClass =
    modalOrder?.status === 'completed'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : modalOrder?.status === 'cancelled'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-gray-200 bg-gray-50 text-gray-700';

  const baseItemsTotal =
    detailData?.order_items?.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
      0
    ) ?? 0;
  const addonsTotal =
    detailData?.order_items?.reduce(
      (sum, item) =>
        sum +
        (item.addons || []).reduce(
          (addonSum, addon) => addonSum + (Number(addon.price) || 0) * (Number(addon.quantity) || 0),
          0
        ),
      0
    ) ?? 0;
  const itemsTotal = baseItemsTotal + addonsTotal;
  const feesTotal = (Number(detailData?.delivery_fee) || 0) + (Number(detailData?.service_fee) || 0);

  const goodwillEligibility = useMemo(() => {
    const userId = String(modalOrder?.user_id || '').trim();
    if (!userId || !ORDER_ID_REGEX.test(userId)) {
      return { eligible: false, reason: 'Customer account required' };
    }
    const orderType = String(modalOrder?.order_type || '').toLowerCase();
    if (orderType === 'kiosk' || orderType === 'express') {
      return { eligible: false, reason: 'Unavailable for this order type' };
    }
    return { eligible: true, reason: '' };
  }, [modalOrder?.order_type, modalOrder?.user_id]);

  const goodwillEligible = goodwillEligibility.eligible;

  const goodwillAmount = useMemo(() => {
    if (selectedGoodwillPreset === 'custom') {
      return parseCurrencyInput(customGoodwillValue);
    }
    return Number(selectedGoodwillPreset);
  }, [customGoodwillValue, selectedGoodwillPreset]);

  const resetGoodwillWizard = useCallback(() => {
    setGoodwillOpen(false);
    setGoodwillStep('details');
    setSelectedGoodwillPreset(10);
    setCustomGoodwillValue('');
    setGoodwillExpiryDate('');
    setGoodwillMessage('');
    setGoodwillFieldError(null);
    setGoodwillSubmitError(null);
    setIssuingGoodwill(false);
    setGoodwillSuccessValue(null);
    setGoodwillSuccessExpiry('');
  }, []);

  const openGoodwillWizard = useCallback(() => {
    if (!goodwillEligible) return;
    setGoodwillOpen(true);
    setGoodwillStep('details');
    setGoodwillFieldError(null);
    setGoodwillSubmitError(null);
    if (!goodwillExpiryDate) {
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 30);
      setGoodwillExpiryDate(toIsoDate(defaultExpiry));
    }
  }, [goodwillEligible, goodwillExpiryDate]);

  const validateGoodwillStep = useCallback(() => {
    if (!goodwillEligible) {
      setGoodwillFieldError('Customer account required');
      return false;
    }
    if (!goodwillAmount || goodwillAmount <= 0 || goodwillAmount > 500) {
      setGoodwillFieldError('Enter a valid voucher value between £0.01 and £500.');
      return false;
    }
    if (!goodwillExpiryDate) {
      setGoodwillFieldError('Expiry date is required.');
      return false;
    }
    const expiry = new Date(`${goodwillExpiryDate}T23:59:59`);
    if (Number.isNaN(expiry.valueOf()) || expiry.valueOf() <= Date.now()) {
      setGoodwillFieldError('Expiry date must be in the future.');
      return false;
    }
    setGoodwillFieldError(null);
    return true;
  }, [goodwillAmount, goodwillEligible, goodwillExpiryDate]);

  const issueGoodwillVoucher = useCallback(async () => {
    if (!selectedOrderId || !validateGoodwillStep() || issuingGoodwill) return;
    setIssuingGoodwill(true);
    setGoodwillSubmitError(null);

    try {
      const response = await fetch('/api/dashboard/issue-goodwill-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrderId,
          amount: goodwillAmount,
          expiryDate: goodwillExpiryDate,
          message: goodwillMessage.trim().slice(0, MESSAGE_MAX_LENGTH),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(String(payload?.message || 'Failed to issue goodwill voucher.'));
      }

      setGoodwillSuccessValue(goodwillAmount || null);
      setGoodwillSuccessExpiry(goodwillExpiryDate);
      setGoodwillStep('success');
    } catch (error: any) {
      setGoodwillSubmitError(error?.message || 'Failed to issue goodwill voucher.');
      setGoodwillStep('review');
    } finally {
      setIssuingGoodwill(false);
    }
  }, [goodwillAmount, goodwillExpiryDate, goodwillMessage, issuingGoodwill, selectedOrderId, validateGoodwillStep]);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-600">
            Read-only historical ledger for completed and cancelled orders.
          </p>
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
                    onClick={() => handleOpenOrder(order)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatShortOrderNumber(order.short_order_number)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{new Date(order.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-700">{order.customer_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{order.order_type || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{itemCountByOrderId[order.id] ?? 0}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatPrice(Number(order.total_price) || 0)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatStatusLabel(order.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isDetailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              closeModal();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Order record</p>
                <h2 className="mt-1 text-2xl font-semibold text-gray-900">
                  Order #{formatShortOrderNumber(modalOrder?.short_order_number)}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {modalOrder?.created_at ? new Date(modalOrder.created_at).toLocaleString() : '—'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusChipClass}`}>
                    {modalStatus}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    {modalOrderType}
                  </span>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
              >
                Close
              </button>
            </div>

            {isDetailLoading ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-5">
                <p className="text-sm text-gray-600">Loading order details...</p>
              </div>
            ) : detailError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p>{detailError}</p>
                <button
                  type="button"
                  onClick={() => fetchOrderDetail(selectedOrderId, selectedOrderSummary)}
                  className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                >
                  Retry
                </button>
              </div>
            ) : detailData ? (
              <>
                {goodwillOpen ? (
                  <div className="animate-[fadeIn_.2s_ease-out] space-y-4 rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/40 p-4">
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-gray-500">Goodwill voucher</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {modalOrder?.customer_name || 'Customer'} · {formatShortOrderNumber(modalOrder?.short_order_number)}
                      </p>
                    </div>

                    {goodwillStep === 'details' && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Step 1 — Voucher Details</p>
                        </div>
                        <div>
                          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-gray-500">Voucher value</p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            {GOODWILL_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  setSelectedGoodwillPreset(preset);
                                  setGoodwillFieldError(null);
                                }}
                                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${selectedGoodwillPreset === preset ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                              >
                                £{preset}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGoodwillPreset('custom');
                                setGoodwillFieldError(null);
                              }}
                              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${selectedGoodwillPreset === 'custom' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                            >
                              Custom
                            </button>
                          </div>
                          {selectedGoodwillPreset === 'custom' && (
                            <label className="mt-3 block text-sm text-gray-700">
                              <span className="mb-1 block">Custom amount</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={customGoodwillValue}
                                onChange={(event) => setCustomGoodwillValue(event.target.value)}
                                placeholder="0.00"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              />
                            </label>
                          )}
                        </div>

                        <label className="block text-sm text-gray-700">
                          <span className="mb-1 block">Expiry date</span>
                          <input
                            type="date"
                            value={goodwillExpiryDate}
                            onChange={(event) => setGoodwillExpiryDate(event.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="block text-sm text-gray-700">
                          <span className="mb-1 block">Customer message</span>
                          <p className="mb-1 text-xs text-gray-500">{MESSAGE_HELPER}</p>
                          <textarea
                            value={goodwillMessage}
                            onChange={(event) => setGoodwillMessage(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
                            rows={3}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            placeholder="Optional message"
                          />
                          <p className="mt-1 text-xs text-gray-400">{goodwillMessage.trim().length}/{MESSAGE_MAX_LENGTH}</p>
                        </label>

                        {goodwillFieldError && <p className="text-sm text-rose-600">{goodwillFieldError}</p>}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (!validateGoodwillStep()) return;
                              setGoodwillStep('review');
                            }}
                            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
                          >
                            Continue
                          </button>
                        </div>
                      </div>
                    )}

                    {goodwillStep === 'review' && (
                      <div className="space-y-4">
                        <p className="text-sm font-semibold text-gray-900">Step 2 — Review</p>
                        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                          <p><span className="text-gray-500">Customer:</span> <span className="font-medium text-gray-900">{modalOrder?.customer_name || '—'}</span></p>
                          <p className="mt-1"><span className="text-gray-500">Voucher value:</span> <span className="font-medium text-gray-900">{formatPrice(goodwillAmount || 0)}</span></p>
                          <p className="mt-1"><span className="text-gray-500">Expiry date:</span> <span className="font-medium text-gray-900">{goodwillExpiryDate || '—'}</span></p>
                          {goodwillMessage.trim() ? <p className="mt-1"><span className="text-gray-500">Customer message:</span> <span className="font-medium text-gray-900">{goodwillMessage.trim()}</span></p> : null}
                          <p className="mt-3 text-sm text-gray-600">This voucher will be issued directly to this customer's account.</p>
                        </div>
                        {goodwillSubmitError && <p className="text-sm text-rose-600">{goodwillSubmitError}</p>}
                        <div className="flex justify-between gap-2">
                          <button type="button" onClick={() => setGoodwillStep('details')} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700">Back</button>
                          <button type="button" disabled={issuingGoodwill} onClick={() => setGoodwillStep('confirm')} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">Issue Voucher</button>
                        </div>
                      </div>
                    )}

                    {goodwillStep === 'confirm' && (
                      <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-900">Are you sure you want to issue this goodwill voucher?</p>
                        <div className="flex justify-end gap-2">
                          <button type="button" disabled={issuingGoodwill} onClick={() => setGoodwillStep('review')} className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm text-amber-800">Cancel</button>
                          <button type="button" disabled={issuingGoodwill} onClick={issueGoodwillVoucher} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{issuingGoodwill ? 'Issuing…' : 'Issue Voucher'}</button>
                        </div>
                      </div>
                    )}

                    {goodwillStep === 'success' && (
                      <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-base font-semibold text-emerald-900">Voucher issued successfully</p>
                        <p className="text-sm text-emerald-800">Value: {formatPrice(goodwillSuccessValue || 0)}</p>
                        <p className="text-sm text-emerald-800">Expiry date: {goodwillSuccessExpiry}</p>
                        <p className="text-sm text-emerald-800">Attached to the customer account.</p>
                        <div className="flex justify-end">
                          <button type="button" onClick={resetGoodwillWizard} className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800">Return to order details</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                <>
                <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-5">
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Summary</h3>
                  <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                    <div className="space-y-1">
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Customer</dt>
                      <dd className="font-medium text-gray-900">{modalOrder?.customer_name || 'Guest order'}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Phone</dt>
                      <dd className="font-medium text-gray-700">{modalOrder?.phone_number || 'Not provided'}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Order type</dt>
                      <dd className="font-medium text-gray-900">{modalOrderType}</dd>
                    </div>
                    {modalTableNumber != null ? (
                      <div className="space-y-1">
                        <dt className="text-xs uppercase tracking-wide text-gray-500">Table number</dt>
                        <dd className="font-medium text-gray-900">{modalTableNumber}</dd>
                      </div>
                    ) : null}
                    {detailData.customer_notes?.trim() ? (
                      <div className="sm:col-span-2">
                        <dt className="text-xs uppercase tracking-wide text-gray-500">Customer notes</dt>
                        <dd className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 leading-relaxed text-gray-700">
                          {detailData.customer_notes}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                {detailItemsError && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {detailItemsError}
                  </div>
                )}

                {detailAddonsError && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    {detailAddonsError}
                  </div>
                )}

                <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-600">Items</h3>
                  </div>
                  <div className="space-y-2.5">
                    {detailData.order_items.length === 0 ? (
                      <p className="text-sm text-gray-500">No items recorded.</p>
                    ) : (
                      detailData.order_items.map((item) => {
                        const baseLineTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
                        return (
                          <div key={String(item.id)} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3.5 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900">{item.name}</p>
                                {item.quantity > 1 && <p className="mt-0.5 text-xs text-gray-500">x{item.quantity}</p>}
                                {item.notes && <p className="mt-1 text-xs text-gray-500">Notes: {item.notes}</p>}
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-gray-800">{formatPrice(baseLineTotal)}</p>
                              </div>
                            </div>

                            {item.addons.length > 0 && (
                              <div className="mt-2.5 space-y-1.5 border-t border-gray-200 pt-2.5">
                                {item.addons.map((addon) => {
                                  const addonLineTotal = (Number(addon.price) || 0) * (Number(addon.quantity) || 0);
                                  const addonLabel = addon.quantity > 1 ? `+ ${addon.name} x${addon.quantity}` : `+ ${addon.name}`;
                                  return (
                                    <div key={String(addon.id)} className="flex items-start justify-between gap-3 pl-3 text-xs text-gray-500">
                                      <p className="min-w-0 truncate">{addonLabel}</p>
                                      <div className="text-right whitespace-nowrap">
                                        <p>{formatPrice(addonLineTotal)}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50/50 p-5 text-sm">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-gray-600">Totals</h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Items total</span>
                      <span className="font-medium text-gray-800">{formatPrice(itemsTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Fees</span>
                      <span className="font-medium text-gray-800">{formatPrice(feesTotal)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between border-t border-gray-300 pt-3 text-base font-semibold text-gray-900">
                      <span>Final total</span>
                      <span>{formatPrice(Number(detailData.total_price) || 0)}</span>
                    </div>
                  </div>
                </div>


                {process.env.NODE_ENV !== 'production' && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                    <p><span className="font-semibold">Debug selectedOrderId:</span> {selectedOrderId || '—'}</p>
                    <p><span className="font-semibold">Fetched order items:</span> {detailDebug.orderItemsCount}</p>
                    <p><span className="font-semibold">Order item ids:</span> {JSON.stringify(detailDebug.orderItemIds)}</p>
                    <p><span className="font-semibold">Fetched order addons:</span> {detailDebug.addonsCount}</p>
                    {detailDebug.addonsQueryError && (
                      <p className="text-rose-700"><span className="font-semibold">Addons query error:</span> {detailDebug.addonsQueryError}</p>
                    )}
                    {detailDebug.addonsQueryAttempted && detailDebug.addonsCount === 0 && !detailDebug.addonsQueryError && (
                      <p className="text-amber-700">No order_addons were returned for these order_item_ids.</p>
                    )}
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded border border-gray-200 bg-white p-2">{JSON.stringify(detailDebug.addonsPayload, null, 2)}</pre>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
                  >
                    Refund (placeholder)
                  </button>
                  <button
                    type="button"
                    onClick={openGoodwillWizard}
                    disabled={!goodwillEligible}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Send Goodwill Voucher
                  </button>
                </div>
                </>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">No order details available.</p>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
