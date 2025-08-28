import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useUser } from '@/lib/useUser'
import { useRouter } from 'next/router'
import CustomerLayout from '../../components/CustomerLayout'
import OrderDetailsModal from '@/components/customer/OrderDetailsModal'
import { displayOrderNo } from '@/lib/orderDisplay'
import { useRestaurant } from '@/lib/restaurant-context'

export default function OrdersPage({ initialBrand }: { initialBrand: any | null }) {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const { user, loading } = useUser()

  const qUserIdRaw = router.query.user_id
  const qUserId = typeof qUserIdRaw === 'string' && qUserIdRaw.trim() !== '' ? qUserIdRaw : undefined
  const { restaurantId, loading: ridLoading } = useRestaurant()

  const [orders, setOrders] = useState<any[]>([])
  const [effectiveUserId, setEffectiveUserId] = useState<string | undefined>(undefined)
  const [resolvingUser, setResolvingUser] = useState<boolean>(true)
  const [activeOrder, setActiveOrder] = useState<any | null>(null)

  const closeOrder = () => setActiveOrder(null)
  const openOrder = (o: any) => { setActiveOrder(o); loadOrderDetails(o.id) }

  console.debug(
    '[orders] ready=',
    router.isReady,
    'qUserId=',
    qUserId,
    'authUser=',
    user?.id,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOrder()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function resolveUserId() {
      // If a valid ?user_id is present, use it immediately.
      if (qUserId) {
        if (!cancelled) {
          setEffectiveUserId(qUserId)
          setResolvingUser(false)
        }
        return
      }

      // Next, try the user hook.
      if (!loading && user?.id) {
        if (!cancelled) {
          setEffectiveUserId(user.id)
          setResolvingUser(false)
        }
        return
      }

      // Finally, ask Supabase directly (handles cases where hook is late).
      const { data, error } = await supabase.auth.getUser()
      if (!cancelled) {
        if (error) console.warn('[orders] getUser error', error)
        setEffectiveUserId(data?.user?.id || undefined)
        setResolvingUser(false)
      }
    }

    // Only run when router is ready so query params are stable.
    if (router.isReady) resolveUserId()
    return () => { cancelled = true }
  }, [router.isReady, qUserId, loading, user?.id, supabase])

  useEffect(() => {
    if (!router.isReady) return
    if (resolvingUser) return
    if (!effectiveUserId) {
      setOrders([])
      return
    }

    const fetchOrders = async () => {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
      if (restaurantId) {
        query = query.eq('restaurant_id', restaurantId)
      }

      const { data, error } = await query
      if (error) console.error('[orders] fetch error', error)
      setOrders(data || [])
    }

    fetchOrders()
  }, [router.isReady, resolvingUser, effectiveUserId, restaurantId, supabase])

  // Lock body scroll while modal open
  useEffect(() => {
    if (!activeOrder) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [activeOrder])

  // Lazy-load items + add-ons for a given order
  async function loadOrderDetails(orderId: string) {
    // 1) Items
    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('id, item_id, name, quantity, price, notes')
      .eq('order_id', orderId)

    if (itemsErr) {
      console.error('[orders] items error', itemsErr)
      setActiveOrder(o => (o && o.id === orderId ? { ...o, items: [], itemSubtotal: 0 } : o))
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

    setActiveOrder(o => (o && o.id === orderId ? { ...o, items: withAddons, itemSubtotal: itemsSubtotal } : o))
  }

  if (loading) return null

  if (!ridLoading && !restaurantId) {
    return (
      <CustomerLayout>
        <div className="p-4 text-center text-red-500">No restaurant specified</div>
      </CustomerLayout>
    )
  }

  return (
    <CustomerLayout>
      <div className="max-w-screen-sm mx-auto px-4 pb-24">
        {router.query.debug === '1' && (
          <div className="text-xs text-gray-500 mb-2">
            Using user_id: {qUserId || user?.id || '—'} | restaurant_id: {restaurantId || '—'} | orders: {orders?.length ?? 0}
          </div>
        )}
        <h1 className="text-xl font-semibold mb-4">Your Orders</h1>
        {resolvingUser && (
          <div className="text-xs text-gray-500 mb-2">Loading your orders…</div>
        )}
        {orders.length === 0 ? (
          <p>No orders found.</p>
        ) : (
          <ul className="space-y-4">
            {orders.map((order: any) => (
              <li
                key={order.id}
                className="rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow md:hover:shadow-md transition"
                style={{ background: 'var(--card)', color: 'var(--ink)' }}
                role="button"
                tabIndex={0}
                onClick={() => openOrder(order)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openOrder(order)
                  }
                }}
                aria-label={`Open details for order ${displayOrderNo(order)}`}
              >
                <div className="flex items-baseline justify-between">
                  <div className="text-base font-semibold">Order {displayOrderNo(order)}</div>
                  {order.status && (
                    <span className="ml-2 text-xs rounded-full px-2 py-0.5 pill capitalize">
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
        {activeOrder && <OrderDetailsModal order={activeOrder} onClose={closeOrder} />}
      </div>
    </CustomerLayout>
  )
}

import { supaServer } from '@/lib/supaServer'
import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async ctx => {
  const pick = (v: any) => (Array.isArray(v) ? v[0] : v)
  const id =
    (pick(ctx.query.restaurant_id) as string) ||
    (pick(ctx.query.id) as string) ||
    (pick(ctx.query.r) as string) ||
    null
  let initialBrand = null
  if (id) {
    const { data } = await supaServer()
      .from('restaurants')
      .select('id,website_title,name,logo_url,logo_shape,brand_primary_color,brand_secondary_color')
      .eq('id', id)
      .maybeSingle()
    initialBrand = data
  }
  return { props: { initialBrand } }
}
