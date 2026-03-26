import Link from 'next/link'
import { useRouter } from 'next/router'
import CustomerLayout from '../../components/CustomerLayout'
import { useCart } from '../../context/CartContext'
import { useBrand } from '@/components/branding/BrandProvider'
import MoreCard from '@/components/customer/more/MoreCard'
import MoreSection from '@/components/customer/more/MoreSection'
import { UserIcon, ClipboardDocumentListIcon, InformationCircleIcon, ClockIcon, PhoneIcon, MegaphoneIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRestaurant } from '@/lib/restaurant-context'

type RestaurantSocials = {
  instagram_url?: string | null
  facebook_url?: string | null
  tiktok_url?: string | null
  x_url?: string | null
  youtube_url?: string | null
}

const normalizeExternalUrl = (value: string | null | undefined) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return null
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

const SocialIcon = ({ kind }: { kind: 'instagram' | 'facebook' | 'tiktok' | 'x' | 'youtube' }) => {
  const common = { className: 'h-5 w-5', 'aria-hidden': true as const, fill: 'currentColor', viewBox: '0 0 24 24' }
  if (kind === 'instagram') return <svg {...common}><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Zm5.2-1.9a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" /></svg>
  if (kind === 'facebook') return <svg {...common}><path d="M13.5 21.5v-8h2.6l.4-3h-3V8.7c0-.9.2-1.5 1.5-1.5h1.6V4.5c-.3 0-1.3-.1-2.5-.1-2.4 0-4.1 1.5-4.1 4.3v1.8H7.5v3h2.4v8h3.6Z" /></svg>
  if (kind === 'tiktok') return <svg {...common}><path d="M16.9 3c.3 1.4 1.1 2.6 2.3 3.4.9.6 1.9 1 2.8 1.1v2.8c-1.5 0-3-.4-4.3-1.2v5.8c0 3.2-2.6 5.8-5.8 5.8S6 18.1 6 14.9 8.6 9 11.8 9c.3 0 .5 0 .8.1v2.9a3 3 0 0 0-.8-.1 3 3 0 1 0 3 3V3h2.1Z" /></svg>
  if (kind === 'youtube') return <svg {...common}><path d="M22.5 8.1a3 3 0 0 0-2.1-2.1C18.6 5.5 12 5.5 12 5.5s-6.6 0-8.4.5A3 3 0 0 0 1.5 8.1 31 31 0 0 0 1 12a31 31 0 0 0 .5 3.9 3 3 0 0 0 2.1 2.1c1.8.5 8.4.5 8.4.5s6.6 0 8.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23 12a31 31 0 0 0-.5-3.9ZM10 15.5v-7l6 3.5-6 3.5Z" /></svg>
  return <svg {...common}><path d="m3 3 7.1 9.5L3.2 21h2.3l5.6-6.7 5 6.7H21l-7.4-9.9L20.1 3h-2.3l-5.2 6.3L7.8 3H3Z" /></svg>
}

export default function RestaurantMorePage({ initialBrand }: { initialBrand: any | null }) {
  const router = useRouter()
  const { cart } = useCart()
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0)
  const [restaurant, setRestaurant] = useState<(RestaurantSocials & Record<string, any>) | null>(initialBrand)
  const [pages, setPages] = useState<{ title: string; slug: string }[]>([])
  const brand = useBrand()
  const { restaurantId, loading } = useRestaurant()

  useEffect(() => {
    if (loading || !restaurantId) return
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
  }, [restaurantId, loading])

  if (!loading && !restaurantId) {
    return (
      <CustomerLayout cartCount={itemCount}>
        <div className="container mx-auto max-w-5xl px-4 py-8 text-center text-red-500">No restaurant specified</div>
      </CustomerLayout>
    )
  }

  const socialLinks = [
    { key: 'instagram', label: 'Instagram', href: normalizeExternalUrl(restaurant?.instagram_url) },
    { key: 'facebook', label: 'Facebook', href: normalizeExternalUrl(restaurant?.facebook_url) },
    { key: 'tiktok', label: 'TikTok', href: normalizeExternalUrl(restaurant?.tiktok_url) },
    { key: 'x', label: 'X', href: normalizeExternalUrl(restaurant?.x_url) },
    { key: 'youtube', label: 'YouTube', href: normalizeExternalUrl(restaurant?.youtube_url) },
  ].filter((item): item is { key: 'instagram' | 'facebook' | 'tiktok' | 'x' | 'youtube'; label: string; href: string } => Boolean(item.href))
  const withRestaurantQuery = (pathname: string) =>
    restaurantId
      ? { pathname, query: { restaurant_id: restaurantId } }
      : pathname;

  return (
      <CustomerLayout cartCount={itemCount}>
        <div className="container mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-bold">More</h1>
        <div className="w-16 h-1 mt-2" style={{ backgroundColor: brand?.brand }} />

        <MoreSection title="Your Account">
          <MoreCard index={0} title="Account" description="Manage your details" href={withRestaurantQuery('/restaurant/account')} icon={<UserIcon className="w-8 h-8 text-gray-500" />} />
          <MoreCard index={1} title="Orders" description="View past orders" href={withRestaurantQuery('/restaurant/orders')} icon={<ClipboardDocumentListIcon className="w-8 h-8 text-gray-500" />} />
          <MoreCard index={2} title="Promotions" description="Apply one offer per order" href={withRestaurantQuery('/restaurant/promotions')} icon={<MegaphoneIcon className="w-8 h-8 text-gray-500" />} />
        </MoreSection>

        <MoreSection title="About">
          <MoreCard index={0} title="About Us" description="Who we are" href={withRestaurantQuery('/restaurant/about')} icon={<InformationCircleIcon className="w-8 h-8 text-gray-500" />} />
          <MoreCard index={1} title="Opening Times" description="When we're open" href={withRestaurantQuery('/restaurant/opening-times')} icon={<ClockIcon className="w-8 h-8 text-gray-500" />} />
          <MoreCard index={2} title="Contact" description="Get in touch" href={withRestaurantQuery('/restaurant/contact')} icon={<PhoneIcon className="w-8 h-8 text-gray-500" />} />
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

        {socialLinks.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white/70 p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700">Follow us</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {socialLinks.map(({ key, label, href }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                >
                  <SocialIcon kind={key} />
                </a>
              ))}
            </div>
          </div>
        ) : null}

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
    const { data } = await supaServer
      .from('restaurants')
      .select('id,website_title,name,logo_url,logo_shape,brand_primary_color,brand_secondary_color,currency_code,instagram_url,facebook_url,tiktok_url,x_url,youtube_url')
      .eq('id', id)
      .maybeSingle()
    initialBrand = data
  }
  return { props: { initialBrand } }
}
