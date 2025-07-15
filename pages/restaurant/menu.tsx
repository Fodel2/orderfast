import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';

interface Restaurant {
  id: number;
  name: string;
  logo_url: string | null;
  website_description: string | null;
}

interface Category {
  id: number;
  name: string;
}

interface Item {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_vegetarian: boolean | null;
  is_18_plus: boolean | null;
  stock_status: 'in_stock' | 'scheduled' | 'out' | null;
  category_id: number;
}

export default function RestaurantMenuPage() {
  const router = useRouter();
  const { restaurant_id } = router.query;
  const restaurantId = Array.isArray(restaurant_id) ? restaurant_id[0] : restaurant_id;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const [{ data: rest }, { data: catData }, { data: itemData }] =
        await Promise.all([
          supabase
            .from('restaurants')
            .select('*')
            .eq('id', restaurantId)
            .maybeSingle(),
          supabase
            .from('menu_categories')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('sort_order', { ascending: true }),
        ]);
      setRestaurant(rest as Restaurant | null);
      setCategories(catData || []);
      setItems(itemData || []);
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
    <div className="p-4 space-y-8">
      <div className="text-center space-y-4">
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

      <div className="space-y-8">
        {categories.map((cat) => {
          const catItems = items.filter((it) => it.category_id === cat.id);
          if (catItems.length === 0) return null;
          return (
            <section key={cat.id} className="space-y-4">
              <h2 className="text-xl font-semibold text-left">{cat.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-4 border rounded-lg shadow-sm bg-white"
                  >
                    <img
                      src={item.image_url || 'https://via.placeholder.com/120'}
                      alt={item.name}
                      className="w-24 h-24 object-cover rounded"
                    />
                    <div className="flex-1 space-y-1 text-left">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold">{item.name}</h3>
                        <span className="font-semibold">$
                          {item.price.toFixed(2)}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-600">
                          {item.description}
                        </p>
                      )}
                      <div className="text-xs flex flex-wrap gap-2 mt-1">
                        {item.is_vegetarian && (
                          <span className="px-2 py-1 bg-green-100 rounded">
                            🌱 Vegetarian
                          </span>
                        )}
                        {item.is_18_plus && (
                          <span className="px-2 py-1 bg-red-100 rounded">🔥 18+</span>
                        )}
                        {item.stock_status === 'out' && (
                          <span className="px-2 py-1 bg-gray-200 rounded">
                            Out of stock
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

