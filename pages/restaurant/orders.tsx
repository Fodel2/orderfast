import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useUser } from '@/lib/useUser'

export default function OrdersPage() {
  const supabase = useSupabaseClient()
  const { user, loading } = useUser()
  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    if (!user || loading) return
    const fetchOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', '358bbecc-4437-4cdf-bbea-bc0ffc0cb1ba')
        .order('created_at', { ascending: false })

      setOrders(data || [])
    }
    fetchOrders()
  }, [user, loading])

  if (loading) return null

  if (!user) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 pb-24 flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">You have no orders yet</h2>
          <p className="text-gray-500">Log in to view your orders.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-screen-sm mx-auto px-4 pb-24">
      <pre>{JSON.stringify(orders, null, 2)}</pre>
      <h1 className="text-xl font-semibold mb-4">Your Orders</h1>
      {orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <ul className="space-y-4">
          {orders.map(order => (
            <li key={order.id} className="border p-4 rounded">
              <div className="font-bold">Order #{order.id.slice(0, 4)}</div>
              <div>{order.status}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

