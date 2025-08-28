import { useEffect, useState } from 'react';
import { useRestaurant } from '@/lib/restaurant-context';
import { supabase } from '@/lib/supabaseClient';
import { getPublicUrl } from '@/lib/storage';

export default function TopBar({ hidden }: { hidden?: boolean }) {
  const { restaurantId, loading } = useRestaurant();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (loading) return;
    if (!restaurantId) {
      setReady(true);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, logo, logo_path, cover, cover_path')
        .eq('id', restaurantId)
        .single();
      if (!mounted) return;
      if (!error && data) {
        setRestaurant(data);
      }
      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, [restaurantId, loading]);

  if (hidden) return null;

  if (!ready) {
    return (
      <header className="brand-glass fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40 gap-3">
        <div className="h-8 w-8 rounded-full bg-neutral-200 animate-pulse" />
        <div className="h-4 w-24 rounded bg-neutral-200 animate-pulse" />
      </header>
    );
  }

  if (!restaurant) {
    return (
      <header className="brand-glass fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40">
        <div className="font-semibold">No restaurant specified</div>
      </header>
    );
  }

  const logo = restaurant.logo_path || restaurant.logo;
  const logoUrl = logo && !/^https?:\/\//.test(logo) ? getPublicUrl('public', logo) : logo;

  return (
    <header className="brand-glass fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={restaurant.name}
          className="h-8 w-8 rounded-full object-cover"
        />
      )}
      <div className="ml-2 font-semibold truncate">{restaurant.name}</div>
    </header>
  );
}
