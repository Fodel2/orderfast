import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';

interface Restaurant {
  id: number;
  name: string;
  logo_url: string | null;
  website_description: string | null;
}

export default function RestaurantMenuPage() {
  const router = useRouter();
  const { restaurant_id } = router.query;
  const restaurantId = Array.isArray(restaurant_id) ? restaurant_id[0] : restaurant_id;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .maybeSingle();
      setRestaurant(data as Restaurant | null);
      setLoading(false);
    };

    load();
  }, [router.isReady, restaurantId]);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  if (!restaurant) {
    return (
      <div className="p-6 text-center text-red-500">No restaurant specified</div>
    );
  }

  return (
    <div className="p-6 text-center space-y-4">
      {restaurant.logo_url && (
        <img
          src={restaurant.logo_url}
          alt={`${restaurant.name} logo`}
          className="mx-auto h-24 object-contain"
        />
      )}
      <h1 className="text-3xl font-bold">{restaurant.name}</h1>
      {restaurant.website_description && (
        <p className="text-gray-600">{restaurant.website_description}</p>
      )}
    </div>
  );
}

