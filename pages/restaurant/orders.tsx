import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import CustomerLayout from '../../components/CustomerLayout';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../utils/supabaseClient';
import { useUser } from '@supabase/auth-helpers-react';

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
  short_order_number: number | null;
  order_type: 'delivery' | 'collection';
  delivery_address: any;
  customer_notes: string | null;
  status: string;
  total_price: number | null;
  created_at: string;
  order_items: OrderItem[];
}

const statusStyles: Record<string, string> = {
  pending: 'bg-gray-200 text-gray-800',
  accepted: 'bg-blue-200 text-blue-800',
  preparing: 'bg-yellow-200 text-yellow-800',
  delivering: 'bg-indigo-200 text-indigo-800',
  ready_to_collect: 'bg-purple-200 text-purple-800',
  completed: 'bg-green-200 text-green-800',
  cancelled: 'bg-red-200 text-red-800',
};

const formatPrice = (p: number | null) => `£${((p || 0) / 100).toFixed(2)}`;

const formatAddress = (addr: any) => {
  if (!addr) return '';
  return [addr.address_line_1, addr.address_line_2, addr.postcode]
    .filter(Boolean)
    .join(', ');
};

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const user = useUser();
  const userId = user?.id;
  const userEmail = user?.email;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const loadOrders = async () => {
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .or(`user_id.eq.${userId},guest_email.eq.${userEmail}`)
        .order('created_at', { ascending: false });

      console.log('User ID:', userId);
      console.log('User Email:', userEmail);
      console.log('Orders:', ordersData);
      console.log('Orders Error:', ordersError);

      if (!ordersError && ordersData) {
        setOrders(ordersData as Order[]);
      } else if (ordersError) {
        console.error('Failed to fetch orders', ordersError);
      }
      setLoading(false);
    };

    loadOrders();
  }, [router, user, userId, userEmail]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const day = d.toDateString() === now.toDateString() ? 'Today' : d.toLocaleDateString();
    return `${day} at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  };

  if (loading) {
    return <CustomerLayout cartCount={itemCount}>Loading...</CustomerLayout>;
  }

  return (
    <CustomerLayout cartCount={itemCount}>
      {orders.length === 0 ? (
        <div className="flex items-center justify-center h-[60vh] text-gray-500">
          You haven’t placed any orders yet.
        </div>
      ) : (
        <div className="p-4 space-y-4 overflow-y-auto">
          {orders.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-xl shadow-sm p-4 transition hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                className="w-full text-left"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">#{String(o.short_order_number ?? 0).padStart(4, '0')}</h3>
                    <p className="text-sm text-gray-500">{formatTime(o.created_at)}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-semibold">{formatPrice(o.total_price)}</p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        statusStyles[o.status] || 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </button>
              {expanded === o.id && (
                <div className="mt-4 space-y-2 text-sm">
                  <ul className="space-y-2">
                    {o.order_items.map((it) => (
                      <li key={it.id} className="border rounded p-2">
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {it.name} × {it.quantity}
                          </span>
                          <span>{formatPrice(it.price * it.quantity)}</span>
                        </div>
                        {it.order_addons && it.order_addons.length > 0 && (
                          <ul className="mt-1 ml-4 space-y-1 text-gray-600">
                            {it.order_addons.map((ad) => (
                              <li key={ad.id} className="flex justify-between">
                                <span>
                                  {ad.name}
                                  <span className="text-xs ml-1">x{ad.quantity}</span>
                                </span>
                                <span>{formatPrice(ad.price * ad.quantity)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {it.notes && (
                          <p className="ml-4 mt-1 italic text-gray-600">{it.notes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div>
                    <span className="font-medium">{o.order_type === 'delivery' ? 'Delivery' : 'Collection'}</span>
                    {o.delivery_address && (
                      <p className="text-sm text-gray-700">{formatAddress(o.delivery_address)}</p>
                    )}
                    {o.customer_notes && (
                      <p className="text-sm italic mt-1">{o.customer_notes}</p>
                    )}
                  </div>
                  <div className="text-right font-semibold">
                    Total: {formatPrice(o.total_price)}
                  </div>
                  {o.status === 'completed' && (
                    <button className="mt-2 px-4 py-2 bg-teal-600 text-white rounded">
                      Leave Review
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </CustomerLayout>
  );
}

export async function getStaticProps() {
  return {
    props: {
      customerMode: true,
      cartCount: 0,
    },
  };
}
