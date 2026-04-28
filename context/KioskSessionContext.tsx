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
import { getExpressSession, patchExpressSession } from '@/utils/express/session';
import { patchKioskDebugState } from '@/utils/kiosk/debug';

type KioskSessionContextValue = {
  sessionActive: boolean;
  setSessionActive: (active: boolean) => void;
  registerActivity: () => void;
  resetIdleTimer: () => void;
  acquireIdleSuppression: (reason?: string) => () => void;
  resetKioskToStart: () => void;
  showIdleModal: boolean;
  idleCountdown: number;
  idleCountdownStarted: boolean;
  idleMessage: string;
  handleIdleStay: () => void;
  handleIdleTimeout: () => void;
};

const KioskSessionContext = createContext<KioskSessionContextValue>({
  sessionActive: false,
  setSessionActive: () => undefined,
  registerActivity: () => undefined,
  resetIdleTimer: () => undefined,
  acquireIdleSuppression: () => () => undefined,
  resetKioskToStart: () => undefined,
  showIdleModal: false,
  idleCountdown: 12,
  idleCountdownStarted: false,
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
  const [idleCountdown, setIdleCountdown] = useState(12);
  const [idleCountdownStarted, setIdleCountdownStarted] = useState(false);
  const [idleMessage, setIdleMessage] = useState('');
  const idleTimeoutRef = useRef<number | null>(null);
  const idleCountdownBufferTimeoutRef = useRef<number | null>(null);
  const idleCountdownIntervalRef = useRef<number | null>(null);
  const idleSuppressionTokenRef = useRef(0);
  const activeIdleSuppressionTokensRef = useRef<Set<number>>(new Set());
  const sessionActiveRef = useRef(sessionActiveState);
  const launcherEntryHandledRef = useRef(false);

  const isExpressActive = useCallback(() => {
    if (router.pathname.startsWith('/express') || router.asPath.startsWith('/express')) {
      return true;
    }
    const queryExpress = router.query.express;
    return queryExpress === '1' || (Array.isArray(queryExpress) && queryExpress.includes('1')) || router.asPath.includes('express=1');
  }, [router.asPath, router.pathname, router.query.express]);

  const basePath = useMemo(() => (restaurantId ? `/kiosk/${restaurantId}` : '/kiosk'), [restaurantId]);
  const hasLauncherEntryFlag = useMemo(() => {
    const entry = router.query.entry;
    return entry === 'launcher' || (Array.isArray(entry) && entry.includes('launcher'));
  }, [router.query.entry]);
  const sessionActive = sessionActiveState;

  const clearIdleState = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    if (idleCountdownIntervalRef.current) {
      clearInterval(idleCountdownIntervalRef.current);
      idleCountdownIntervalRef.current = null;
    }
    if (idleCountdownBufferTimeoutRef.current) {
      clearTimeout(idleCountdownBufferTimeoutRef.current);
      idleCountdownBufferTimeoutRef.current = null;
    }
    setShowIdleModal(false);
    setIdleCountdown(12);
    setIdleCountdownStarted(false);
    setIdleMessage('');
  }, []);

  useEffect(() => {
    sessionActiveRef.current = sessionActiveState;
  }, [sessionActiveState]);

  const setSessionActive = useCallback((active: boolean) => {
    sessionActiveRef.current = active;
    setSessionActiveState(active);
    patchKioskDebugState(
      {
        sessionActive: active,
      },
      'session-active-updated'
    );
    console.info('[kiosk-debug] session active updated', { active, restaurantId });
  }, [restaurantId]);

  useEffect(() => {
    setSessionActive(Boolean(restaurantId && hasSeenHome(restaurantId)));
  }, [restaurantId, setSessionActive]);

  useEffect(() => {
    const explicitExpress = isExpressActive();
    const isKioskRoute = router.pathname.startsWith('/kiosk') || router.asPath.startsWith('/kiosk');
    if (explicitExpress || !isKioskRoute) return;
    const session = getExpressSession();
    if (!session?.isExpress) return;
    patchExpressSession({ isExpress: false });
  }, [isExpressActive, router.asPath, router.pathname]);

  useEffect(() => {
    if (!hasLauncherEntryFlag) {
      launcherEntryHandledRef.current = false;
      return;
    }
    if (launcherEntryHandledRef.current) return;
    if (!router.isReady || !restaurantId || !hasLauncherEntryFlag) return;
    launcherEntryHandledRef.current = true;
    console.info('[kiosk-debug] launcher entry detected; resetting kiosk home/session', {
      restaurantId,
      asPath: router.asPath,
    });
    clearIdleState();
    clearCart();
    clearHomeSeen(restaurantId);
    setSessionActive(false);
    router.replace(basePath, undefined, { shallow: true }).catch(() => undefined);
  }, [basePath, clearCart, clearIdleState, hasLauncherEntryFlag, restaurantId, router, setSessionActive]);

  useEffect(() => {
    if (!restaurantId) return;
    if (isExpressActive()) return;

    router.beforePopState(({ as }) => {
      if (as.startsWith('/kiosk/')) {
        return true;
      }

      clearIdleState();
      setSessionActive(false);
      clearCart();
      clearHomeSeen(restaurantId);
      router.replace(basePath).catch(() => undefined);
      return false;
    });

    return () => {
      router.beforePopState(() => true);
    };
  }, [basePath, clearCart, clearIdleState, isExpressActive, restaurantId, router, setSessionActive]);

  const hasIdleSuppression = useCallback(() => activeIdleSuppressionTokensRef.current.size > 0, []);

  const handleIdleTimeout = useCallback(() => {
    const expressFlow = isExpressActive();
    clearIdleState();
    if (expressFlow) {
      return;
    }
    clearCart();
    if (restaurantId) {
      clearHomeSeen(restaurantId);
    }
    setSessionActive(false);
    const targetPath = expressFlow && restaurantId ? `/express?restaurant_id=${restaurantId}` : basePath;
    router.push(targetPath).catch(() => undefined);
  }, [basePath, clearCart, clearIdleState, isExpressActive, restaurantId, router, setSessionActive]);

  const startIdleCountdown = useCallback(() => {
    if (idleCountdownIntervalRef.current) {
      clearInterval(idleCountdownIntervalRef.current);
    }
    if (idleCountdownBufferTimeoutRef.current) {
      clearTimeout(idleCountdownBufferTimeoutRef.current);
      idleCountdownBufferTimeoutRef.current = null;
    }
    setIdleCountdown(12);
    setIdleCountdownStarted(false);
    idleCountdownBufferTimeoutRef.current = window.setTimeout(() => {
      idleCountdownBufferTimeoutRef.current = null;
      setIdleCountdownStarted(true);
      setIdleCountdown(12);
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
    }, 3000);
  }, [handleIdleTimeout]);

  const resetIdleTimer = useCallback(() => {
    if (!sessionActiveRef.current) return;
    if (isExpressActive()) {
      clearIdleState();
      return;
    }
    if (hasIdleSuppression()) {
      clearIdleState();
      return;
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    idleTimeoutRef.current = window.setTimeout(() => {
      idleTimeoutRef.current = null;
      if (hasIdleSuppression()) {
        return;
      }
      setIdleMessage('For your privacy, this session will reset soon unless you tap below.');
      setShowIdleModal(true);
      startIdleCountdown();
    }, 30000);
  }, [clearIdleState, hasIdleSuppression, isExpressActive, startIdleCountdown]);

  const acquireIdleSuppression = useCallback(
    (_reason?: string) => {
      const token = ++idleSuppressionTokenRef.current;
      activeIdleSuppressionTokensRef.current.add(token);
      clearIdleState();

      let released = false;
      return () => {
        if (released) return;
        released = true;
        activeIdleSuppressionTokensRef.current.delete(token);
        if (!sessionActiveRef.current || isExpressActive()) return;
        if (activeIdleSuppressionTokensRef.current.size > 0) return;
        resetIdleTimer();
      };
    },
    [clearIdleState, isExpressActive, resetIdleTimer]
  );

  const registerActivity = useCallback(() => {
    if (!sessionActiveRef.current) return;
    resetIdleTimer();
  }, [resetIdleTimer]);

  const handleIdleStay = useCallback(() => {
    clearIdleState();
    if (isExpressActive()) {
      return;
    }
    resetIdleTimer();
  }, [clearIdleState, isExpressActive, resetIdleTimer]);

  const resetKioskToStart = useCallback(() => {
    const expressFlow = isExpressActive();
    clearIdleState();
    clearCart();
    if (restaurantId) {
      clearHomeSeen(restaurantId);
    }
    setSessionActive(false);
    const targetPath = expressFlow && restaurantId ? `/express?restaurant_id=${restaurantId}` : basePath;
    router.push(targetPath).catch(() => undefined);
  }, [basePath, clearCart, clearIdleState, isExpressActive, restaurantId, router, setSessionActive]);

  useEffect(() => {
    const expressFlow = isExpressActive();
    if (sessionActive && !expressFlow) {
      resetIdleTimer();
      return () => {
        clearIdleState();
      };
    }
    clearIdleState();
    return undefined;
  }, [clearIdleState, isExpressActive, resetIdleTimer, sessionActive]);

  const value = useMemo(
    () => ({
      sessionActive,
      setSessionActive,
      registerActivity,
      resetIdleTimer,
      acquireIdleSuppression,
      resetKioskToStart,
      showIdleModal,
      idleCountdown,
      idleCountdownStarted,
      idleMessage,
      handleIdleStay,
      handleIdleTimeout,
    }),
    [
      acquireIdleSuppression,
      handleIdleStay,
      handleIdleTimeout,
      idleCountdown,
      idleCountdownStarted,
      idleMessage,
      registerActivity,
      resetIdleTimer,
      resetKioskToStart,
      sessionActive,
      showIdleModal,
    ]
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
