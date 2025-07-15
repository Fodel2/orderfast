import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';

interface Restaurant {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
  description: string | null;
}

interface Item {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
}

export default function RestaurantMenuPage() {
  const router = useRouter();
  const { subdomain, restaurant_id } = router.query;
  const sub = Array.isArray(subdomain) ? subdomain[0] : subdomain;
  const idParam = Array.isArray(restaurant_id) ? restaurant_id[0] : restaurant_id;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    if (!sub && !idParam) {
      setLoading(false);
      return;
    }

    const load = async () => {
      let restData: Restaurant | null = null;

      if (sub) {
        const { data } = await supabase
          .from('restaurants')
          .select('id,name')
          .eq('subdomain', sub)
          .maybeSingle();
        restData = data as Restaurant | null;
      } else if (idParam) {
        const rid = parseInt(idParam as string, 10);
        if (!isNaN(rid)) {
          const { data } = await supabase
            .from('restaurants')
            .select('id,name')
            .eq('id', rid)
            .maybeSingle();
          restData = data as Restaurant | null;
        }
      }

      if (!restData) {
        setLoading(false);
        return;
      }

      setRestaurant(restData);

      const { data: catData } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', restData.id)
        .order('sort_order', { ascending: true });

      const { data: itemData } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restData.id)
        .order('sort_order', { ascending: true });

      setCategories(catData || []);
      setItems(itemData || []);
      setLoading(false);
    };

    load();
  }, [router.isReady, subdomain, restaurant_id]);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  if (!sub && !idParam) {
    return (
      <div className="p-6 text-center text-red-500">No restaurant specified</div>
    );
  }

  if (!restaurant) {
    return (
      <div className="p-6 text-center text-red-500">Restaurant not found</div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-3xl font-bold text-center">{restaurant.name} Menu</h1>
      {categories.length === 0 ? (
        <p className="text-center text-gray-500">No menu items found.</p>
      ) : (
        categories.map((cat) => (
          <div key={cat.id} className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">{cat.name}</h2>
              {cat.description && (
                <p className="text-gray-600">{cat.description}</p>
              )}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items
                .filter((it) => it.category_id === cat.id)
                .map((it) => (
                  <div
                    key={it.id}
                    className="bg-white rounded-lg shadow p-4 flex flex-col"
                  >
                    {it.image_url && (
                      <img
                        src={it.image_url}
                        alt={it.name}
                        className="w-full h-40 object-cover rounded mb-2"
                      />
                    )}
                    <h3 className="text-lg font-semibold">{it.name}</h3>
                    {it.description && (
                      <p className="text-sm text-gray-600 mb-2 truncate">
                        {it.description}
                      </p>
                    )}
                    <span className="mt-auto font-semibold">
                      ${it.price.toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

