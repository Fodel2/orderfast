import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import CustomerLayout from '@/components/CustomerLayout';
import { supabase } from '@/utils/supabaseClient';
import resolveRestaurantId from '@/lib/resolveRestaurantId';
import { BrandProvider } from '@/components/branding/BrandProvider';
import { useCart } from '@/context/CartContext';

export default function CustomPage() {
  const router = useRouter();
  const { cart } = useCart();
  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [page, setPage] = useState<any | null>(null);
  const rid = resolveRestaurantId(router, null, restaurant);
  const { slug } = router.query;

  useEffect(() => {
    if (!router.isReady || !rid || typeof slug !== 'string') return;
    supabase
      .from('restaurants')
      .select('*')
      .eq('id', rid)
      .maybeSingle()
      .then(({ data }) => setRestaurant(data));
    supabase
      .from('custom_pages')
      .select('*')
      .eq('restaurant_id', rid)
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => setPage(data));
  }, [router.isReady, rid, slug]);

  return (
    <BrandProvider restaurant={restaurant}>
      <CustomerLayout cartCount={cartCount}>
        <div className="container mx-auto max-w-5xl px-4 py-8">
          {page ? (
            <>
              <h1 className="text-3xl font-bold mb-4">{page.title}</h1>
              {page.content?.html ? (
                <div className="prose" dangerouslySetInnerHTML={{ __html: page.content.html }} />
              ) : (
                <pre className="text-sm">{JSON.stringify(page.content, null, 2)}</pre>
              )}
            </>
          ) : (
            <p>Loading...</p>
          )}
        </div>
      </CustomerLayout>
    </BrandProvider>
  );
}
