import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useUser } from '@/lib/useUser'
import { useRouter } from 'next/router'
import CustomerLayout from '../../components/CustomerLayout'
import { useCart } from '../../context/CartContext'

export default function OrdersPage() {
  const supabase = useSupabaseClient()
  const { user, loading } = useUser()
  const router = useRouter()
  const forcedUserId = typeof router.query.user_id === 'string' ? router.query.user_id : undefined
  const [orders, setOrders] = useState<any[]>([])
  const { cart } = useCart()
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0)

  useEffect(() => {
    if (loading) return
    const targetUserId = forcedUserId || user?.id
    if (!targetUserId) return

    const fetchOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })

      setOrders(data || [])
    }

    fetchOrders()
  }, [forcedUserId, user, loading, supabase])

  if (loading) return null

  if (!forcedUserId && !user) {
    return (
      <CustomerLayout cartCount={itemCount}>
        <div className="max-w-screen-sm mx-auto px-4 pb-24 flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">You have no orders yet</h2>
            <p className="text-gray-500">Log in to view your orders.</p>
          </div>
        </div>
      </CustomerLayout>
    )
  }

  return (
    <CustomerLayout cartCount={itemCount}>
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
                <div className="text-sm">Total: £{Number(order.total_price ?? 0).toFixed(2)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CustomerLayout>
  )
}
