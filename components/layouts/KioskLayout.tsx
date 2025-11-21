import { ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import HomeScreen, { type KioskRestaurant } from '@/components/kiosk/HomeScreen';
import KioskActionButton from '@/components/kiosk/KioskActionButton';
import { clearHomeSeen, hasSeenHome, markHomeSeen } from '@/utils/kiosk/session';
import {
  KIOSK_HEADER_COLLAPSED_HEIGHT,
  KIOSK_HEADER_FULL_HEIGHT,
  KIOSK_HEADER_SHRINK_THRESHOLD,
  KIOSK_CATEGORY_BAR_HEIGHT,
  KIOSK_SCROLL_PADDING,
} from '@/components/kiosk/kioskHeaderConstants';

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

type BeforeInstallPromptEvent = Event & {
  prompt?: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type KioskLayoutProps = {
  restaurantId?: string | null;
  restaurant?: KioskRestaurant | null;
  cartCount?: number;
  children: ReactNode;
  forceHome?: boolean;
  onScrollContainerChange?: (el: HTMLDivElement | null) => void;
  scrollPaddingTop?: number;
};

export default function KioskLayout({
  restaurantId,
  restaurant,
  cartCount = 0,
  children,
  forceHome = false,
  onScrollContainerChange,
  scrollPaddingTop = KIOSK_SCROLL_PADDING,
}: KioskLayoutProps) {
  const router = useRouter();
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
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const autoPromptedRef = useRef(false);
  const fullscreenRequestInFlight = useRef(false);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const accentColor = useMemo(() => restaurant?.theme_primary_color || '#111827', [restaurant?.theme_primary_color]);
  const [isShrunk, setIsShrunk] = useState(false);
  const [shrinkProgress, setShrinkProgress] = useState(0);
  const scrollTickingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerMeasuredHeight, setHeaderMeasuredHeight] = useState(KIOSK_HEADER_FULL_HEIGHT);
  const layoutStyle = useMemo(() => ({ '--kiosk-accent': accentColor }) as CSSProperties, [accentColor]);
  const headerHeight = useMemo(
    () =>
      Math.round(
        KIOSK_HEADER_FULL_HEIGHT -
          (KIOSK_HEADER_FULL_HEIGHT - KIOSK_HEADER_COLLAPSED_HEIGHT) * Math.min(Math.max(shrinkProgress, 0), 1)
      ),
    [shrinkProgress]
  );
  const categoryBarHeight = useMemo(
    () => Math.round(KIOSK_CATEGORY_BAR_HEIGHT - 10 * Math.min(Math.max(shrinkProgress, 0), 1)),
    [shrinkProgress]
  );
  const headerTranslateY = useMemo(() => -10 * Math.min(Math.max(shrinkProgress, 0), 1), [shrinkProgress]);
  const headerPaddingY = useMemo(() => 32 - 14 * Math.min(Math.max(shrinkProgress, 0), 1), [shrinkProgress]);
  const titleScale = useMemo(() => 1 - 0.08 * Math.min(Math.max(shrinkProgress, 0), 1), [shrinkProgress]);
  const effectiveHeaderHeight = headerMeasuredHeight || headerHeight;
  const layoutWithHeaderStyle = useMemo(
    () => ({
      ...layoutStyle,
      '--kiosk-header-height': `${effectiveHeaderHeight}px`,
      '--kiosk-category-height': `${categoryBarHeight}px`,
      '--kiosk-header-progress': shrinkProgress,
      '--kiosk-header-translate': `${headerTranslateY}px`,
      '--kiosk-header-padding-y': `${headerPaddingY}px`,
      '--kiosk-header-title-scale': titleScale,
      '--kiosk-category-scale': `${1 - 0.06 * Math.min(Math.max(shrinkProgress, 0), 1)}`,
    }) as CSSProperties,
    [categoryBarHeight, effectiveHeaderHeight, headerPaddingY, headerTranslateY, layoutStyle, shrinkProgress, titleScale]
  );

  const isFullscreenActive = useCallback(() => {
    if (typeof document === 'undefined') return false;
    const anyDoc = document as Document & { webkitFullscreenElement?: Element | null };
    return Boolean(document.fullscreenElement || anyDoc.webkitFullscreenElement);
  }, []);

  const attemptFullscreen = useCallback(
    async (options: { allowModal?: boolean } = {}) => {
      if (typeof document === 'undefined') return false;
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
      if (!el) return false;
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
          const request = el.requestFullscreen?.bind(el) || el.webkitRequestFullscreen?.bind(el);
          if (!request) {
            if (options.allowModal) {
              setShowFullscreenPrompt(true);
            }
          } else {
            await Promise.resolve(request());
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
    [isFullscreenActive]
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
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    const previousColorScheme = html.style.colorScheme;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    html.style.colorScheme = 'light';
    html.classList.add('kiosk-mode');
    body.classList.add('kiosk-mode');

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overscrollBehavior = previousBodyOverscroll;
      html.style.colorScheme = previousColorScheme;
      html.classList.remove('kiosk-mode');
      body.classList.remove('kiosk-mode');
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
      if (isFullscreenActive()) {
        setShowFullscreenPrompt(false);
        return;
      }
      setTimeout(() => {
        attemptFullscreen({ allowModal: true });
      }, 150);
    };

    const media = window.matchMedia?.('(display-mode: standalone)');

    evaluateDisplayMode();
    attemptFullscreen({ allowModal: true });

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
  }, [attemptFullscreen, isInstalled, isFullscreenActive]);

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
    onScrollContainerChange?.(scrollContainerRef.current);

    return () => {
      onScrollContainerChange?.(null);
    };
  }, [onScrollContainerChange]);

  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;

    const measure = () => {
      const next = Math.round(headerEl.getBoundingClientRect().height);
      setHeaderMeasuredHeight((prev) => (prev !== next ? next : prev));
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measure());
      observer.observe(headerEl);
      return () => observer.disconnect();
    }

    const handleResize = () => measure();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [headerHeight]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleInteraction = async () => {
      await Promise.allSettled([attemptFullscreen({ allowModal: true }), requestWakeLock()]);
    };

    attemptFullscreen({ allowModal: true });
    requestWakeLock();

    window.addEventListener('pointerdown', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [attemptFullscreen, requestWakeLock]);

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
    const shouldShow = forceHome || !hasSeenHome(restaurantId);
    setHomeVisible(shouldShow);
    setContentVisible(!shouldShow);
  }, [forceHome, restaurantId]);

  const basePath = useMemo(() => (restaurantId ? `/kiosk/${restaurantId}` : null), [restaurantId]);
  const menuPath = useMemo(() => (restaurantId ? `/kiosk/${restaurantId}/menu` : null), [restaurantId]);

  const startOrdering = useCallback(async () => {
    if (restaurantId) {
      markHomeSeen(restaurantId);
    }
    setHomeFading(true);
    setContentVisible(true);
    setTimeout(() => {
      setHomeVisible(false);
      setHomeFading(false);
    }, 220);
    await Promise.allSettled([attemptFullscreen({ allowModal: true }), requestWakeLock()]);
    if (menuPath && router.asPath !== menuPath) {
      router.push(menuPath).catch(() => undefined);
    }
    resetInactivityTimer();
  }, [attemptFullscreen, menuPath, requestWakeLock, restaurantId, router]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (homeVisible) return;
    inactivityTimer.current = setTimeout(() => {
      if (!restaurantId) return;
      clearHomeSeen(restaurantId);
      setHomeVisible(true);
      setContentVisible(false);
      if (basePath && router.asPath !== basePath) {
        router.push(basePath).catch(() => undefined);
      }
    }, 25000);
  }, [basePath, homeVisible, restaurantId, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    resetInactivityTimer();

    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
    };
  }, [resetInactivityTimer]);

  const handleScroll = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      if (scrollTickingRef.current) return;
      scrollTickingRef.current = true;
      requestAnimationFrame(() => {
        const maxDistance = Math.max(KIOSK_HEADER_SHRINK_THRESHOLD, 1);
        const progress = Math.min(Math.max(el.scrollTop / maxDistance, 0), 1);
        const nextShrunk = progress >= 0.98;
        setShrinkProgress((prev) => (prev !== progress ? progress : prev));
        setIsShrunk((prev) => (prev !== nextShrunk ? nextShrunk : prev));
        scrollTickingRef.current = false;
      });
      resetInactivityTimer();
    },
    [resetInactivityTimer]
  );

  useEffect(() => {
    handleScroll(scrollContainerRef.current);
  }, [handleScroll]);

  const headerContent = useMemo(() => {
    const headerTitle = restaurant?.name || 'Restaurant';
    const subtitle = restaurant?.website_description;

    const headerStyle = {
      minHeight: `${headerHeight}px`,
      paddingTop: `${headerPaddingY}px`,
      paddingBottom: `${headerPaddingY}px`,
      transform: `translateY(${headerTranslateY}px)`,
      transition: 'transform 200ms ease, min-height 220ms ease, padding 220ms ease',
    };

    return (
      <header
        ref={headerRef}
        data-kiosk-header
        className="absolute left-0 right-0 top-0 z-30 w-full border-b border-neutral-200 bg-white/90 text-neutral-900 shadow-sm backdrop-blur"
        style={headerStyle}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex flex-col">
            <span
              className="font-semibold leading-tight tracking-tight text-neutral-900 text-2xl sm:text-3xl"
              style={{
                transform: `scale(${titleScale}) translateY(${(-2 * shrinkProgress).toFixed(2)}px)`,
                transformOrigin: 'left center',
                transition: 'transform 200ms ease',
              }}
            >
              {headerTitle}
            </span>
            {subtitle ? (
              <span
                className="mt-2 text-sm font-medium text-neutral-600 sm:text-base"
                style={{
                  opacity: 1 - shrinkProgress,
                  transform: `translateY(${(6 * shrinkProgress).toFixed(2)}px)`,
                  transition: 'opacity 200ms ease, transform 200ms ease',
                  display: shrinkProgress >= 0.98 ? 'none' : undefined,
                }}
              >
                {subtitle}
              </span>
            ) : null}
          </div>
          {restaurantId ? (
            <KioskActionButton
              href={`/kiosk/${restaurantId}/cart`}
              className="px-4 py-2 text-sm font-semibold sm:px-5 sm:py-3"
              style={{
                transform: `translateY(${(-2 * shrinkProgress).toFixed(2)}px) scale(${1 - 0.04 * shrinkProgress})`,
                transition: 'transform 200ms ease',
                transformOrigin: 'center',
              }}
            >
              <ShoppingCartIcon className="h-5 w-5" />
              View cart ({cartCount})
            </KioskActionButton>
          ) : null}
        </div>
      </header>
    );
  }, [cartCount, headerHeight, headerPaddingY, headerTranslateY, restaurant?.name, restaurant?.website_description, restaurantId, shrinkProgress, titleScale]);

  const handleFullscreenPromptClick = useCallback(async () => {
    await Promise.allSettled([attemptFullscreen({ allowModal: true }), requestWakeLock()]);
  }, [attemptFullscreen, requestWakeLock]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white text-neutral-900" style={layoutWithHeaderStyle}>
      {headerContent}
      <div
        ref={scrollContainerRef}
        onScroll={(event) => handleScroll(event.currentTarget)}
        className={`relative h-full w-full bg-white px-4 pb-6 transition-opacity duration-200 sm:px-8 ${
          contentVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          height: '100vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingTop: scrollPaddingTop,
          scrollPaddingTop: `${scrollPaddingTop}px`,
        }}
      >
        <div className="mx-auto flex w-full max-w-none flex-col gap-8">{children}</div>
      </div>
      {homeVisible ? (
        <HomeScreen restaurant={restaurant || null} onStart={startOrdering} fadingOut={homeFading} />
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
      {showFullscreenPrompt ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 px-6 text-center">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl shadow-black/10">
            <p className="text-lg font-semibold text-neutral-900">Tap to enter kiosk mode</p>
            <p className="mt-2 text-sm text-neutral-600">Tap below to stay fully immersed in the kiosk experience.</p>
            <KioskActionButton
              onClick={handleFullscreenPromptClick}
              className="mt-6 w-full justify-center text-base"
            >
              Enter fullscreen
            </KioskActionButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
