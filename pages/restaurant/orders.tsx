import { useEffect, useMemo, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useUser } from '@/lib/useUser'
import { useRouter } from 'next/router'
import CustomerLayout from '../../components/CustomerLayout'

export default function OrdersPage() {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const { user, loading } = useUser()

  // Read current query
  const qUserId = typeof router.query.user_id === 'string' ? router.query.user_id : undefined
  const qRestaurantId = typeof router.query.restaurant_id === 'string' ? router.query.restaurant_id : undefined

  // Orders + modal state
  const [orders, setOrders] = useState<any[]>([])
  const [activeOrder, setActiveOrder] = useState<any | null>(null)
  const [details, setDetails] = useState<{
    loading?: boolean
    items?: Array<any>
    itemSubtotal?: number
  }>({})

  // Keep track if we're normalizing the URL (prevents double fetch)
  const [normalizingUrl, setNormalizingUrl] = useState(false)

  const effectiveUserId = qUserId || user?.id
  const canFetch = router.isReady && !loading && !!effectiveUserId && !normalizingUrl

  const closeOrder = () => { setActiveOrder(null); setDetails({}) }
  const openOrder = (o: any) => { setActiveOrder(o); loadOrderDetails(o.id, o) }

  console.debug(
    '[orders] ready=',
    router.isReady,
    'qUserId=',
    qUserId,
    'authUser=',
    user?.id,
    'canFetch=',
    canFetch,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOrder()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!router.isReady) return
    if (loading) return
    if (!qUserId && user?.id) {
      setNormalizingUrl(true)
      const next = { ...router.query, user_id: user.id }
      router
        .replace({ pathname: router.pathname, query: next }, undefined, { shallow: true })
        .finally(() => setNormalizingUrl(false))
    }
  }, [router.isReady, loading, qUserId, user?.id])

  useEffect(() => {
    if (!canFetch) return
    const fetchOrders = async () => {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('user_id', effectiveUserId as string)
        .order('created_at', { ascending: false })
      if (qRestaurantId) query = query.eq('restaurant_id', qRestaurantId)
      const { data, error } = await query
      if (error) console.error('[orders] fetch error', error)
      setOrders(data || [])
    }
    fetchOrders()
  }, [canFetch, supabase, effectiveUserId, qRestaurantId])

  // Lock body scroll while modal open
  useEffect(() => {
    if (!activeOrder) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [activeOrder])

  // Lazy-load items + add-ons for a given order
  async function loadOrderDetails(orderId: string, orderObj: any) {
    setDetails({ loading: true })

    // 1) Items
    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('id, item_id, name, quantity, price, notes')
      .eq('order_id', orderId)

    if (itemsErr) {
      console.error('[orders] items error', itemsErr)
      setDetails({ loading: false, items: [], itemSubtotal: 0 })
      return
    }

    let withAddons = items || []
    let addonsSubtotal = 0

    if (withAddons.length > 0) {
      const itemIds = withAddons.map(i => i.id)
      const { data: addons, error: addonsErr } = await supabase
        .from('order_addons')
        .select('id, order_item_id, name, quantity, price')
        .in('order_item_id', itemIds)

      if (addonsErr) {
        console.error('[orders] addons error', addonsErr)
      }

      const byItem: Record<string, any[]> = {}
      ;(addons || []).forEach(a => {
        byItem[a.order_item_id] = byItem[a.order_item_id] || []
        byItem[a.order_item_id].push(a)
        const aq = Number(a.quantity || 0)
        const ap = Number(a.price || 0)
        addonsSubtotal += aq * ap
      })

      withAddons = withAddons.map(it => ({
        ...it,
        addons: byItem[it.id] || [],
      }))
    }

    // Compute item-level subtotal (items + addons)
    const itemsSubtotal =
      (withAddons || []).reduce((sum, it) => {
        const q = Number(it.quantity || 0)
        const p = Number(it.price || 0)
        return sum + q * p
      }, 0) + addonsSubtotal

    setDetails({
      loading: false,
      items: withAddons,
      itemSubtotal: itemsSubtotal,
    })
  }

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
        {!qUserId && user?.id && (
          <div className="text-xs text-gray-500 mb-2">Loading your orders…</div>
        )}
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
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={closeOrder} />
            <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-6 z-[10000]">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-base sm:text-lg font-semibold">
                  Order #{String(activeOrder.short_order_number ?? activeOrder.id).slice(0, 4)}
                </div>
                <button onClick={closeOrder} className="text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
              </div>

              {/* Status + Placed */}
              <div className="flex items-center gap-2 mb-2">
                {activeOrder.status && (
                  <span className="text-xs rounded-full px-2 py-0.5 bg-gray-100 text-gray-700 capitalize">
                    {String(activeOrder.status).replace(/_/g,' ')}
                  </span>
                )}
                <div className="text-sm text-gray-600">
                  Placed: {activeOrder.created_at ? new Date(activeOrder.created_at).toLocaleString() : '—'}
                </div>
              </div>

              {/* Items */}
              <div className="mt-3">
                <div className="text-sm font-medium mb-2">Items</div>
                {details.loading && <div className="text-sm text-gray-500">Loading items…</div>}
                {!details.loading && (!details.items || details.items.length === 0) && (
                  <div className="text-sm text-gray-500">No items found for this order.</div>
                )}
                {!details.loading && Array.isArray(details.items) && details.items.length > 0 && (
                  <ul className="space-y-3">
                    {details.items.map((it: any) => (
                      <li key={it.id} className="text-sm text-gray-800">
                        <div className="flex justify-between">
                          <span>
                            <span className="font-medium">{it.name ?? 'Item'}</span>
                            {typeof it.quantity === 'number' && <span> × {it.quantity}</span>}
                          </span>
                          {typeof it.price === 'number' && (
                            <span>£{Number(it.price).toFixed(2)}</span>
                          )}
                        </div>
                        {it.notes && <div className="text-xs text-gray-500 mt-0.5">Notes: {it.notes}</div>}
                        {Array.isArray(it.addons) && it.addons.length > 0 && (
                          <ul className="mt-2 pl-3 border-l">
                            {it.addons.map((a: any) => (
                              <li key={a.id} className="flex justify-between text-xs text-gray-700">
                                <span>{a.name ?? 'Addon'}{typeof a.quantity === 'number' && <> × {a.quantity}</>}</span>
                                {typeof a.price === 'number' && <span>£{Number(a.price).toFixed(2)}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Totals */}
              <div className="border-t pt-3 mt-4 text-sm">
                {typeof details.itemSubtotal === 'number' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Items subtotal</span>
                    <span className="font-medium">£{details.itemSubtotal.toFixed(2)}</span>
                  </div>
                )}
                {typeof activeOrder.delivery_fee === 'number' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Delivery fee</span>
                    <span className="font-medium">£{Number(activeOrder.delivery_fee).toFixed(2)}</span>
                  </div>
                )}
                {typeof activeOrder.service_fee === 'number' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service fee</span>
                    <span className="font-medium">£{Number(activeOrder.service_fee).toFixed(2)}</span>
                  </div>
                )}
                {typeof activeOrder.total_price === 'number' && (
                  <div className="flex justify-between">
                    <span className="text-gray-800">Total</span>
                    <span className="font-semibold">£{Number(activeOrder.total_price).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                <button className="flex-1 py-2 rounded-xl border text-sm font-medium hover:bg-gray-50" onClick={closeOrder}>
                  Close
                </button>
                <button className="flex-1 py-2 rounded-xl bg-black text-white text-sm font-medium hover:opacity-90" onClick={() => { closeOrder() }}>
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
