import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useUser } from '@/lib/useUser'
import { useRouter } from 'next/router'
import CustomerLayout from '../../components/CustomerLayout'

export default function OrdersPage() {
  const supabase = useSupabaseClient()
  const { user, loading } = useUser()
  const router = useRouter()
  const qUserId = typeof router.query.user_id === 'string' ? router.query.user_id : undefined
  const qRestaurantId = typeof router.query.restaurant_id === 'string' ? router.query.restaurant_id : undefined

  const [orders, setOrders] = useState<any[]>([])
  const [activeOrder, setActiveOrder] = useState<any | null>(null)
  const openOrder = (o: any) => setActiveOrder(o)
  const closeOrder = () => setActiveOrder(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOrder()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // If user_id is missing but we have an authenticated user, update the URL once (no full reload)
  useEffect(() => {
    if (!router.isReady) return
    if (loading) return
    if (!qUserId && user?.id) {
      const nextQuery = { ...router.query, user_id: user.id }
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
    }
  }, [router.isReady, loading, qUserId, user?.id])

  useEffect(() => {
    if (!router.isReady) return
    if (loading) return
    const targetUserId = qUserId || user?.id
    if (!targetUserId) {
      setOrders([])
      return
    }
    const fetchOrders = async () => {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
      if (qRestaurantId) query = query.eq('restaurant_id', qRestaurantId)
      const { data, error } = await query
      if (error) console.error('[orders] fetch error', error)
      setOrders(data || [])
    }
    fetchOrders()
  }, [router.isReady, qUserId, qRestaurantId, user?.id, loading, supabase])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (activeOrder) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [activeOrder])

  if (loading) return null

  return (
    <CustomerLayout>
      <div className="max-w-screen-sm mx-auto px-4 pb-24">
        {router.query.debug === '1' && (
          <div className="text-xs text-gray-500 mb-2">
            Using user_id: {qUserId || user?.id || '—'} | restaurant_id: {qRestaurantId || '—'} | orders: {orders?.length ?? 0}
          </div>
        )}
        <h1 className="text-xl font-semibold mb-4">Your Orders</h1>
        {orders.length === 0 ? (
          <p>No orders found.</p>
        ) : (
          <ul className="space-y-4">
            {orders.map((order: any) => (
              <li
                key={order.id}
                className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow md:hover:shadow-md transition"
                role="button"
                tabIndex={0}
                onClick={() => openOrder(order)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openOrder(order)
                  }
                }}
                aria-label={`Open details for order ${String(order.short_order_number ?? order.id).slice(0, 4)}`}
              >
                <div className="flex items-baseline justify-between">
                  <div className="text-base font-semibold">Order #{String(order.short_order_number ?? order.id).slice(0, 4)}</div>
                  {order.status && (
                    <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-gray-100 text-gray-700 capitalize">
                      {String(order.status).replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">Placed: {order.created_at ? new Date(order.created_at).toLocaleString() : '—'}</div>
                <div className="text-xs text-gray-400 mt-1">Tap for details</div>
              </li>
            ))}
          </ul>
        )}
        {activeOrder && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeOrder} />
            {/* Panel */}
            <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-6 z-[210]">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-base sm:text-lg font-semibold">
                  Order #{String(activeOrder.short_order_number ?? activeOrder.id).slice(0, 4)}
                </div>
                <button
                  onClick={closeOrder}
                  className="text-gray-500 hover:text-gray-700 focus:outline-none"
                  aria-label="Close order details"
                >
                  ✕
                </button>
              </div>

              {/* Status + Placed */}
              <div className="flex items-center gap-2 mb-2">
                {activeOrder.status && (
                  <span className="text-xs rounded-full px-2 py-0.5 bg-gray-100 text-gray-700 capitalize">
                    {String(activeOrder.status).replace(/_/g, ' ')}
                  </span>
                )}
                <div className="text-sm text-gray-600">
                  Placed: {activeOrder.created_at ? new Date(activeOrder.created_at).toLocaleString() : '—'}
                </div>
              </div>

              {/* Items (defensive: supports common shapes if present) */}
              {Array.isArray(activeOrder.items) && activeOrder.items.length > 0 && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-2">Items</div>
                  <ul className="space-y-2">
                    {activeOrder.items.map((it: any, idx: number) => (
                      <li key={idx} className="text-sm text-gray-800">
                        <span className="font-medium">{it?.name ?? it?.title ?? 'Item'}</span>
                        {typeof it?.quantity === 'number' && <span> × {it.quantity}</span>}
                        {typeof it?.price === 'number' && <span className="ml-1">• £{Number(it.price).toFixed(2)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes */}
              {activeOrder.notes && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-1">Customer notes</div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{activeOrder.notes}</div>
                </div>
              )}

              {/* Totals */}
              {(typeof activeOrder.subtotal === 'number' || typeof activeOrder.total === 'number') && (
                <div className="border-t pt-3 mt-4 text-sm">
                  {typeof activeOrder.subtotal === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">£{Number(activeOrder.subtotal).toFixed(2)}</span>
                    </div>
                  )}
                  {typeof activeOrder.total === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-800">Total</span>
                      <span className="font-semibold">£{Number(activeOrder.total).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions (placeholder for future tracking) */}
              <div className="mt-4 flex gap-2">
                <button className="flex-1 py-2 rounded-xl border text-sm font-medium hover:bg-gray-50" onClick={closeOrder}>
                  Close
                </button>
                <button
                  className="flex-1 py-2 rounded-xl bg-black text-white text-sm font-medium hover:opacity-90"
                  onClick={() => {
                    // Placeholder: hook up tracking/navigation later
                    closeOrder()
                  }}
                >
                  Track Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  )
}
