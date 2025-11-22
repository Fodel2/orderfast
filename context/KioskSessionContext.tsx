import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/router';
import { useCart } from '@/context/CartContext';
import { clearHomeSeen, hasSeenHome } from '@/utils/kiosk/session';

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

  const idleOverlayStyle = useMemo(
    () =>
      ({
        height: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        overflow: 'hidden',
      }) as CSSProperties,
    []
  );

  const idleCardStyle = useMemo(
    () => ({ maxHeight: 'calc(100dvh - 32px - env(safe-area-inset-bottom))' }) as CSSProperties,
    []
  );

  const handleIdleTimeout = useCallback(() => {
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
    router.push(basePath).catch(() => undefined);
  }, [basePath, clearCart, restaurantId, router, setSessionActive]);

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
    router.push(basePath).catch(() => undefined);
  }, [basePath, clearCart, restaurantId, router, setSessionActive]);

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
      {showIdleModal ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,23,42,0.65)] px-4 backdrop-blur-md"
          style={idleOverlayStyle}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.35)]"
            style={idleCardStyle}
          >
            <div className="modalContent flex-1 overflow-y-auto overscroll-contain px-7 py-9 sm:px-10 sm:py-11">
              <div className="flex h-full flex-col gap-8 text-center text-neutral-900">
                <div className="space-y-3">
                  <h3 className="text-3xl font-semibold sm:text-[34px]">Still there?</h3>
                  <p className="text-base leading-relaxed text-neutral-600 sm:text-lg">{idleMessage}</p>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <span
                    className={`text-[96px] font-black leading-none sm:text-[110px] ${
                      idleCountdown <= 3
                        ? 'text-rose-600'
                        : idleCountdown <= 6
                        ? 'text-amber-500'
                        : 'text-neutral-900'
                    } ${showIdleModal ? 'idle-count-bump' : ''}`}
                    key={idleCountdown}
                  >
                    {idleCountdown}
                  </span>
                  <p className="text-base font-medium text-neutral-500 sm:text-lg">Resetting in {idleCountdown} seconds…</p>
                </div>
                <div className="mt-auto flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleIdleStay}
                    className="inline-flex w-full items-center justify-center rounded-full border border-neutral-200 bg-white px-5 py-4 text-lg font-semibold text-neutral-900 shadow-[0_10px_35px_-20px_rgba(15,23,42,0.35)] transition hover:bg-neutral-50"
                  >
                    I’m still here
                  </button>
                  <button
                    type="button"
                    onClick={handleIdleTimeout}
                    className="inline-flex w-full items-center justify-center rounded-full bg-rose-600 px-5 py-4 text-lg font-semibold text-white shadow-[0_14px_40px_-18px_rgba(225,29,72,0.9)] transition hover:bg-rose-700 active:translate-y-[1px]"
                  >
                    Start over
                  </button>
                </div>
              </div>
            </div>
            <style jsx>{`
              .idle-count-bump {
                animation: idle-count-bump 140ms ease;
              }

              @keyframes idle-count-bump {
                0% {
                  transform: scale(1);
                }
                45% {
                  transform: scale(1.08);
                }
                100% {
                  transform: scale(1);
                }
              }
            `}</style>
          </div>
        </div>
      ) : null}
    </KioskSessionContext.Provider>
  );
}

export function useKioskSession() {
  return useContext(KioskSessionContext);
}

export default KioskSessionContext;
