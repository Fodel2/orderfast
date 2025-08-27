import Link from 'next/link'
import { useRouter } from 'next/router'
import CustomerLayout from '../../components/CustomerLayout'
import { useCart } from '../../context/CartContext'
import { useBrand } from '@/components/branding/BrandProvider'
import MoreCard from '@/components/customer/more/MoreCard'
import MoreSection from '@/components/customer/more/MoreSection'
import { UserIcon, ClipboardDocumentListIcon, InformationCircleIcon, ClockIcon, PhoneIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import resolveRestaurantId from '@/lib/resolveRestaurantId'

export default function RestaurantMorePage({ initialBrand }: { initialBrand: any | null }) {
  const router = useRouter()
  const { cart } = useCart()
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0)
  const [restaurant, setRestaurant] = useState<any | null>(initialBrand)
  const [pages, setPages] = useState<{ title: string; slug: string }[]>([])
  const brand = useBrand()
  const restaurantId = resolveRestaurantId(router, brand, restaurant)

  useEffect(() => {
    if (!router.isReady || !restaurantId) return
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .maybeSingle()
      .then(({ data }) => setRestaurant(data))
    supabase
      .from('custom_pages')
      .select('title,slug')
      .eq('restaurant_id', restaurantId)
      .eq('show_in_nav', true)
      .order('sort_order', { ascending: true, nullsFirst: true })
      .then(({ data }) => setPages((data as any[]) || []))
  }, [router.isReady, restaurantId])

  return (
      <CustomerLayout cartCount={itemCount} restaurant={restaurant}>
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
          {pages.length ? (
            pages.map((p, i) => (
              <MoreCard key={p.slug} index={i} title={p.title} onClick={() => router.push(`/restaurant/p/${p.slug}`)} />
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

