import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useUser } from '@/lib/useUser'
import { useRouter } from 'next/router'

export default function OrdersPage() {
  const supabase = useSupabaseClient()
  const { user, loading } = useUser()
  const router = useRouter()
  const qUserId = typeof router.query.user_id === 'string' ? router.query.user_id : undefined
  const qRestaurantId = typeof router.query.restaurant_id === 'string' ? router.query.restaurant_id : undefined

  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    if (loading) return

    const fetchOrders = async () => {
      const targetUserId = qUserId || user?.id
      if (!targetUserId) {
        setOrders([])
        return
      }

      let query = supabase
        .from('orders')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })

      if (qRestaurantId) {
        query = query.eq('restaurant_id', qRestaurantId)
      }

      const { data, error } = await query
      if (error) {
        console.error('[orders] fetch error', error)
      }
      setOrders(data || [])
    }

    fetchOrders()
  }, [qUserId, qRestaurantId, user, loading, supabase])

  if (loading) return null

  return (
    <div className="max-w-screen-sm mx-auto px-4 pb-24">
      <h1 className="text-xl font-semibold mb-4">Your Orders</h1>
      {orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <ul className="space-y-4">
          {orders.map((order: any) => (
            <li key={order.id} className="border p-4 rounded">
              <div className="font-bold">Order #{String(order.short_order_number ?? order.id).slice(0, 4)}</div>
              <div className="text-sm text-gray-600">{order.status}</div>
              <div className="text-sm">Placed: {new Date(order.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
