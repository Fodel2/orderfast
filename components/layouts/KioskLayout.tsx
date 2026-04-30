import { ShoppingCartIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useRouter } from 'next/router';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import HomeScreen, { type KioskRestaurant } from '@/components/kiosk/HomeScreen';
import KioskActionButton from '@/components/kiosk/KioskActionButton';
import { useKioskSession } from '@/context/KioskSessionContext';
import { hasSeenHome, markHomeSeen } from '@/utils/kiosk/session';
import {
  getKioskDebugState,
  patchKioskDebugState,
  subscribeKioskDebugState,
  type KioskDebugState,
} from '@/utils/kiosk/debug';
import { getExpressSession } from '@/utils/express/session';
import { useCustomerAvailability } from '@/hooks/useCustomerAvailability';
import { exitDocumentFullscreen, isDocumentFullscreenActive, requestDocumentFullscreen } from '@/lib/fullscreen';
import { supabase } from '@/lib/supabaseClient';

export const FULL_HEADER_HEIGHT = 136;
export const COLLAPSED_HEADER_HEIGHT = 88;
export const FULL_CAT_HEIGHT = 64;
export const COLLAPSED_CAT_HEIGHT = 50;
export const CATEGORY_FADE_HEIGHT = 24;
const OPERATOR_EXIT_TAP_THRESHOLD = 5;
const OPERATOR_EXIT_TAP_WINDOW_MS = 4000;
const TEMP_OPERATOR_EXIT_PIN = '2580';
const DEBUG_COLLAPSED_SIZE = 56;
const DEBUG_PANEL_WIDTH = 320;
const DEBUG_PANEL_HEIGHT = 280;
const CLOSED_OVERLAY_DELAY_MS = 5 * 60 * 1000;
const CLOSED_OVERLAY_WAKE_TAP_WINDOW_MS = 3000;
const CLOSED_OVERLAY_WAKE_TAP_TARGET = 3;

interface WakeLockSentinel {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
  removeEventListener?: (type: 'release', listener: () => void) => void;
}

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request?: (type: 'screen') => Promise<WakeLockSentinel>;
  };
};

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
  };
};

