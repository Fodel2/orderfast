import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';

type RestaurantCtx = { restaurantId: string | null; loading: boolean };
const Ctx = createContext<RestaurantCtx>({ restaurantId: null, loading: true });
export const useRestaurant = () => useContext(Ctx);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const booted = useRef(false);

  useEffect(() => {
    if (!router.isReady) return;

    // Resolution order:
    // 1) query param ?restaurant_id=<uuid> (most reliable today)
    // 2) optional demo fallback env
    const q = router.query;
    const rid = (q?.restaurant_id as string) || (q?.rid as string) || null;
    const demo = process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID || null;

    // Avoid resetting after initial resolution to prevent flashes on navigation.
    if (!booted.current || rid || demo) {
      setRestaurantId(rid || demo || null);
    }

    booted.current = true;
    setLoading(false);
  }, [router.isReady, router.query]);

  const value = useMemo(() => ({ restaurantId, loading }), [restaurantId, loading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

