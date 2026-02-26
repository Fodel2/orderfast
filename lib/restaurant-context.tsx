import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';

type RestaurantCtx = { restaurantId: string | null; loading: boolean };
const Ctx = createContext<RestaurantCtx>({ restaurantId: null, loading: true });
export const useRestaurant = () => useContext(Ctx);

function pickQueryValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const booted = useRef(false);

  const qRestaurantId = pickQueryValue(router.query?.restaurant_id as string | string[] | undefined);
  const qRid = pickQueryValue(router.query?.rid as string | string[] | undefined);
  const qId = pickQueryValue(router.query?.id as string | string[] | undefined);
  const qR = pickQueryValue(router.query?.r as string | string[] | undefined);

  useEffect(() => {
    if (!router.isReady) return;

    const rid = qRestaurantId || qRid || qId || qR;
    const demo = process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID || null;

    if (!booted.current || rid || demo) {
      setRestaurantId(rid || demo || null);
    }

    booted.current = true;
    setLoading(false);
  }, [router.isReady, qRestaurantId, qRid, qId, qR]);

  const value = useMemo(() => ({ restaurantId, loading }), [restaurantId, loading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