type BeforeInstallPromptEvent = Event & {
  prompt?: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type KioskLayoutProps = {
  restaurantId?: string | null;
  restaurant?: KioskRestaurant | null;
  restaurantLoading?: boolean;
  cartCount?: number;
  children: ReactNode;
  forceHome?: boolean;
  categoryBar?: ReactNode;
  customHeaderContent?: ReactNode;
  hideHeader?: boolean;
  hideCartButton?: boolean;
};

type FullscreenViewport = 'phone' | 'tablet' | 'desktop';

const PHONE_MAX_WIDTH = 639;
const TABLET_MAX_WIDTH = 1024;

function resolveFullscreenViewport(width: number): FullscreenViewport {
  if (width <= PHONE_MAX_WIDTH) return 'phone';
  if (width <= TABLET_MAX_WIDTH) return 'tablet';
  return 'desktop';
}

export default function KioskLayout({
  restaurantId,
  restaurant,
  restaurantLoading = false,
  cartCount = 0,
  children,
  forceHome = false,
  categoryBar,
  customHeaderContent,
  hideHeader = false,
  hideCartButton = false,
}: KioskLayoutProps) {
  const router = useRouter();
  const resolveExpressSessionState = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const session = getExpressSession();
    const matchesRestaurant = !restaurantId || !session?.restaurantId || session.restaurantId === restaurantId;
    return Boolean(session?.isExpress && matchesRestaurant);
  }, [restaurantId]);
  const isExpressRoute = useMemo(
    () => router.pathname.startsWith('/express') || router.asPath.startsWith('/express'),
    [router.asPath, router.pathname]
  );
  const hasExpressQueryFlag = useMemo(() => {
    const queryExpress = router.query.express;
    const queryFlag =
      queryExpress === '1' || (Array.isArray(queryExpress) && queryExpress.includes('1'));
    const asPathFlag = router.asPath.includes('express=1');
    return queryFlag || asPathFlag;
  }, [router.asPath, router.query.express]);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [homeVisible, setHomeVisible] = useState<boolean>(() =>
    forceHome ? true : restaurantId ? !hasSeenHome(restaurantId) : false
  );
  const [homeFading, setHomeFading] = useState(false);
  const [contentVisible, setContentVisible] = useState<boolean>(() =>
    forceHome ? false : restaurantId ? hasSeenHome(restaurantId) : true
  );
  const [fullscreenViewport, setFullscreenViewport] = useState<FullscreenViewport>('desktop');
  const [isExpressSession, setIsExpressSession] = useState<boolean>(resolveExpressSessionState);
  const [isNativeShell, setIsNativeShell] = useState(false);
  const [shrinkProgress, setShrinkProgress] = useState(0);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [showOperatorUnlock, setShowOperatorUnlock] = useState(false);
  const [showClosedDimOverlay, setShowClosedDimOverlay] = useState(false);
  const [closedOverlayWakeHint, setClosedOverlayWakeHint] = useState<string | null>(null);
  const [operatorPinInput, setOperatorPinInput] = useState('');
  const [operatorPinError, setOperatorPinError] = useState<string | null>(null);
  const [showLockedNavigationNotice, setShowLockedNavigationNotice] = useState(false);
  const [debugPanelExpanded, setDebugPanelExpanded] = useState(false);
  const [debugPanelPosition, setDebugPanelPosition] = useState({ x: 16, y: 16 });
  const [debugState, setDebugState] = useState<KioskDebugState>({});
  const autoPromptedRef = useRef(false);
  const fullscreenRequestInFlight = useRef(false);
  const operatorNoticeTimerRef = useRef<number | null>(null);
  const operatorTapHistoryRef = useRef<number[]>([]);
  const operatorPinInputRef = useRef<HTMLInputElement | null>(null);
  const closedOverlayTimerRef = useRef<number | null>(null);
  const closedOverlayWakeTapHistoryRef = useRef<number[]>([]);
  const closedOverlayWakeHintTimerRef = useRef<number | null>(null);
  const debugDragRef = useRef({
    active: false,
    pointerId: -1,
    offsetX: 0,
    offsetY: 0,
    moved: false,
  });
  const accentColor = useMemo(
    () => restaurant?.brand_primary_color || restaurant?.brand_secondary_color || '#111827',
    [restaurant?.brand_primary_color, restaurant?.brand_secondary_color]
  );
  const {
    sessionActive,
    setSessionActive,
    registerActivity,
    resetIdleTimer,
    showIdleModal,
    idleCountdown,
    idleCountdownStarted,
    idleMessage,
    handleIdleStay,
    handleIdleTimeout,
  } = useKioskSession();
  const layoutStyle = useMemo(
    () => ({
      '--kiosk-accent': accentColor,
    }) as CSSProperties,
    [accentColor]
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const startX = Math.max(12, window.innerWidth - DEBUG_COLLAPSED_SIZE - 20);
    const startY = Math.max(12, window.innerHeight - DEBUG_COLLAPSED_SIZE - 20);
    setDebugPanelPosition({ x: startX, y: startY });
  }, []);

  useEffect(() => {
    if (!showOperatorUnlock) return;
    const timer = window.setTimeout(() => {
      operatorPinInputRef.current?.focus();
    }, 50);
    return () => {
      window.clearTimeout(timer);
    };
  }, [showOperatorUnlock]);

  const [isKioskFullscreenActive, setIsKioskFullscreenActive] = useState(false);

  const isFullscreenActive = useCallback(() => isDocumentFullscreenActive(), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setFullscreenViewport(resolveFullscreenViewport(window.innerWidth));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nativeShell = Boolean((window as CapacitorWindow).Capacitor?.isNativePlatform?.());
    setIsNativeShell(nativeShell);
  }, []);

  const isExpressActive = isExpressRoute || hasExpressQueryFlag || isExpressSession;


  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncExpressSession = () => {
      setIsExpressSession(resolveExpressSessionState());
    };

    syncExpressSession();
    window.addEventListener('storage', syncExpressSession);
    window.addEventListener('focus', syncExpressSession);

    return () => {
      window.removeEventListener('storage', syncExpressSession);
      window.removeEventListener('focus', syncExpressSession);
    };
  }, [resolveExpressSessionState, router.asPath]);

  useEffect(() => {
    if (typeof window === 'undefined' || isExpressActive) return;

    const handleBackBlocked = () => {
      setShowLockedNavigationNotice(true);
      if (operatorNoticeTimerRef.current) {
        window.clearTimeout(operatorNoticeTimerRef.current);
      }
      operatorNoticeTimerRef.current = window.setTimeout(() => {
        setShowLockedNavigationNotice(false);
      }, 2600);
    };

    window.addEventListener('orderfast:kiosk-back-blocked', handleBackBlocked);

    return () => {
      window.removeEventListener('orderfast:kiosk-back-blocked', handleBackBlocked);
      if (operatorNoticeTimerRef.current) {
        window.clearTimeout(operatorNoticeTimerRef.current);
        operatorNoticeTimerRef.current = null;
      }
    };
  }, [isExpressActive]);

  const channel = isExpressActive ? 'express' : 'kiosk';
  const availability = useCustomerAvailability({
    restaurantId,
    channel,
    sessionActive,
    graceMinutes: 10,
  });
  const isClosedOnHomeScreen = homeVisible && !availability.loading && !availability.canStartNewSession;
  const shouldSuppressFullscreen = isExpressActive || isNativeShell;

  const shouldAutoFullscreen = fullscreenViewport !== 'phone' && !shouldSuppressFullscreen;

  const attemptFullscreen = useCallback(
    async (options: { allowModal?: boolean } = {}) => {
      if (typeof document === 'undefined') return false;
      if (shouldSuppressFullscreen || !shouldAutoFullscreen) {
        setShowFullscreenPrompt(false);
        return false;
      }
      if (fullscreenRequestInFlight.current) {
        return isFullscreenActive();
      }
      fullscreenRequestInFlight.current = true;
      let success = false;
      try {
        if (isFullscreenActive()) {
          setShowFullscreenPrompt(false);
          success = true;
        } else {
          const requested = await requestDocumentFullscreen();
          if (!requested) {
            if (options.allowModal) {
              setShowFullscreenPrompt(true);
            }
          } else {
            setShowFullscreenPrompt(false);
            success = true;
          }
        }
      } catch (err) {
        console.debug('[kiosk] fullscreen request failed', err);
        if (options.allowModal) {
          setShowFullscreenPrompt(true);
        }
      } finally {
        fullscreenRequestInFlight.current = false;
      }
      return success;
    },
    [isFullscreenActive, shouldAutoFullscreen, shouldSuppressFullscreen]
  );

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as WakeLockNavigator;
      if (!nav.wakeLock?.request) return null;
      const sentinel: WakeLockSentinel | null = await nav.wakeLock.request('screen');
      if (sentinel) {
        setWakeLock(sentinel);
      }
      return sentinel;
    } catch (err) {
      console.debug('[kiosk] wake lock unavailable', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    const previousColorScheme = html.style.colorScheme;

    html.style.colorScheme = 'light';
    html.classList.add('kiosk-mode');

    return () => {
      html.style.colorScheme = previousColorScheme;
      html.classList.remove('kiosk-mode');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const updateInstalledState = (installed: boolean) => {
      setIsInstalled(installed);
      if (installed) {
        setDeferredPrompt(null);
        setInstallDismissed(true);
      }
    };

    const evaluateDisplayMode = () => {
      const media = window.matchMedia?.('(display-mode: standalone)');
      const nav = window.navigator as Navigator & { standalone?: boolean };
      const installed = Boolean(media?.matches) || nav?.standalone === true;
      updateInstalledState(installed);
    };

    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      updateInstalledState(event.matches);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isInstalled) return;
      const promptEvent = event as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setInstallDismissed(false);
      autoPromptedRef.current = false;
    };

    const handleAppInstalled = () => {
      updateInstalledState(true);
    };

    const handleFullscreenChange = () => {
      const active = isFullscreenActive();
      setIsKioskFullscreenActive(active);
      if (active || shouldSuppressFullscreen || !shouldAutoFullscreen) {
        setShowFullscreenPrompt(false);
        return;
      }
      setShowFullscreenPrompt(true);
    };

    const media = window.matchMedia?.('(display-mode: standalone)');

    evaluateDisplayMode();
    setIsKioskFullscreenActive(isFullscreenActive());
    if (!shouldSuppressFullscreen) {
      attemptFullscreen({ allowModal: true });
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('webkitfullscreenchange', handleFullscreenChange as any);
    media?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('webkitfullscreenchange', handleFullscreenChange as any);
      media?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, [attemptFullscreen, isInstalled, isFullscreenActive, shouldAutoFullscreen, shouldSuppressFullscreen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isClosedOnHomeScreen) {
      if (closedOverlayTimerRef.current) {
        window.clearTimeout(closedOverlayTimerRef.current);
        closedOverlayTimerRef.current = null;
      }
      setShowClosedDimOverlay(false);
      setClosedOverlayWakeHint(null);
      closedOverlayWakeTapHistoryRef.current = [];
      if (closedOverlayWakeHintTimerRef.current) {
        window.clearTimeout(closedOverlayWakeHintTimerRef.current);
        closedOverlayWakeHintTimerRef.current = null;
      }
      return;
    }
    if (showClosedDimOverlay || closedOverlayTimerRef.current) return;
    closedOverlayTimerRef.current = window.setTimeout(() => {
      setShowClosedDimOverlay(true);
      closedOverlayTimerRef.current = null;
    }, CLOSED_OVERLAY_DELAY_MS);

    return () => {
      if (closedOverlayTimerRef.current) {
        window.clearTimeout(closedOverlayTimerRef.current);
        closedOverlayTimerRef.current = null;
      }
    };
  }, [isClosedOnHomeScreen, showClosedDimOverlay]);

  const handleClosedOverlayWakeTap = useCallback(() => {
    if (!showClosedDimOverlay || typeof window === 'undefined') return;
    const now = Date.now();
    const recentTaps = closedOverlayWakeTapHistoryRef.current.filter(
      (timestamp) => now - timestamp <= CLOSED_OVERLAY_WAKE_TAP_WINDOW_MS
    );
    recentTaps.push(now);
    closedOverlayWakeTapHistoryRef.current = recentTaps;
    if (recentTaps.length >= CLOSED_OVERLAY_WAKE_TAP_TARGET) {
      setShowClosedDimOverlay(false);
      setClosedOverlayWakeHint(null);
      closedOverlayWakeTapHistoryRef.current = [];
      if (closedOverlayWakeHintTimerRef.current) {
        window.clearTimeout(closedOverlayWakeHintTimerRef.current);
        closedOverlayWakeHintTimerRef.current = null;
      }
      return;
    }
    const tapsRemaining = CLOSED_OVERLAY_WAKE_TAP_TARGET - recentTaps.length;
    setClosedOverlayWakeHint(`Tap ${tapsRemaining} more ${tapsRemaining === 1 ? 'time' : 'times'} to wake`);
    if (closedOverlayWakeHintTimerRef.current) {
      window.clearTimeout(closedOverlayWakeHintTimerRef.current);
    }
    closedOverlayWakeHintTimerRef.current = window.setTimeout(() => {
      setClosedOverlayWakeHint(null);
      closedOverlayWakeHintTimerRef.current = null;
    }, 1300);
  }, [showClosedDimOverlay]);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      if (closedOverlayTimerRef.current) {
        window.clearTimeout(closedOverlayTimerRef.current);
      }
      if (closedOverlayWakeHintTimerRef.current) {
        window.clearTimeout(closedOverlayWakeHintTimerRef.current);
      }
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      if (typeof deferredPrompt.prompt === 'function') {
        await deferredPrompt.prompt();
      }
      const choice = deferredPrompt.userChoice ? await deferredPrompt.userChoice.catch(() => null) : null;
      if (choice && choice.outcome === 'accepted') {
        setIsInstalled(true);
        await attemptFullscreen({ allowModal: true });
      } else {
        setInstallDismissed(true);
      }
    } catch (err) {
      console.debug('[kiosk] install prompt failed', err);
      setInstallDismissed(true);
    } finally {
      setDeferredPrompt(null);
    }
  }, [attemptFullscreen, deferredPrompt]);

  useEffect(() => {
    if (!deferredPrompt || isInstalled || installDismissed || autoPromptedRef.current) return;

    autoPromptedRef.current = true;

    const attemptAutoPrompt = async () => {
      try {
        if (typeof deferredPrompt.prompt === 'function') {
          await deferredPrompt.prompt();
        }
        const choice = deferredPrompt.userChoice ? await deferredPrompt.userChoice.catch(() => null) : null;
        if (choice && choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          await attemptFullscreen({ allowModal: true });
        }
      } catch (err) {
        console.debug('[kiosk] auto install prompt blocked', err);
      }
    };

    attemptAutoPrompt();
  }, [attemptFullscreen, deferredPrompt, installDismissed, isInstalled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (shouldSuppressFullscreen || !shouldAutoFullscreen) {
      setShowFullscreenPrompt(false);
      requestWakeLock();
      return;
    }

    const handleInteraction = async () => {
      if (shouldSuppressFullscreen) {
        await requestWakeLock();
      } else {
        await Promise.allSettled([attemptFullscreen({ allowModal: true }), requestWakeLock()]);
      }
    };

    attemptFullscreen({ allowModal: true });
    requestWakeLock();

    window.addEventListener('pointerdown', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [attemptFullscreen, requestWakeLock, shouldAutoFullscreen, shouldSuppressFullscreen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!wakeLock) return;

    const handleVisibility = async () => {
      try {
        if (document.visibilityState === 'visible') {
          await requestWakeLock();
        }
      } catch (err) {
        console.debug('[kiosk] wake lock renewal failed', err);
      }
    };

    const handleRelease = async () => {
      await requestWakeLock();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    wakeLock.addEventListener?.('release', handleRelease);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLock.removeEventListener?.('release', handleRelease);
      try {
        if (!wakeLock.released) {
          wakeLock.release().catch(() => undefined);
        }
      } catch {
        // ignore
      }
    };
  }, [requestWakeLock, wakeLock]);

  useEffect(() => {
    if (!restaurantId) return;
    const kioskHomeRoute = router.pathname === '/kiosk/[restaurantId]';
    if (!forceHome && !kioskHomeRoute) {
      markHomeSeen(restaurantId);
      setHomeVisible(false);
      setContentVisible(true);
      if (!isExpressActive) {
        setSessionActive(true);
        resetIdleTimer();
      }
      return;
    }
    const shouldShow = forceHome || !hasSeenHome(restaurantId);
    setHomeVisible(shouldShow);
    setContentVisible(!shouldShow);
    if (shouldShow) {
      setSessionActive(false);
    }
  }, [forceHome, isExpressActive, resetIdleTimer, restaurantId, router.asPath, router.pathname, setSessionActive]);

  useEffect(() => {
    if (!sessionActive || typeof window === 'undefined') return;
    const handleAnyActivity = () => {
      registerActivity();
    };
    window.addEventListener('pointerdown', handleAnyActivity, { passive: true });
    window.addEventListener('keydown', handleAnyActivity);
    window.addEventListener('touchstart', handleAnyActivity, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleAnyActivity);
      window.removeEventListener('keydown', handleAnyActivity);
      window.removeEventListener('touchstart', handleAnyActivity);
    };
  }, [registerActivity, sessionActive]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const progress = Math.min(Math.max(window.scrollY / 64, 0), 1);
      setShrinkProgress(progress);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const menuPath = useMemo(
    () => (restaurantId ? `/kiosk/${restaurantId}/menu${isExpressActive ? '?express=1' : ''}` : null),
    [isExpressActive, restaurantId]
  );

  const resolveRestaurantIdForNavigation = useCallback(() => {
    if (restaurantId) return restaurantId;
    const queryId = router.query.restaurantId;
    if (typeof queryId === 'string' && queryId.trim()) return queryId;
    if (Array.isArray(queryId) && queryId[0]?.trim()) return queryId[0];
    const pathMatch = router.asPath.match(/\/kiosk\/([^/?#]+)/i);
    if (!pathMatch?.[1]) return null;
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch {
      return pathMatch[1];
    }
  }, [restaurantId, router.asPath, router.query.restaurantId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDebugState(getKioskDebugState());
    return subscribeKioskDebugState((state) => {
      setDebugState(state);
    });
  }, []);

  useEffect(() => {
    const resolvedRestaurantId = resolveRestaurantIdForNavigation();
    patchKioskDebugState(
      {
        route: router.asPath,
        pathname: router.pathname,
        resolvedRestaurantId,
        homeSeen: resolvedRestaurantId ? hasSeenHome(resolvedRestaurantId) : false,
        sessionActive,
        homeVisible,
        contentVisible,
      },
      'layout-state-sync'
    );
  }, [
    contentVisible,
    homeVisible,
    resolveRestaurantIdForNavigation,
    router.asPath,
    router.pathname,
    sessionActive,
  ]);

  useEffect(() => {
    const handleRouteStart = (url: string) => {
      patchKioskDebugState(
        {
          lastNavigationTarget: url,
          navigationStatus: 'start',
          navigationError: null,
        },
        'route-change-start'
      );
      console.info('[kiosk-debug] route change start', { url });
    };

    const handleRouteComplete = (url: string) => {
      patchKioskDebugState(
        {
          route: url,
          lastNavigationTarget: url,
          navigationStatus: 'complete',
          navigationError: null,
        },
        'route-change-complete'
      );
      console.info('[kiosk-debug] route change complete', { url });
    };

    const handleRouteError = (err: unknown, url: string) => {
      const message = err instanceof Error ? err.message : String(err);
      patchKioskDebugState(
        {
          lastNavigationTarget: url,
          navigationStatus: 'error',
          navigationError: message,
        },
        'route-change-error'
      );
      console.error('[kiosk-debug] route change error', { url, err });
    };

    router.events.on('routeChangeStart', handleRouteStart);
    router.events.on('routeChangeComplete', handleRouteComplete);
    router.events.on('routeChangeError', handleRouteError);
    return () => {
      router.events.off('routeChangeStart', handleRouteStart);
      router.events.off('routeChangeComplete', handleRouteComplete);
      router.events.off('routeChangeError', handleRouteError);
    };
  }, [router.events]);

  const startOrdering = useCallback(async () => {
    patchKioskDebugState({}, 'tap-to-order-pressed');
    console.info('[kiosk-debug] tap to order pressed');
    if (!availability.canStartNewSession) return;
    const targetRestaurantId = resolveRestaurantIdForNavigation();
    console.info('[kiosk-debug] tap to order resolved restaurant', {
      restaurantIdFromProp: restaurantId,
      targetRestaurantId,
      asPath: router.asPath,
    });
    patchKioskDebugState(
      {
        resolvedRestaurantId: targetRestaurantId,
      },
      'tap-to-order-resolved-restaurant'
    );
    if (targetRestaurantId) {
      markHomeSeen(targetRestaurantId);
    }
    setSessionActive(true);
    resetIdleTimer();
    setHomeFading(true);
    setContentVisible(true);
    setTimeout(() => {
      setHomeVisible(false);
      setHomeFading(false);
    }, 220);
    const resolvedMenuPath = targetRestaurantId
      ? `/kiosk/${targetRestaurantId}/menu${isExpressActive ? '?express=1' : ''}`
      : menuPath;
    if (resolvedMenuPath && router.asPath !== resolvedMenuPath) {
      patchKioskDebugState(
        {
          lastNavigationTarget: resolvedMenuPath,
          navigationStatus: 'start',
          navigationError: null,
        },
        'tap-to-order-router-push-start'
      );
      console.info('[kiosk-debug] tap to order router.push start', { resolvedMenuPath });
      router.push(resolvedMenuPath).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        patchKioskDebugState(
          {
            lastNavigationTarget: resolvedMenuPath,
            navigationStatus: 'error',
            navigationError: message,
          },
          'tap-to-order-router-push-error'
        );
        console.error('[kiosk-debug] tap to order router.push error', { error, resolvedMenuPath });
      });
    }
    if (shouldSuppressFullscreen) {
      requestWakeLock().catch(() => undefined);
    } else {
      Promise.allSettled([attemptFullscreen({ allowModal: true }), requestWakeLock()]).catch(() => undefined);
    }
  }, [
    attemptFullscreen,
    availability.canStartNewSession,
    isExpressActive,
    menuPath,
    restaurantId,
    resetIdleTimer,
    requestWakeLock,
    resolveRestaurantIdForNavigation,
    router,
    setSessionActive,
    shouldSuppressFullscreen,
  ]);

  const resetOperatorUnlock = useCallback(() => {
    setOperatorPinInput('');
    setOperatorPinError(null);
  }, []);

  const resolvePostUnlockExitDestination = useCallback(() => {
    if (!restaurantId) return null;
    if (isNativeShell) {
      return `/dashboard/launcher?restaurant_id=${encodeURIComponent(restaurantId)}`;
    }
    return `/dashboard?restaurant_id=${encodeURIComponent(restaurantId)}`;
  }, [isNativeShell, restaurantId]);

  const handleOperatorTapTrigger = useCallback(() => {
    if (isExpressActive || !restaurantId) return;
    const now = Date.now();
    const recentTaps = operatorTapHistoryRef.current.filter((timestamp) => now - timestamp <= OPERATOR_EXIT_TAP_WINDOW_MS);
    recentTaps.push(now);
    operatorTapHistoryRef.current = recentTaps;
    if (recentTaps.length >= OPERATOR_EXIT_TAP_THRESHOLD) {
      operatorTapHistoryRef.current = [];
      resetOperatorUnlock();
      setShowOperatorUnlock(true);
    }
  }, [isExpressActive, resetOperatorUnlock, restaurantId]);

  const handleOperatorExit = useCallback(async () => {
    const destination = resolvePostUnlockExitDestination();
    if (!destination) return;
    resetOperatorUnlock();
    setShowOperatorUnlock(false);
    setShowFullscreenPrompt(false);
    await exitDocumentFullscreen();
    await router.push(destination);
  }, [resetOperatorUnlock, resolvePostUnlockExitDestination, router]);

  const handleOperatorUnlockSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!restaurantId) return;
      if (operatorPinInput.trim() !== TEMP_OPERATOR_EXIT_PIN) {
        setOperatorPinError('Incorrect staff PIN.');
        return;
      }
      void handleOperatorExit();
    },
    [handleOperatorExit, operatorPinInput, restaurantId]
  );

  const clampDebugPosition = useCallback((x: number, y: number, expanded: boolean) => {
    if (typeof window === 'undefined') return { x, y };
    const panelWidth = expanded ? DEBUG_PANEL_WIDTH : DEBUG_COLLAPSED_SIZE;
    const panelHeight = expanded ? DEBUG_PANEL_HEIGHT : DEBUG_COLLAPSED_SIZE;
    const maxX = Math.max(8, window.innerWidth - panelWidth - 8);
    const maxY = Math.max(8, window.innerHeight - panelHeight - 8);
    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(8, y), maxY),
    };
  }, []);

  const beginDebugDrag = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const target = event.currentTarget;
      const pointer = debugDragRef.current;
      pointer.active = true;
      pointer.pointerId = event.pointerId;
      pointer.offsetX = event.clientX - debugPanelPosition.x;
      pointer.offsetY = event.clientY - debugPanelPosition.y;
      pointer.moved = false;
      target.setPointerCapture(event.pointerId);
    },
    [debugPanelPosition.x, debugPanelPosition.y]
  );

  const handleDebugDragMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const pointer = debugDragRef.current;
      if (!pointer.active || pointer.pointerId !== event.pointerId) return;
      const nextX = event.clientX - pointer.offsetX;
      const nextY = event.clientY - pointer.offsetY;
      if (Math.abs(nextX - debugPanelPosition.x) > 3 || Math.abs(nextY - debugPanelPosition.y) > 3) {
        pointer.moved = true;
      }
      setDebugPanelPosition(clampDebugPosition(nextX, nextY, debugPanelExpanded));
    },
    [clampDebugPosition, debugPanelExpanded, debugPanelPosition.x, debugPanelPosition.y]
  );

  const endDebugDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    const pointer = debugDragRef.current;
    if (!pointer.active || pointer.pointerId !== event.pointerId) return;
    pointer.active = false;
    pointer.pointerId = -1;
  }, []);

  const handleDebugBubbleTap = useCallback(() => {
    if (debugDragRef.current.moved) {
      debugDragRef.current.moved = false;
      return;
    }
    setDebugPanelExpanded(true);
  }, []);

  useEffect(() => {
    setDebugPanelPosition((prev) => clampDebugPosition(prev.x, prev.y, debugPanelExpanded));
  }, [clampDebugPosition, debugPanelExpanded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setDebugPanelPosition((prev) => clampDebugPosition(prev.x, prev.y, debugPanelExpanded));
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [clampDebugPosition, debugPanelExpanded]);

  const handleForceOpenMenuDebug = useCallback(() => {
    const resolvedRestaurantId = resolveRestaurantIdForNavigation();
    const targetPath = resolvedRestaurantId
      ? `/kiosk/${resolvedRestaurantId}/menu${isExpressActive ? '?express=1' : ''}`
      : menuPath;
    patchKioskDebugState(
      {
        lastNavigationTarget: targetPath,
        navigationStatus: targetPath ? 'start' : 'error',
        navigationError: targetPath ? null : 'Unable to resolve kiosk menu target path.',
      },
      'debug-force-open-menu'
    );
    console.info('[kiosk-debug] force open menu requested', { targetPath, resolvedRestaurantId });
    if (!targetPath || router.asPath === targetPath) return;
    exitDocumentFullscreen().finally(() => {
      router.push(targetPath).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        patchKioskDebugState(
          {
            lastNavigationTarget: targetPath,
            navigationStatus: 'error',
            navigationError: message,
          },
          'debug-force-open-menu-error'
        );
        console.error('[kiosk-debug] force open menu failed', { error, targetPath });
      });
    });
  }, [isExpressActive, menuPath, resolveRestaurantIdForNavigation, router]);

  const handleExitDebug = useCallback(() => {
    if (!restaurantId) return;
    const targetPath = `/dashboard?restaurant_id=${encodeURIComponent(restaurantId)}`;
    patchKioskDebugState(
      {
        lastNavigationTarget: targetPath,
        navigationStatus: 'start',
        navigationError: null,
      },
      'debug-exit-kiosk'
    );
    console.info('[kiosk-debug] debug exit requested', { targetPath });
    exitDocumentFullscreen().finally(() => {
      router.push(targetPath).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        patchKioskDebugState(
          {
            lastNavigationTarget: targetPath,
            navigationStatus: 'error',
            navigationError: message,
          },
          'debug-exit-kiosk-error'
        );
        console.error('[kiosk-debug] debug exit failed', { error, targetPath });
      });
    });
  }, [restaurantId, router]);


  useEffect(() => {
    if (typeof window === 'undefined' || shouldSuppressFullscreen || isExpressActive || !restaurantId) return;

    const preventBackEscape = () => {
      window.history.pushState({ orderfastKioskLock: true }, '', window.location.href);
    };

    const handlePopState = () => {
      setShowLockedNavigationNotice(false);
      setShowOperatorUnlock(false);
      setShowFullscreenPrompt(false);
      void (async () => {
        await exitDocumentFullscreen();
        await supabase.auth.signOut();
        await router.replace('/login?kiosk_exit=1');
      })();
    };

    preventBackEscape();
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isExpressActive, restaurantId, router, shouldSuppressFullscreen]);

  const headerTitle = restaurant?.website_title || restaurant?.name || 'Restaurant';
  const logoUrl = restaurant?.logo_url || null;
  const logoShape = restaurant?.logo_shape || 'round';
  const logoShellClass =
    logoShape === 'round' ? 'rounded-full' : logoShape === 'square' ? 'rounded-2xl' : 'rounded-xl';
  const debugPanelEnabled = false;
  const logoInnerClass =
    logoShape === 'round' ? 'rounded-full' : logoShape === 'square' ? 'rounded-xl' : 'rounded-lg';
  const logoSizeClass = logoShape === 'rectangular' ? 'h-16 w-20' : 'h-16 w-16';
  const logoImageClass = logoShape === 'rectangular' ? 'object-contain' : 'object-cover';
  const showBrandSkeleton = restaurantLoading;

  const hasCustomHeader = Boolean(customHeaderContent);
  const expandedHeaderHeight = hasCustomHeader ? 116 : FULL_HEADER_HEIGHT;
  const collapsedHeaderHeight = hasCustomHeader ? 86 : COLLAPSED_HEADER_HEIGHT;
  const headerHeight =
    expandedHeaderHeight - (expandedHeaderHeight - collapsedHeaderHeight) * shrinkProgress;
  const categoryHeight = FULL_CAT_HEIGHT - (FULL_CAT_HEIGHT - COLLAPSED_CAT_HEIGHT) * shrinkProgress;
  const headerPaddingExpanded = hasCustomHeader ? 14 : 16;
  const headerPaddingCollapsed = hasCustomHeader ? 9 : 10;
  const headerPaddingY =
    headerPaddingExpanded - (headerPaddingExpanded - headerPaddingCollapsed) * shrinkProgress;
  const brandScale = 1 - shrinkProgress * 0.08;
  const cartScale = 1 - shrinkProgress * 0.08;
  const categoriesScale = 1 - shrinkProgress * 0.06;
  const fadeOverlayOpacity = Math.min(shrinkProgress * 1.2, 1);
  const showHeader = !homeVisible && !hideHeader;
  const showCategoryBar = showHeader && Boolean(categoryBar);
  const headerContent = useMemo(() => {
    if (customHeaderContent) return customHeaderContent;
    return (
      <div
        className="flex h-full w-full items-center justify-between px-5 sm:px-8"
        style={{ gap: '1.25rem' }}
      >
        <div
          className="relative flex items-center gap-4"
          style={{ transform: `scale(${brandScale})`, transformOrigin: 'left center' }}
          onPointerUp={handleOperatorTapTrigger}
        >
          <span
            aria-hidden
            className="absolute -inset-x-4 -inset-y-3 rounded-2xl"
            style={{ touchAction: 'none' }}
          />
          {showBrandSkeleton ? (
            <>
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-white/90">
                <div className="h-14 w-14 rounded-full bg-neutral-200/80 animate-pulse" />
              </div>
              <div className="h-9 w-52 rounded-full bg-neutral-200/80 animate-pulse sm:w-64" />
            </>
          ) : (
            <>
              {logoUrl ? (
                <div className={`flex ${logoSizeClass} flex-shrink-0 items-center justify-center bg-white/90 ${logoShellClass}`}>
                  <div className={`relative h-14 w-14 overflow-hidden border border-neutral-200 shadow-sm ${logoInnerClass}`}>
                    <Image
                      src={logoUrl}
                      alt={`${headerTitle} logo`}
                      fill
                      sizes="64px"
                      className={`${logoInnerClass} ${logoImageClass}`}
                    />
                  </div>
                </div>
              ) : null}
              <span className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900">
                {headerTitle}
              </span>
            </>
          )}
        </div>
        {restaurantId && !hideCartButton ? (
          <div
            style={{ transform: `scale(${cartScale})`, transformOrigin: 'right center' }}
            className="hidden md:block"
          >
            <KioskActionButton
              href={`/kiosk/${restaurantId}/cart${isExpressActive ? '?express=1' : ''}`}
              onClick={registerActivity}
              className="px-5 py-3 text-sm font-semibold shadow-lg shadow-black/10"
              data-cart-anchor="desktop"
            >
              <ShoppingCartIcon className="h-5 w-5" />
              View cart ({cartCount})
            </KioskActionButton>
          </div>
        ) : null}
      </div>
    );
  }, [
    brandScale,
    cartCount,
    cartScale,
    customHeaderContent,
    headerTitle,
    logoImageClass,
    logoInnerClass,
    logoShellClass,
    logoSizeClass,
    logoUrl,
    handleOperatorTapTrigger,
    registerActivity,
    restaurantId,
    isExpressActive,
    showBrandSkeleton,
  ]);

  const handleFullscreenPromptClick = useCallback(async () => {
    if (shouldSuppressFullscreen) {
      await requestWakeLock();
    } else {
      await Promise.allSettled([attemptFullscreen({ allowModal: true }), requestWakeLock()]);
    }
  }, [attemptFullscreen, requestWakeLock, shouldSuppressFullscreen]);

  const countdownColor = useMemo(() => {
    if (idleCountdown <= 3) return '#E63946';
    if (idleCountdown <= 6) return '#F5A623';
    return '#000000';
  }, [idleCountdown]);

  return (
    <div
      className="min-h-screen w-full bg-gradient-to-b from-[#fafafa] via-white to-white text-neutral-900"
      style={layoutStyle}
    >
      {showHeader ? (
        <div
          id="kiosk-header-stack"
          className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur"
          style={{ willChange: 'transform' }}
        >
          <header
            id="kioskHeader"
            className="w-full bg-transparent text-neutral-900"
            style={{ height: headerHeight, paddingTop: headerPaddingY, paddingBottom: headerPaddingY }}
          >
            {headerContent}
          </header>
          {showCategoryBar ? (
            <div
              className="bg-transparent"
              style={{ height: categoryHeight, transform: `scale(${categoriesScale})`, transformOrigin: 'top center' }}
            >
              <div className="mx-auto flex h-full w-full max-w-5xl items-center px-4 sm:px-6">{categoryBar}</div>
            </div>
          ) : null}
        </div>
      ) : null}
      <main
        id="kioskContent"
        style={{ paddingTop: showHeader ? headerHeight + categoryHeight : 0 }}
        className={`transition-opacity duration-200 ${contentVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {showCategoryBar ? (
          <div
            aria-hidden
            className="pointer-events-none fixed left-0 right-0 z-40"
            style={{
              top: headerHeight + categoryHeight - 1,
              height: CATEGORY_FADE_HEIGHT,
              opacity: fadeOverlayOpacity,
              transition: 'opacity 150ms linear',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.5) 42%, rgba(255,255,255,0) 100%)',
            }}
          />
        ) : null}
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-20 sm:px-8 lg:max-w-7xl">
          {contentVisible ? children : null}
        </div>
      </main>
      {homeVisible ? (
        <HomeScreen
          restaurant={restaurant || null}
          onStart={startOrdering}
          onOperatorTapTrigger={handleOperatorTapTrigger}
          fadingOut={homeFading}
          loading={restaurantLoading}
          closedState={
            !availability.loading && !availability.canStartNewSession
              ? {
                  active: true,
                  title: availability.snapshot.reason === 'on_break' ? 'Temporarily closed' : 'Closed',
                  detail: availability.snapshot.secondaryLabel,
                }
              : undefined
          }
        />
      ) : null}
      {availability.graceActive ? (
        <div className="fixed left-1/2 top-5 z-[75] w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-xl">
          <p className="text-sm font-semibold">{availability.graceMessage}</p>
          <p className="text-sm">Finish this order in {availability.countdownLabel}.</p>
        </div>
      ) : null}
      {deferredPrompt && !isInstalled && !installDismissed ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={handleInstallClick}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-4 py-2 text-sm font-semibold text-neutral-900 shadow-lg shadow-neutral-300/70 backdrop-blur transition hover:bg-white"
          >
            Install App
          </button>
        </div>
      ) : null}
      {!shouldSuppressFullscreen && shouldAutoFullscreen && (!isKioskFullscreenActive || showFullscreenPrompt) ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 px-6 text-center">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl shadow-black/10">
            <p className="text-lg font-semibold text-neutral-900">Tap to continue kiosk</p>
            <p className="mt-2 text-sm text-neutral-600">Kiosk is locked until fullscreen is restored.</p>
            <KioskActionButton onClick={handleFullscreenPromptClick} className="mt-6 w-full justify-center text-base">
              Enter fullscreen
            </KioskActionButton>
          </div>
        </div>
      ) : null}
      {showIdleModal && !showClosedDimOverlay ? (
        <div className="IdleOverlay">
          <div className="IdleModalCard">
            <h2 className="IdleTitle">Still there?</h2>
            <p className="IdleSubtitle">{idleMessage}</p>

            <div className="IdleCountdownWrapper">
              <div className="IdleCountdownNumber" key={idleCountdownStarted ? idleCountdown : 'idle-hold-10'} style={{ color: countdownColor }}>
                {idleCountdown}
              </div>
            </div>

            <div className="IdleButtons">
              <button className="IdleStayButton" onClick={handleIdleStay}>
                I'm still here
              </button>

              <button className="IdleResetButton" onClick={handleIdleTimeout}>
                Start over
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showClosedDimOverlay ? (
        <button
          type="button"
          onClick={handleClosedOverlayWakeTap}
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/95 pb-12 text-white/70"
          aria-label="Kiosk dim overlay"
        >
          {closedOverlayWakeHint ? <span className="text-xs tracking-wide">{closedOverlayWakeHint}</span> : null}
        </button>
      ) : null}
      {showLockedNavigationNotice && !isExpressActive ? (
        <div className="fixed left-1/2 top-5 z-[80] w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-neutral-900/10 bg-white/95 px-4 py-3 text-neutral-900 shadow-xl backdrop-blur">
          <p className="text-sm font-semibold">Kiosk navigation is locked.</p>
          <p className="text-xs text-neutral-600">Staff: tap the kiosk header 5 times to open staff unlock.</p>
        </div>
      ) : null}
      {showOperatorUnlock && !isExpressActive ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/30 px-6">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl shadow-black/20">
            <p className="text-lg font-semibold text-neutral-900">Staff unlock required</p>
            <p className="mt-2 text-sm text-neutral-600">Enter staff PIN to exit kiosk and return to dashboard.</p>
            <form className="mt-5 space-y-4" onSubmit={handleOperatorUnlockSubmit}>
              <input
                ref={operatorPinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                enterKeyHint="done"
                value={operatorPinInput}
                onChange={(event) => {
                  const numericValue = event.target.value.replace(/\D/g, '');
                  setOperatorPinInput(numericValue.slice(0, 8));
                  setOperatorPinError(null);
                }}
                className="w-full rounded-2xl border border-neutral-300 px-4 py-3 text-base tracking-[0.22em] text-neutral-900 outline-none ring-[var(--kiosk-accent,#111827)]/20 focus:ring-2"
                placeholder="Enter PIN"
                aria-label="Staff unlock PIN"
              />
              {operatorPinError ? <p className="text-sm font-medium text-rose-600">{operatorPinError}</p> : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetOperatorUnlock();
                    setShowOperatorUnlock(false);
                  }}
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700"
                >
                  Cancel
                </button>
                <KioskActionButton type="submit" className="flex-1 justify-center px-4 py-2.5 text-sm">
                  Unlock exit
                </KioskActionButton>
              </div>
            </form>
            <p className="mt-3 text-[11px] text-neutral-500">
              Temporary: this build uses a hardcoded staff PIN until kiosk settings are wired.
            </p>
          </div>
        </div>
      ) : null}
      {debugPanelEnabled ? (
        <div className="fixed z-[90]" style={{ left: debugPanelPosition.x, top: debugPanelPosition.y }}>
          {debugPanelExpanded ? (
            <div className="w-[min(92vw,320px)] rounded-2xl border border-neutral-900/20 bg-black/85 p-3 text-xs text-white shadow-2xl">
              <div
                className="mb-2 flex cursor-move touch-none items-center justify-between"
                onPointerDown={beginDebugDrag}
                onPointerMove={handleDebugDragMove}
                onPointerUp={endDebugDrag}
                onPointerCancel={endDebugDrag}
              >
                <p className="font-semibold uppercase tracking-[0.08em] text-white/80">Kiosk debug (temporary)</p>
                <button
                  type="button"
                  onClick={() => setDebugPanelExpanded(false)}
                  className="rounded-full bg-white/20 px-2 py-1 text-[11px] font-semibold text-white"
                >
                  Collapse
                </button>
              </div>
              <div className="space-y-1 font-mono text-[11px] leading-snug">
                <p>route: {router.asPath || 'n/a'}</p>
                <p>resolvedRestaurantId: {resolveRestaurantIdForNavigation() || 'n/a'}</p>
                <p>sessionActive: {String(sessionActive)}</p>
                <p>homeSeen: {String(restaurantId ? hasSeenHome(restaurantId) : false)}</p>
                <p>homeVisible/contentVisible: {String(homeVisible)} / {String(contentVisible)}</p>
                <p>lastNavTarget: {debugState.lastNavigationTarget || 'n/a'}</p>
                <p>navStatus: {debugState.navigationStatus || 'idle'}</p>
                <p>navError: {debugState.navigationError || 'n/a'}</p>
                <p>menuMounted: {String(Boolean(debugState.menuMounted))}</p>
                <p>
                  menuBlocked: {String(Boolean(debugState.menuBlockedBySession))}
                  {debugState.menuBlockedReason ? ` (${debugState.menuBlockedReason})` : ''}
                </p>
                <p>lastEvent: {debugState.lastEvent || 'n/a'}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleForceOpenMenuDebug}
                  className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Force open menu (debug)
                </button>
                <button
                  type="button"
                  onClick={handleExitDebug}
                  className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Exit kiosk (debug)
                </button>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="Open kiosk debug panel"
              className="flex h-14 w-14 touch-none items-center justify-center rounded-full border border-neutral-200/60 bg-black/80 text-xs font-bold text-white shadow-xl"
              onPointerDown={beginDebugDrag}
              onPointerMove={handleDebugDragMove}
              onPointerUp={(event) => {
                endDebugDrag(event);
                handleDebugBubbleTap();
              }}
              onPointerCancel={endDebugDrag}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setDebugPanelExpanded(true);
                }
              }}
            >
              DBG
            </div>
          )}
        </div>
      ) : null}
      {restaurantId && !hideCartButton ? (
        <div className="fixed bottom-4 right-4 z-40 flex items-center justify-end md:hidden">
          <KioskActionButton
            href={`/kiosk/${restaurantId}/cart${isExpressActive ? '?express=1' : ''}`}
            onClick={registerActivity}
            className="h-14 w-14 rounded-full p-0 text-base shadow-2xl shadow-black/20 transition active:scale-95"
            aria-label={`View cart (${cartCount})`}
            data-cart-anchor="fab"
          >
            <div className="relative flex h-full w-full items-center justify-center">
              <ShoppingCartIcon className="h-6 w-6" />
              <span className="absolute -right-1 -top-1 inline-flex min-w-[24px] items-center justify-center rounded-full bg-white px-2 text-xs font-bold text-[var(--kiosk-accent,#111827)] shadow-md">
                {cartCount}
              </span>
            </div>
          </KioskActionButton>
        </div>
      ) : null}
      <style jsx global>{`
        .IdleOverlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(8px);
          display: flex;
          justify-content: center;
          align-items: center;
          pointer-events: auto;
        }

        .IdleModalCard {
          width: calc(100% - 48px);
          max-width: 480px;
          background: #ffffff;
          border-radius: 36px;
          padding: 48px 36px 40px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .IdleTitle {
          font-size: 34px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 12px;
        }

        .IdleSubtitle {
          font-size: 17px;
          text-align: center;
          color: #555;
          margin-bottom: 24px;
          max-width: 90%;
        }

        .IdleCountdownWrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 32px;
        }

        .IdleCountdownNumber {
          font-size: 100px;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 8px;
          animation: idleBump 120ms ease-out;
        }

        @keyframes idleBump {
          0% {
            transform: scale(1);
          }
          40% {
            transform: scale(1.12);
          }
          100% {
            transform: scale(1);
          }
        }

        .IdleCountdownText {
          font-size: 15px;
          color: #777;
        }

        .IdleButtons {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .IdleStayButton,
        .IdleResetButton {
          width: 100%;
          height: 64px;
          border-radius: 999px;
          font-size: 18px;
          font-weight: 600;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .IdleStayButton {
          background: #ffffff;
          border: 2px solid rgba(0, 0, 0, 0.08);
          color: #111;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        }

        .IdleResetButton {
          background: #e63946;
          color: white;
          font-weight: 700;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  );
}
