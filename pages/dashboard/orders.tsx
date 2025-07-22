import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { supabase } from '../../utils/supabaseClient';
import { InboxIcon } from '@heroicons/react/24/outline';
import OrderDetailsModal, { Order as OrderType } from '../../components/OrderDetailsModal';

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
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);


  const updateStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    setSelectedOrder((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
  };

  const formatPrice = (p: number | null) => {
    return p ? `£${(p / 100).toFixed(2)}` : '£0.00';
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
      <OrderDetailsModal
        order={selectedOrder as OrderType | null}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={updateStatus}
      />
    </DashboardLayout>
  );
}
