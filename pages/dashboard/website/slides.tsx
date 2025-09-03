import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/DashboardLayout';
import SlidesSection from '../../../components/SlidesSection';
import { supabase } from '../../../utils/supabaseClient';

export default function SlidesPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data: ru } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (ru?.restaurant_id) setRestaurantId(ru.restaurant_id);
    };
    load();
  }, [router]);

  return (
    <DashboardLayout>
      {!restaurantId ? (
        <div className="p-4 text-sm text-neutral-500">Loading…</div>
      ) : (
        <SlidesSection restaurantId={restaurantId} />
      )}
    </DashboardLayout>
  );
}
