import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useCart } from '@/context/CartContext';
import { clearHomeSeen, hasSeenHome } from '@/utils/kiosk/session';

type KioskSessionContextValue = {
  sessionActive: boolean;
  setSessionActive: (active: boolean) => void;
  resetKioskToStart: () => void;
};

const KioskSessionContext = createContext<KioskSessionContextValue>({
  sessionActive: false,
  setSessionActive: () => undefined,
  resetKioskToStart: () => undefined,
});

export function KioskSessionProvider({
  restaurantId,
  children,
}: {
  restaurantId?: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const { clearCart } = useCart();
  const [sessionActive, setSessionActive] = useState<boolean>(() => Boolean(restaurantId && hasSeenHome(restaurantId)));

  useEffect(() => {
    setSessionActive(Boolean(restaurantId && hasSeenHome(restaurantId)));
  }, [restaurantId]);

  const basePath = useMemo(() => (restaurantId ? `/kiosk/${restaurantId}` : '/kiosk'), [restaurantId]);

  const resetKioskToStart = useCallback(() => {
    clearCart();
    if (restaurantId) {
      clearHomeSeen(restaurantId);
    }
    setSessionActive(false);
    router.push(basePath).catch(() => undefined);
  }, [basePath, clearCart, restaurantId, router]);

  const value = useMemo(
    () => ({
      sessionActive,
      setSessionActive,
      resetKioskToStart,
    }),
    [resetKioskToStart, sessionActive]
  );

  return <KioskSessionContext.Provider value={value}>{children}</KioskSessionContext.Provider>;
}

export function useKioskSession() {
  return useContext(KioskSessionContext);
}

export default KioskSessionContext;
