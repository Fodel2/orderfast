import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';

interface Restaurant {
  id: number;
  name: string;
  logo_url: string | null;
  website_description: string | null;
}

export default function RestaurantPage() {
  const router = useRouter();
  const { subdomain } = router.query;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    if (!subdomain) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('subdomain', subdomain)
        .maybeSingle();
      if (error) console.error('Failed to fetch restaurant', error);
      setRestaurant(data);
      setLoading(false);
    };
    load();
  }, [router.isReady, subdomain]);

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  if (!subdomain) {
    return <div className="p-6 text-center">No restaurant specified</div>;
  }

  if (!restaurant) {
    return <div className="p-6 text-center">Restaurant not found</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      {restaurant.logo_url && (
        <img
          src={restaurant.logo_url}
          alt={`${restaurant.name} logo`}
          className="h-24 mb-4 object-contain"
        />
      )}
      <h1 className="text-3xl font-bold mb-2 text-center">{restaurant.name}</h1>
      {restaurant.website_description && (
        <p className="text-gray-600 text-center mb-6 max-w-xl">
          {restaurant.website_description}
        </p>
      )}
      <Link
        href="/menu"
        className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
      >
        View Menu
      </Link>
    </div>
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
