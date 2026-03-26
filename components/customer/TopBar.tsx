import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRestaurant } from '@/lib/restaurant-context';

export default function TopBar({ hidden }: { hidden?: boolean }) {
  const { restaurantId, loading } = useRestaurant();
  const [title, setTitle] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoShape, setLogoShape] = useState<'square' | 'round' | 'rectangular'>('round');
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
        .select('website_title, name, logo_url, logo_shape')
        .eq('id', restaurantId)
        .single();

      if (!mounted) return;
      if (!error && data) {
        setTitle(data.website_title ?? data.name ?? 'Restaurant');
        setLogoUrl(data.logo_url ?? null);
        setLogoShape((data.logo_shape as 'square' | 'round' | 'rectangular') || 'round');
      }
      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, [restaurantId, loading]);

  const style = {
    opacity: hidden ? 0 : 1,
    transition: 'opacity 0.6s',
    pointerEvents: hidden ? 'none' : 'auto',
  } as React.CSSProperties;
  const frameClass =
    logoShape === 'round' ? 'rounded-full' : logoShape === 'square' ? 'rounded-lg' : 'rounded-md';

  // skeleton while loading or unresolved title
  if (!ready || !title) {
    return (
      <header
        className="brand-glass fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40 gap-3"
        style={style}
      >
        <div className="h-8 w-8 rounded-full bg-neutral-200 animate-pulse" />
        <div className="h-4 w-28 rounded bg-neutral-200 animate-pulse" />
      </header>
    );
  }

  return (
    <header
      className="brand-glass fixed top-0 left-0 right-0 h-14 flex items-center px-4 z-40 gap-3"
      style={style}
    >
      {logoUrl ? (
        <div className={`h-8 w-8 overflow-hidden ${frameClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={title ?? 'Restaurant'}
            className={`h-full w-full ${logoShape === 'rectangular' ? 'object-contain' : 'object-cover'} ${frameClass}`}
          />
        </div>
      ) : null}
      <div className="font-semibold text-lg">{title}</div>
    </header>
  );
}
