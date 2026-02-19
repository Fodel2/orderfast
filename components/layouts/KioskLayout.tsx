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
  type ReactNode,
} from 'react';
import HomeScreen, { type KioskRestaurant } from '@/components/kiosk/HomeScreen';
import KioskActionButton from '@/components/kiosk/KioskActionButton';
import { useKioskSession } from '@/context/KioskSessionContext';
import { hasSeenHome, markHomeSeen } from '@/utils/kiosk/session';

export const FULL_HEADER_HEIGHT = 136;
export const COLLAPSED_HEADER_HEIGHT = 88;
export const FULL_CAT_HEIGHT = 64;
export const COLLAPSED_CAT_HEIGHT = 50;

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
  restaurantLoading?: boolean;
  cartCount?: number;
  children: ReactNode;
  forceHome?: boolean;
  categoryBar?: ReactNode;
  customHeaderContent?: ReactNode;
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
  const [fullscreenViewport, setFullscreenViewport] = useState<FullscreenViewport>('desktop');
  const [shrinkProgress, setShrinkProgress] = useState(0);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const autoPromptedRef = useRef(false);
  const fullscreenRequestInFlight = useRef(false);
  const accentColor = useMemo(() => restaurant?.theme_primary_color || '#111827', [restaurant?.theme_primary_color]);
  const {
    setSessionActive,
    registerActivity,
    resetIdleTimer,
    showIdleModal,
    idleCountdown,
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
  const isFullscreenActive = useCallback(() => {
    if (typeof document === 'undefined') return false;
    const anyDoc = document as Document & { webkitFullscreenElement?: Element | null };
    return Boolean(document.fullscreenElement || anyDoc.webkitFullscreenElement);
  }, []);

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

  const shouldAutoFullscreen = fullscreenViewport !== 'phone';

  const attemptFullscreen = useCallback(
    async (options: { allowModal?: boolean } = {}) => {
      if (typeof document === 'undefined') return false;
      if (!shouldAutoFullscreen) {
        setShowFullscreenPrompt(false);
        return false;
      }
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
    [isFullscreenActive, shouldAutoFullscreen]
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
      if (isFullscreenActive()) {
        setShowFullscreenPrompt(false);
        return;
      }
      if (!shouldAutoFullscreen) {
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
  }, [attemptFullscreen, isInstalled, isFullscreenActive, shouldAutoFullscreen]);

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

    if (!shouldAutoFullscreen) {
      setShowFullscreenPrompt(false);
      requestWakeLock();
      return;
    }

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
  }, [attemptFullscreen, requestWakeLock, shouldAutoFullscreen]);

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
    if (shouldShow) {
      setSessionActive(false);
    }
  }, [forceHome, restaurantId, setSessionActive]);

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

  const basePath = useMemo(() => (restaurantId ? `/kiosk/${restaurantId}` : null), [restaurantId]);
  const menuPath = useMemo(() => (restaurantId ? `/kiosk/${restaurantId}/menu` : null), [restaurantId]);

  const startOrdering = useCallback(async () => {
    if (restaurantId) {
      markHomeSeen(restaurantId);
    }
    setSessionActive(true);
    resetIdleTimer();
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
  }, [attemptFullscreen, menuPath, resetIdleTimer, requestWakeLock, restaurantId, router]);

  const headerTitle = restaurant?.website_title || restaurant?.name || 'Restaurant';
  const logoUrl = restaurant?.logo_url || null;
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
  const showHeader = !homeVisible;
  const showCategoryBar = showHeader && Boolean(categoryBar);
  const headerContent = useMemo(() => {
    if (customHeaderContent) return customHeaderContent;
    return (
      <div
        className="flex h-full w-full items-center justify-between px-5 sm:px-8"
        style={{ gap: '1.25rem' }}
      >
        <div
          className="flex items-center gap-4"
          style={{ transform: `scale(${brandScale})`, transformOrigin: 'left center' }}
        >
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
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-white/90">
                  <div className="relative h-14 w-14 overflow-hidden rounded-full border border-neutral-200 shadow-sm">
                    <Image
                      src={logoUrl}
                      alt={`${headerTitle} logo`}
                      fill
                      sizes="64px"
                      className="rounded-full object-cover"
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
        {restaurantId ? (
          <div
            style={{ transform: `scale(${cartScale})`, transformOrigin: 'right center' }}
            className="hidden md:block"
          >
            <KioskActionButton
              href={`/kiosk/${restaurantId}/cart`}
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
    logoUrl,
    registerActivity,
    restaurantId,
    showBrandSkeleton,
  ]);

  const handleFullscreenPromptClick = useCallback(async () => {
    await Promise.allSettled([attemptFullscreen({ allowModal: true }), requestWakeLock()]);
  }, [attemptFullscreen, requestWakeLock]);

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
              height: 48,
              opacity: fadeOverlayOpacity,
              transition: 'opacity 150ms linear',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 28%, rgba(255,255,255,0.85) 56%, rgba(255,255,255,0) 100%)',
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
          fadingOut={homeFading}
          loading={restaurantLoading}
        />
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
            <KioskActionButton onClick={handleFullscreenPromptClick} className="mt-6 w-full justify-center text-base">
              Enter fullscreen
            </KioskActionButton>
          </div>
        </div>
      ) : null}
      {showIdleModal ? (
        <div className="IdleOverlay">
          <div className="IdleModalCard">
            <h2 className="IdleTitle">Still there?</h2>
            <p className="IdleSubtitle">{idleMessage}</p>

            <div className="IdleCountdownWrapper">
              <div className="IdleCountdownNumber" key={idleCountdown} style={{ color: countdownColor }}>
                {idleCountdown}
              </div>
              <div className="IdleCountdownText">Resetting in {idleCountdown} seconds...</div>
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
      {restaurantId ? (
        <div className="fixed bottom-4 right-4 z-40 flex items-center justify-end md:hidden">
          <KioskActionButton
            href={`/kiosk/${restaurantId}/cart`}
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
