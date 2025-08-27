import { LogOut, User, Percent, Mail, Info, FileText, Shield } from 'lucide-react';
import CustomerLayout from '../components/CustomerLayout';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import resolveRestaurantId from '@/lib/resolveRestaurantId';

export default function MorePage() {
  const router = useRouter();
  const [pages, setPages] = useState<{ title: string; slug: string }[]>([]);
  const isLoggedIn = true; // TODO: replace with real auth check

  useEffect(() => {
    const rid = resolveRestaurantId(router, null, null);
    if (!router.isReady || !rid) return;
    supabase
      .from('custom_pages')
      .select('title,slug')
      .eq('restaurant_id', rid)
      .eq('show_in_nav', true)
      .order('sort_order', { ascending: true, nullsFirst: true })
      .then(({ data }) => setPages((data as any[]) || []));
  }, [router.isReady]);

  const items = [
    isLoggedIn && {
      title: 'Profile',
      icon: <User className="w-5 h-5" />,
      href: '/account',
    },
    {
      title: 'Promo Codes',
      icon: <Percent className="w-5 h-5" />,
      href: '/promos',
    },
    {
      title: 'Contact Us',
      icon: <Mail className="w-5 h-5" />,
      href: '/contact',
    },
    {
      title: 'About Us',
      icon: <Info className="w-5 h-5" />,
      href: '/about',
    },
    ...pages.map((p) => ({
      title: p.title,
      icon: <FileText className="w-5 h-5" />,
      href: `/p/${p.slug}`,
    })),
    {
      title: 'Terms & Conditions',
      icon: <FileText className="w-5 h-5" />,
      href: '/terms',
    },
    {
      title: 'Privacy Policy',
      icon: <Shield className="w-5 h-5" />,
      href: '/privacy',
    },
    isLoggedIn && {
      title: 'Log Out',
      icon: <LogOut className="w-5 h-5" />,
      href: '/logout',
    },
  ].filter(Boolean) as { title: string; icon: JSX.Element; href: string }[];

  return (
    <CustomerLayout cartCount={0}>
      <div className="p-4 space-y-2 max-w-md mx-auto">
        <h1 className="text-lg font-semibold mb-4">More</h1>
        {items.map((item, idx) => (
          <Link key={idx} href={item.href}>
            <div className="flex items-center justify-between p-4 bg-gray-100 rounded-md hover:bg-gray-200 transition">
              <div className="flex items-center gap-3 text-sm font-medium">
                {item.icon}
                {item.title}
              </div>
              <span className="text-gray-400 text-xs">›</span>
            </div>
          </Link>
        ))}
      </div>
    </CustomerLayout>
  );
}

export async function getStaticProps() {
  return {
    props: {
      customerMode: true,
      cartCount: 0,
    },
  };
}
