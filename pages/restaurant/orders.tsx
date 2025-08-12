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
  const debug = router.query.debug === '1'

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
    <CustomerLayout>
      <div className="max-w-screen-sm mx-auto px-4 pb-24">
        {debug && (
          <div className="text-xs text-gray-500 mb-2">
            Using user_id: {qUserId || user?.id || '—'} | restaurant_id: {qRestaurantId || '—'}
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
                className="border p-4 rounded cursor-pointer hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
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
                <div className="font-bold">Order #{String(order.short_order_number ?? order.id).slice(0, 4)}</div>
                <div className="text-sm text-gray-600">{order.status}</div>
                <div className="text-sm">Placed: {new Date(order.created_at).toLocaleString()}</div>
                <div className="text-xs text-gray-400 mt-1">Tap for details</div>
              </li>
            ))}
          </ul>
        )}
        {activeOrder && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            aria-modal="true"
            role="dialog"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40"
              onClick={closeOrder}
            />
            {/* Sheet/Modal */}
            <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 sm:p-6 z-10">
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

              {/* Status row */}
              <div className="text-sm text-gray-600 mb-2">
                Status: <span className="font-medium">{activeOrder.status ?? '—'}</span>
              </div>

              {/* Meta */}
              <div className="text-sm text-gray-600 mb-4">
                Placed: {activeOrder.created_at ? new Date(activeOrder.created_at).toLocaleString() : '—'}
              </div>

              {/* Items / Notes (show if present on the order object; otherwise omit) */}
              {Array.isArray(activeOrder.items) && activeOrder.items.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Items</div>
                  <ul className="space-y-2">
                    {activeOrder.items.map((it: any, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700">
                        <span className="font-medium">{it?.name ?? 'Item'}</span>
                        {typeof it?.quantity === 'number' && <span> × {it.quantity}</span>}
                        {typeof it?.price === 'number' && <span className="ml-1">— £{Number(it.price).toFixed(2)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeOrder.notes && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-1">Customer notes</div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{activeOrder.notes}</div>
                </div>
              )}

              {/* Totals (only if present) */}
              {(typeof activeOrder.subtotal === 'number' || typeof activeOrder.total === 'number') && (
                <div className="border-t pt-3 mt-3 text-sm">
                  {typeof activeOrder.subtotal === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">£{Number(activeOrder.subtotal).toFixed(2)}</span>
                    </div>
                  )}
                  {typeof activeOrder.total === 'number' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total</span>
                      <span className="font-semibold">£{Number(activeOrder.total).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions (non-destructive placeholders; no logic changed) */}
              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 py-2 rounded-xl border text-sm font-medium hover:bg-gray-50"
                  onClick={closeOrder}
                >
                  Close
                </button>
                <button
                  className="flex-1 py-2 rounded-xl bg-black text-white text-sm font-medium hover:opacity-90"
                  onClick={() => {
                    // Placeholder for future tracking/navigation
                    // e.g., router.push(`/restaurant/orders/${activeOrder.id}`)
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
