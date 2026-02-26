import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

type RestaurantCtx = { restaurantId: string | null; loading: boolean };
const Ctx = createContext<RestaurantCtx>({ restaurantId: null, loading: true });
export const useRestaurant = () => useContext(Ctx);

const LAST_RESTAURANT_ID_KEY = 'orderfast:lastRestaurantId';

function normalizeRestaurantId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
  return trimmed;
}

function resolveRestaurantIdFromSources({
  explicitId,
  query,
  storedId,
}: {
  explicitId?: string | null;
  query?: Record<string, unknown>;
  storedId?: string | null;
}): string | null {
  return (
    normalizeRestaurantId(explicitId) ||
    normalizeRestaurantId(query?.restaurant_id) ||
    normalizeRestaurantId(query?.rid) ||
    normalizeRestaurantId(query?.id) ||
    normalizeRestaurantId(query?.r) ||
    normalizeRestaurantId(storedId)
  );
}

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    const storedId = typeof window !== 'undefined' ? localStorage.getItem(LAST_RESTAURANT_ID_KEY) : null;
    const demo = process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID || null;
    const resolved = resolveRestaurantIdFromSources({
      query: router.query as Record<string, unknown>,
      storedId,
    });

    setRestaurantId(resolved || normalizeRestaurantId(demo));
    setLoading(false);
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (typeof window === 'undefined' || !restaurantId) return;
    localStorage.setItem(LAST_RESTAURANT_ID_KEY, restaurantId);
  }, [restaurantId]);

  const value = useMemo(() => ({ restaurantId, loading }), [restaurantId, loading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { normalizeRestaurantId, resolveRestaurantIdFromSources };
