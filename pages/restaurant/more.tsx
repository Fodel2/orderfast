import { useRouter } from 'next/router'
import CustomerLayout from '../../components/CustomerLayout'
import { useCart } from '../../context/CartContext'

export default function RestaurantMorePage() {
  const router = useRouter()
  const { cart } = useCart()
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0)

  return (
    <CustomerLayout cartCount={itemCount}>
    <div className="max-w-screen-sm mx-auto px-4 pb-24">
      <h1 className="text-xl font-semibold mb-4">More</h1>

      {/* Sections are placeholders. Do not fetch data yet. */}
      <div className="space-y-4">
        <section className="rounded-xl p-4 shadow" style={{ background: 'var(--card)', color: 'var(--ink)' }}>
          <h2 className="font-medium mb-1">Account</h2>
          <p className="text-sm text-gray-600">Sign in/out and order history (customer auth TBD).</p>
        </section>

        <section className="rounded-xl p-4 shadow" style={{ background: 'var(--card)', color: 'var(--ink)' }}>
          <h2 className="font-medium mb-1">About</h2>
          <p className="text-sm text-gray-600">Restaurant description, address, phone (to be pulled from settings later).</p>
        </section>

        <section className="rounded-xl p-4 shadow" style={{ background: 'var(--card)', color: 'var(--ink)' }}>
          <h2 className="font-medium mb-1">Opening Times</h2>
          <p className="text-sm text-gray-600">Display hours; will read from restaurant settings in a later step.</p>
        </section>

        <section className="rounded-xl p-4 shadow" style={{ background: 'var(--card)', color: 'var(--ink)' }}>
          <h2 className="font-medium mb-1">Pages</h2>
          <p className="text-sm text-gray-600">Custom pages (from restaurant_pages) to be listed here in a later step.</p>
        </section>

        <section className="rounded-xl p-4 shadow" style={{ background: 'var(--card)', color: 'var(--ink)' }}>
          <h2 className="font-medium mb-1">Contact</h2>
          <p className="text-sm text-gray-600">Map, phone, email, social links—wired after settings UI is added.</p>
        </section>
      </div>
    </div>
    </CustomerLayout>
  )
}

