import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useUser } from '@/lib/useUser'
import { getGuestEmail } from '@/lib/guestUtils'

export default function OrdersPage() {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const { user, loading } = useUser()
  const [guestEmail, setGuestEmail] = useState<string | null>(null)
  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    const email = localStorage.getItem('guest_email')
    setGuestEmail(email)
  }, [])

  useEffect(() => {
    if (!loading && !user && !guestEmail) {
      router.replace('/login')
    }
  }, [loading, user, guestEmail])

  useEffect(() => {
    if (!user && !guestEmail) return

    const fetchOrders = async () => {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
      if (user) query = query.eq('user_id', user.id)
      else if (guestEmail) query = query.eq('guest_email', guestEmail)
      const { data } = await query
      setOrders(data || [])
    }

    fetchOrders()
  }, [user, guestEmail])

  if (!user && !guestEmail) return null

  return (
    <div className="max-w-screen-sm mx-auto px-4 pb-24">
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

