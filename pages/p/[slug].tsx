import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import CustomerLayout from '@/components/CustomerLayout';
import { supabase } from '@/lib/supabaseClient';
import { BrandProvider } from '@/components/branding/BrandProvider';
import { useCart } from '@/context/CartContext';
import PageRenderer, { Block } from '@/components/PageRenderer';
import { useRestaurant } from '@/lib/restaurant-context';

export default function CustomPage() {
  const router = useRouter();
  const { cart } = useCart();
  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [page, setPage] = useState<any | null>(null);
  const { restaurantId, loading } = useRestaurant();
  const { slug } = router.query;

  useEffect(() => {
    if (!router.isReady || loading || !restaurantId || typeof slug !== 'string') return;
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .maybeSingle()
      .then(({ data }) => setRestaurant(data));
    supabase
      .from('custom_pages')
      .select('title, seo_title, seo_description, content, content_json')
      .eq('restaurant_id', restaurantId)
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => setPage(data));
  }, [router.isReady, loading, restaurantId, slug]);
  const blocks: Block[] = useMemo(() => {
    if (!page) return [];
    if (Array.isArray(page.content_json) && page.content_json.length) return page.content_json as any;
    return fallbackFromText(page.content);
  }, [page]);

  if (!loading && !restaurantId) {
    return (
      <CustomerLayout cartCount={cartCount}>
        <div className="p-4 text-center text-red-500">No restaurant specified</div>
      </CustomerLayout>
    );
  }

  return (
    <BrandProvider restaurant={restaurant}>
      <CustomerLayout cartCount={cartCount}>
        <Head>
          <title>{page?.seo_title || page?.title || 'Page'}</title>
          {page?.seo_description ? <meta name="description" content={page.seo_description} /> : null}
        </Head>
        <main className="mx-auto max-w-3xl p-4 md:p-8">
          <h1 className="sr-only">{page?.title}</h1>
          {page ? <PageRenderer blocks={blocks} /> : <p>Loading...</p>}
        </main>
      </CustomerLayout>
    </BrandProvider>
  );
}

function fallbackFromText(text?: string): Block[] {
  if (!text) return [];
  return text
    .split(/\n\n+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map((t, i) => ({ id: `p${i}`, type: 'text', text: t }));
}
