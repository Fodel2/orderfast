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
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        overflow: 'hidden',
      }) as CSSProperties,
    []
  );

  const idleCardStyle = useMemo(
    () =>
      ({
        maxHeight: 'calc(100dvh - 64px - env(safe-area-inset-bottom))',
        overflowY: 'auto',
      }) as CSSProperties,
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
          className="idle-overlay fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(0,0,0,0.55)] px-4 backdrop-blur-[8px]"
          style={idleOverlayStyle}
        >
          <div
            className="idle-card relative w-[calc(100%-32px)] max-w-[480px] rounded-[36px] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.25)]"
            style={idleCardStyle}
          >
            <div className="modalContent flex flex-col items-stretch px-9 pb-10 pt-12 text-neutral-900 sm:px-10 sm:pb-12 sm:pt-[52px]">
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="space-y-2">
                  <h3 className="text-[32px] font-bold leading-tight sm:text-[36px]">Still there?</h3>
                  <p className="text-[16px] leading-relaxed text-neutral-600 sm:text-[18px]">{idleMessage}</p>
                </div>
                <div className="flex flex-col items-center">
                  <span
                    className={`idle-count-number text-[96px] font-black leading-none sm:text-[110px] ${
                      idleCountdown <= 3
                        ? 'text-[#E63946]'
                        : idleCountdown <= 6
                        ? 'text-[#F5A623]'
                        : 'text-[#111111]'
                    } ${showIdleModal ? 'idle-count-bump' : ''}`}
                    key={idleCountdown}
                  >
                    {idleCountdown}
                  </span>
                  <p className="mt-2 text-[15px] font-medium text-[#777777]">Resetting in {idleCountdown} seconds…</p>
                </div>
              </div>
              <div className="mt-10 flex w-full flex-col gap-4">
                <button
                  type="button"
                  onClick={handleIdleStay}
                  className="inline-flex h-[60px] w-full items-center justify-center rounded-full border-[2px] border-[rgba(0,0,0,0.06)] bg-white text-[18px] font-semibold text-[#111111] shadow-[0_10px_35px_-18px_rgba(0,0,0,0.35)] transition hover:bg-neutral-50"
                >
                  I’m still here
                </button>
                <button
                  type="button"
                  onClick={handleIdleTimeout}
                  className="inline-flex h-[68px] w-full items-center justify-center rounded-full bg-[#E63946] text-[19px] font-bold text-white shadow-[0_16px_30px_rgba(0,0,0,0.25)] transition hover:bg-[#d3323f] active:translate-y-[1px]"
                >
                  Start over
                </button>
              </div>
            </div>
            <style jsx>{`
              .idle-overlay {
                animation: idle-overlay-fade 180ms ease;
              }

              .idle-card {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                padding: 0;
                animation: idle-card-rise 200ms ease;
              }

              .idle-count-number {
                transition: color 160ms ease;
              }

              .idle-count-bump {
                animation: idle-count-bump 140ms ease;
              }

              @keyframes idle-overlay-fade {
                from {
                  opacity: 0;
                }
                to {
                  opacity: 1;
                }
              }

              @keyframes idle-card-rise {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
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
