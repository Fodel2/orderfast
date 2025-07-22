import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import { supabase } from '../../utils/supabaseClient';
import { InboxIcon } from '@heroicons/react/24/outline';

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
  id: number;
  order_type: 'delivery' | 'collection';
  customer_name: string | null;
  phone_number: string | null;
  delivery_address: any;
  scheduled_for: string | null;
  customer_notes: string | null;
  status: string;
  order_items: OrderItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Record<number, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const { data: ru } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!ru) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_type,
          customer_name,
          phone_number,
          delivery_address,
          scheduled_for,
          customer_notes,
          status,
          order_items(
            id,
            name,
            price,
            quantity,
            notes,
            order_addons(id,name,price,quantity)
          )
        `)
        .eq('restaurant_id', ru.restaurant_id)
        .not('status', 'in', '(completed,cancelled)')
        .order('id', { ascending: true });
      if (!error && data) {
        setOrders(data as Order[]);
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const toggleOpen = (id: number) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateStatus = async (id: number, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    if (status === 'completed' || status === 'cancelled') {
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } else {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    }
  };

  const formatPrice = (p: number | null) => {
    return p ? `£${(p / 100).toFixed(2)}` : '£0.00';
  };

  const formatAddress = (addr: any) => {
    if (!addr) return '';
    return [addr.address_line_1, addr.address_line_2, addr.postcode]
      .filter(Boolean)
      .join(', ');
  };

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;

  const grouped = {
    pending: orders.filter((o) => o.status === 'pending'),
    accepted: orders.filter((o) => o.status === 'accepted'),
  } as const;

  const statusHeadings: Record<keyof typeof grouped, string> = {
    pending: 'Pending Orders',
    accepted: 'Accepted Orders',
  };

  return (
    <DashboardLayout>
      <div className="space-y-10">
        {(Object.keys(statusHeadings) as (keyof typeof grouped)[]).map((st) => (
          <section key={st}>
            <h2 className="text-xl font-bold mb-4">{statusHeadings[st]}</h2>
            {grouped[st].length === 0 ? (
              <div className="text-gray-500 flex items-center space-x-2">
                <InboxIcon className="w-5 h-5" />
                <span>No {statusHeadings[st].toLowerCase()}</span>
              </div>
            ) : (
              <div className="space-y-4">
                {grouped[st].map((o) => (
                  <div key={o.id} className="bg-white border rounded-lg shadow-md p-4 space-y-3">
                    <div
                      className="flex justify-between items-start cursor-pointer"
                      onClick={() => toggleOpen(o.id)}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">Order #{o.id}</h3>
                          <span className="px-2 py-0.5 text-xs rounded bg-teal-100 text-teal-700">
                            {o.order_type === 'delivery' ? 'Delivery' : 'Collection'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {o.scheduled_for ? new Date(o.scheduled_for).toLocaleString() : 'ASAP'}
                        </p>
                      </div>
                      <select
                        className="border rounded p-1 text-sm"
                        value={o.status}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    {openIds[o.id] && (
                      <div className="text-sm space-y-2 pt-2 border-t">
                        <p>
                          <strong>Customer:</strong> {o.customer_name || 'N/A'} {o.phone_number || ''}
                        </p>
                        {o.order_type === 'delivery' && o.delivery_address && (
                          <p>
                            <strong>Address:</strong> {formatAddress(o.delivery_address)}
                          </p>
                        )}
                        <ul className="space-y-2">
                          {o.order_items.map((it) => (
                            <li key={it.id} className="border rounded p-2">
                              <div className="flex justify-between">
                                <span>
                                  {it.name} × {it.quantity}
                                </span>
                                <span>{formatPrice(it.price * it.quantity)}</span>
                              </div>
                              {it.order_addons && it.order_addons.length > 0 && (
                                <ul className="mt-1 ml-4 space-y-1 text-gray-600">
                                  {it.order_addons.map((ad) => (
                                    <li key={ad.id} className="flex justify-between">
                                      <span>
                                        {ad.name} × {ad.quantity}
                                      </span>
                                      <span>{formatPrice(ad.price * ad.quantity)}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {it.notes && <p className="italic ml-4 mt-1">{it.notes}</p>}
                            </li>
                          ))}
                        </ul>
                        {o.customer_notes && <p className="italic">{o.customer_notes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </DashboardLayout>
  );
}
