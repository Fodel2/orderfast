import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/router';
import { useCart } from '@/context/CartContext';
import { clearHomeSeen, hasSeenHome } from '@/utils/kiosk/session';
import { getExpressSession } from '@/utils/express/session';

type KioskSessionContextValue = {
  sessionActive: boolean;
  setSessionActive: (active: boolean) => void;
  registerActivity: () => void;
  resetIdleTimer: () => void;
  resetKioskToStart: () => void;
  showIdleModal: boolean;
  idleCountdown: number;
  idleMessage: string;
  handleIdleStay: () => void;
  handleIdleTimeout: () => void;
};

const KioskSessionContext = createContext<KioskSessionContextValue>({
  sessionActive: false,
  setSessionActive: () => undefined,
  registerActivity: () => undefined,
  resetIdleTimer: () => undefined,
  resetKioskToStart: () => undefined,
  showIdleModal: false,
  idleCountdown: 10,
  idleMessage: '',
  handleIdleStay: () => undefined,
  handleIdleTimeout: () => undefined,
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
  const [sessionActiveState, setSessionActiveState] = useState<boolean>(() => Boolean(restaurantId && hasSeenHome(restaurantId)));
  const [showIdleModal, setShowIdleModal] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(10);
  const [idleMessage, setIdleMessage] = useState('');
  const idleTimeoutRef = useRef<number | null>(null);
  const idleCountdownIntervalRef = useRef<number | null>(null);
  const sessionActiveRef = useRef(sessionActiveState);

  const isExpressActive = useCallback(() => {
    if (router.pathname.startsWith('/express') || router.asPath.startsWith('/express')) {
      return true;
    }
    const queryExpress = router.query.express;
    if (queryExpress === '1' || (Array.isArray(queryExpress) && queryExpress.includes('1')) || router.asPath.includes('express=1')) {
      return true;
    }
    const session = getExpressSession();
    const matchesRestaurant = !restaurantId || !session?.restaurantId || session.restaurantId === restaurantId;
    return Boolean(session?.isExpress && matchesRestaurant);
  }, [restaurantId, router.asPath, router.pathname, router.query.express]);

  const basePath = useMemo(() => (restaurantId ? `/kiosk/${restaurantId}` : '/kiosk'), [restaurantId]);
  const sessionActive = sessionActiveState;

  useEffect(() => {
    sessionActiveRef.current = sessionActiveState;
  }, [sessionActiveState]);

  const setSessionActive = useCallback((active: boolean) => {
    sessionActiveRef.current = active;
    setSessionActiveState(active);
  }, []);

  useEffect(() => {
    setSessionActive(Boolean(restaurantId && hasSeenHome(restaurantId)));
  }, [restaurantId, setSessionActive]);

  const idleMessages = useMemo(
    () => [
      'Just checking… did you wander off?',
      'You still there? Or did a pigeon steal your attention?',
      'We haven’t heard from you. Should we alert the missing-persons unit?',
      'Do you require adult supervision?',
      'If you don’t press something, the kiosk WILL win.',
      'Move your finger if you can hear us.',
      'This screen will self-destruct in 10 seconds. Kidding. Mostly.',
      'We’re not clingy. We just need a tiny tap to know you’re alive.',
      'If you’re thinking, take your time. If you’re napping, we’re impressed.',
    ],
    []
  );

  const getRandomMessage = useCallback((list: string[]) => list[Math.floor(Math.random() * list.length)], []);

  const handleIdleTimeout = useCallback(() => {
    const expressFlow = isExpressActive();
    setShowIdleModal(false);
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    if (idleCountdownIntervalRef.current) {
      clearInterval(idleCountdownIntervalRef.current);
      idleCountdownIntervalRef.current = null;
    }
    setIdleCountdown(10);
    clearCart();
    if (restaurantId) {
      clearHomeSeen(restaurantId);
    }
    setSessionActive(false);
    const targetPath = expressFlow && restaurantId ? `/express?restaurant_id=${restaurantId}` : basePath;
    router.push(targetPath).catch(() => undefined);
  }, [basePath, clearCart, isExpressActive, restaurantId, router, setSessionActive]);

  const startIdleCountdown = useCallback(() => {
    if (idleCountdownIntervalRef.current) {
      clearInterval(idleCountdownIntervalRef.current);
    }
    setIdleCountdown(10);
    idleCountdownIntervalRef.current = window.setInterval(() => {
      setIdleCountdown((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          if (idleCountdownIntervalRef.current) {
            clearInterval(idleCountdownIntervalRef.current);
            idleCountdownIntervalRef.current = null;
          }
          handleIdleTimeout();
          return 0;
        }
        return next;
      });
    }, 1000);
  }, [handleIdleTimeout]);

  const resetIdleTimer = useCallback(() => {
    if (!sessionActiveRef.current) return;
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    idleTimeoutRef.current = window.setTimeout(() => {
      idleTimeoutRef.current = null;
      setIdleMessage(getRandomMessage(idleMessages));
      setShowIdleModal(true);
      startIdleCountdown();
    }, 30000);
  }, [getRandomMessage, idleMessages, startIdleCountdown]);

  const registerActivity = useCallback(() => {
    if (!sessionActiveRef.current) return;
    resetIdleTimer();
  }, [resetIdleTimer]);

  const handleIdleStay = useCallback(() => {
    if (idleCountdownIntervalRef.current) {
      clearInterval(idleCountdownIntervalRef.current);
      idleCountdownIntervalRef.current = null;
    }
    setShowIdleModal(false);
    setIdleCountdown(10);
    resetIdleTimer();
  }, [resetIdleTimer]);

  const resetKioskToStart = useCallback(() => {
    const expressFlow = isExpressActive();
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    if (idleCountdownIntervalRef.current) {
      clearInterval(idleCountdownIntervalRef.current);
      idleCountdownIntervalRef.current = null;
    }
    setShowIdleModal(false);
    setIdleCountdown(10);
    setIdleMessage('');
    clearCart();
    if (restaurantId) {
      clearHomeSeen(restaurantId);
    }
    setSessionActive(false);
    const targetPath = expressFlow && restaurantId ? `/express?restaurant_id=${restaurantId}` : basePath;
    router.push(targetPath).catch(() => undefined);
  }, [basePath, clearCart, isExpressActive, restaurantId, router, setSessionActive]);

  useEffect(() => {
    if (sessionActive) {
      resetIdleTimer();
      return () => {
        if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
        if (idleCountdownIntervalRef.current) clearInterval(idleCountdownIntervalRef.current);
      };
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    if (idleCountdownIntervalRef.current) {
      clearInterval(idleCountdownIntervalRef.current);
      idleCountdownIntervalRef.current = null;
    }
    setShowIdleModal(false);
    setIdleCountdown(10);
    setIdleMessage('');
    return undefined;
  }, [resetIdleTimer, sessionActive]);

  const value = useMemo(
    () => ({
      sessionActive,
      setSessionActive,
      registerActivity,
      resetIdleTimer,
      resetKioskToStart,
      showIdleModal,
      idleCountdown,
      idleMessage,
      handleIdleStay,
      handleIdleTimeout,
    }),
    [handleIdleStay, handleIdleTimeout, idleCountdown, idleMessage, registerActivity, resetIdleTimer, resetKioskToStart, sessionActive, showIdleModal]
  );

  return (
    <KioskSessionContext.Provider value={value}>
      {children}
    </KioskSessionContext.Provider>
  );
}

export function useKioskSession() {
  return useContext(KioskSessionContext);
}

export default KioskSessionContext;
