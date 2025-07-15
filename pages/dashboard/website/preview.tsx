import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/DashboardLayout';
import { supabase } from '../../../utils/supabaseClient';

interface Restaurant {
  id: number;
  name: string;
  logo_url: string | null;
  website_description: string | null;
}

export default function WebsitePreview() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data: ru } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (ru) {
        const { data } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', ru.restaurant_id)
          .maybeSingle();
        setRestaurant(data);
      }
      setLoading(false);
    };
    load();
  }, [router]);

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;

  if (!restaurant) {
    return <DashboardLayout>No restaurant found</DashboardLayout>;
  }

  return (
    <DashboardLayout>
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
        <Link href="/menu" className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">
          View Menu
        </Link>
      </div>
    </DashboardLayout>
  );
}
