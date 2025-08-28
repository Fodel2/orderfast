import { useEffect, useState } from 'react';
import { useRestaurant } from '@/lib/restaurant-context';
import { supabase } from '@/lib/supabaseClient';
import { getPublicUrl } from '@/lib/storage';

export default function TopBar({ hidden }: { hidden?: boolean }) {
  const { restaurantId, loading } = useRestaurant();
  const [name, setName] = useState<string>('Restaurant');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (loading) return;
    if (!restaurantId) { setReady(true); return; }

    (async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('name, logo, logo_path, cover, cover_path')
        .eq('id', restaurantId)
        .single();
      if (!mounted) return;
      if (!error && data) {
        setName(data.name || 'Restaurant');
        const logo = (data as any).logo_path || (data as any).logo;
        const url = (logo && !/^https?:\/\//.test(logo)) ? getPublicUrl('public', logo) : logo || null;
        setLogoUrl(url);
      }
      setReady(true);
    })();

    return () => { mounted = false; };
  }, [restaurantId, loading]);

  if (hidden) return null;
  return (
    <header className="brand-glass fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40">
      {!ready ? (
        <div className="animate-pulse h-8 w-8 rounded-full bg-neutral-200" />
      ) : logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className="h-8 w-8 rounded-full" />
      ) : null}
      <div className="ml-2 font-semibold truncate">{name}</div>
    </header>
  );
}
