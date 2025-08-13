import Link from 'next/link'
import { useRouter } from 'next/router'
import CustomerLayout from '../../components/CustomerLayout'
import { useCart } from '../../context/CartContext'
import { useBrand } from '@/components/branding/BrandProvider'
import MoreCard from '@/components/customer/more/MoreCard'
import MoreSection from '@/components/customer/more/MoreSection'
import { UserIcon, ClipboardDocumentListIcon, InformationCircleIcon, ClockIcon, PhoneIcon } from '@heroicons/react/24/outline'

export default function RestaurantMorePage() {
  const router = useRouter()
  const { cart } = useCart()
  const brand = useBrand()
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0)

  const customPages: { title: string; slug: string }[] = []

  return (
    <CustomerLayout cartCount={itemCount}>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold">More</h1>
        <div className="w-16 h-1 mt-2" style={{ backgroundColor: brand?.brand }} />

        <MoreSection title="Your Account">
          <MoreCard index={0} title="Account" description="Manage your details" href="/restaurant/account" icon={<UserIcon className="w-8 h-8 text-gray-500" />} />
          <MoreCard index={1} title="Orders" description="View past orders" href="/restaurant/orders" icon={<ClipboardDocumentListIcon className="w-8 h-8 text-gray-500" />} />
        </MoreSection>

        <MoreSection title="About">
          <MoreCard index={0} title="About Us" description="Who we are" href="/restaurant/about" icon={<InformationCircleIcon className="w-8 h-8 text-gray-500" />} />
          <MoreCard index={1} title="Opening Times" description="When we're open" href="/restaurant/opening-times" icon={<ClockIcon className="w-8 h-8 text-gray-500" />} />
          <MoreCard index={2} title="Contact" description="Get in touch" href="/restaurant/contact" icon={<PhoneIcon className="w-8 h-8 text-gray-500" />} />
        </MoreSection>

        <MoreSection title="Extras">
          {customPages.length ? (
            customPages.map((p, i) => (
              <MoreCard key={p.slug} index={i} title={p.title} onClick={() => router.push(`/restaurant/${p.slug}`)} />
            ))
          ) : (
            <MoreCard index={0} title="Custom pages" description="Coming soon" />
          )}
        </MoreSection>

        <div className="mt-8 text-xs text-gray-500 flex flex-col sm:flex-row gap-2">
          <Link href="/restaurant/privacy" className="hover:text-gray-700">Privacy Policy</Link>
          <Link href="/restaurant/terms" className="hover:text-gray-700">Terms</Link>
        </div>
      </div>
    </CustomerLayout>
  )
}

