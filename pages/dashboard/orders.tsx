import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { supabase } from '../../utils/supabaseClient';
import { InboxIcon } from '@heroicons/react/24/outline';
import OrderDetailsModal, { Order as OrderType } from '../../components/OrderDetailsModal';
import BreakModal from '../../components/BreakModal';
import BreakCountdown from '../../components/BreakCountdown';

interface OrderAddon {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface OrderItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
  order_addons: OrderAddon[];
}

interface Order {
  id: string;
  order_type: 'delivery' | 'collection';
  customer_name: string | null;
  phone_number: string | null;
  delivery_address: any;
  scheduled_for: string | null;
  customer_notes: string | null;
  status: string;
  total_price: number | null;
  created_at: string;
  order_items: OrderItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [now, setNow] = useState(Date.now());
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [breakUntil, setBreakUntil] = useState<string | null>(null);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [todayHours, setTodayHours] = useState<
    | { open_time: string | null; close_time: string | null; closed: boolean }
    | null
  >(null);
  const router = useRouter();

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
          order_type,
          customer_name,
          phone_number,
          delivery_address,
          scheduled_for,
          customer_notes,
          status,
          total_price,
          created_at,
          order_items(
            id,
            name,
            price,
            quantity,
            notes,
            order_addons(id,name,price,quantity)
          )
        `
        )
        .eq('restaurant_id', ruData.restaurant_id)
        .order('created_at', { ascending: false });

      console.log('orders query result', { ordersData, ordersError });

      if (!ordersError && ordersData) {
        setOrders(ordersData as Order[]);
      } else if (ordersError) {
        console.error('Error fetching orders', ordersError);
      }

      setLoading(false);
    };

    load();
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!restaurantId) return;

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
    await supabase.from('orders').update({ status }).eq('id', id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    setSelectedOrder((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
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

  const formatPrice = (p: number | null) => {
    return p ? `£${(p / 100).toFixed(2)}` : '£0.00';
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

  if (orders.length === 0) {
    return (
      <DashboardLayout>
        <div className="text-gray-500 flex items-center space-x-2">
          <InboxIcon className="w-5 h-5" />
          <span>No orders</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-2">Live Orders</h1>
      {breakUntil && new Date(breakUntil).getTime() > now && (
        <BreakCountdown breakUntil={breakUntil} onEnd={endBreak} />
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
              className={`px-3 py-1 rounded text-white text-sm ${isOpen ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {isOpen ? 'Close Now' : 'Open Now'}
            </button>
            {isOpen && (
              <button
                onClick={() => setShowBreakModal(true)}
                className="px-3 py-1 rounded text-white text-sm bg-blue-600 hover:bg-blue-700"
              >
                Take a Break
              </button>
            )}
          </div>
        )}
      </div>
      <div className="space-y-4">
        {orders.map((o) => {
          const age = now - new Date(o.created_at).getTime();
          const highlight =
            o.status === 'pending'
              ? age < 120000
                ? 'bg-red-100 animate-pulse'
                : 'bg-red-300 animate-pulse'
              : 'bg-white';
          return (
            <div
              key={o.id}
              className={`${highlight} border rounded-lg shadow-md p-4 cursor-pointer`}
              onClick={() => setSelectedOrder(o)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">#{o.id.slice(-6)}</h3>
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
      <BreakModal
        show={showBreakModal}
        onClose={() => setShowBreakModal(false)}
        onSelect={startBreak}
      />
      <OrderDetailsModal
        order={selectedOrder as OrderType | null}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={updateStatus}
      />
    </DashboardLayout>
  );
}
