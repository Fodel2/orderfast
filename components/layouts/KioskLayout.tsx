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

export const FULL_HEADER_HEIGHT = 148;
export const COLLAPSED_HEADER_HEIGHT = 92;
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
  cartCount?: number;
  children: ReactNode;
  forceHome?: boolean;
  categoryBar?: ReactNode;
  customHeaderContent?: ReactNode;
};

export default function KioskLayout({
  restaurantId,
  restaurant,
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
  const [shrinkProgress, setShrinkProgress] = useState(0);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const autoPromptedRef = useRef(false);
  const fullscreenRequestInFlight = useRef(false);
  const accentColor = useMemo(() => restaurant?.theme_primary_color || '#111827', [restaurant?.theme_primary_color]);
  const {
    setSessionActive,
    registerActivity,
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
    registerActivity();
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
  }, [attemptFullscreen, menuPath, registerActivity, requestWakeLock, restaurantId, router]);

  const headerTitle = restaurant?.name || 'Restaurant';
  const subtitle = restaurant?.website_description;
  const logoUrl = restaurant?.logo_url || null;

  const hasCustomHeader = Boolean(customHeaderContent);
  const expandedHeaderHeight = hasCustomHeader ? 116 : FULL_HEADER_HEIGHT;
  const collapsedHeaderHeight = hasCustomHeader ? 86 : COLLAPSED_HEADER_HEIGHT;
  const headerHeight =
    expandedHeaderHeight - (expandedHeaderHeight - collapsedHeaderHeight) * shrinkProgress;
  const categoryHeight = FULL_CAT_HEIGHT - (FULL_CAT_HEIGHT - COLLAPSED_CAT_HEIGHT) * shrinkProgress;
  const headerPaddingY =
    (hasCustomHeader ? 14 : 20) - ((hasCustomHeader ? 14 : 20) - (hasCustomHeader ? 9 : 12)) * shrinkProgress;
  const brandScale = 1 - shrinkProgress * 0.08;
  const cartScale = 1 - shrinkProgress * 0.08;
  const subtitleOpacity = Math.max(0, 1 - shrinkProgress * 0.6);
  const categoriesScale = 1 - shrinkProgress * 0.06;
  const showHeader = !homeVisible;
  const showCategoryBar = showHeader && Boolean(categoryBar);
  const headerContent = useMemo(() => {
    if (customHeaderContent) return customHeaderContent;
    return (
      <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-between px-4 sm:px-6" style={{ gap: '1rem' }}>
        <div
          className="flex items-center gap-3"
          style={{ transform: `scale(${brandScale})`, transformOrigin: 'left top' }}
        >
          {logoUrl ? (
            <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-full md:flex">
              <div className="relative h-11 w-11 overflow-hidden rounded-full">
                <Image
                  src={logoUrl}
                  alt={`${headerTitle} logo`}
                  fill
                  sizes="44px"
                  className="rounded-full object-cover"
                />
              </div>
            </div>
          ) : null}
          <div className="flex flex-col">
            <span className="text-2xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-3xl">
              {headerTitle}
            </span>
            {subtitle ? (
              <span
                className="mt-2 text-sm text-neutral-600 sm:text-base"
                style={{ opacity: subtitleOpacity }}
              >
                {subtitle}
              </span>
            ) : null}
          </div>
        </div>
        {restaurantId ? (
          <div style={{ transform: `scale(${cartScale})`, transformOrigin: 'right center' }}>
            <KioskActionButton
              href={`/kiosk/${restaurantId}/cart`}
              onClick={registerActivity}
              className="px-4 py-2 text-sm font-semibold sm:px-5 sm:py-3"
            >
              <ShoppingCartIcon className="h-5 w-5" />
              View cart ({cartCount})
            </KioskActionButton>
          </div>
        ) : null}
      </div>
    );
  }, [brandScale, cartCount, cartScale, customHeaderContent, headerTitle, logoUrl, restaurantId, subtitle, subtitleOpacity]);

  const handleFullscreenPromptClick = useCallback(async () => {
    await Promise.allSettled([attemptFullscreen({ allowModal: true }), requestWakeLock()]);
  }, [attemptFullscreen, requestWakeLock]);

  return (
    <div className="min-h-screen w-full bg-white text-neutral-900" style={layoutStyle}>
      {showHeader ? (
        <div
          id="kiosk-header-stack"
          className="fixed top-0 left-0 right-0 z-50 bg-white"
          style={{ willChange: 'transform' }}
        >
          <header
            id="kioskHeader"
            className="w-full bg-white text-neutral-900"
            style={{ height: headerHeight, paddingTop: headerPaddingY, paddingBottom: headerPaddingY }}
          >
            {headerContent}
          </header>
          {showCategoryBar ? (
            <div
              className="bg-white"
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
        <div className="mx-auto w-full max-w-none px-4 pb-10 sm:px-8">{contentVisible ? children : null}</div>
      </main>
      {homeVisible ? <HomeScreen restaurant={restaurant || null} onStart={startOrdering} fadingOut={homeFading} /> : null}
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
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          style={idleOverlayStyle}
        >
          <div
            className="flex w-full max-w-xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-900/25"
            style={idleCardStyle}
          >
            <div className="modalContent flex-1 overflow-y-auto overscroll-contain px-6 py-7 sm:px-8 sm:py-9">
              <div className="flex h-full flex-col gap-6 text-center text-neutral-900">
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold sm:text-3xl">Still there?</h3>
                  <p className="text-base leading-relaxed text-neutral-600 sm:text-lg">{idleMessage}</p>
                </div>
                <div className="flex flex-col items-center gap-2 pt-1">
                  <span className="text-6xl font-extrabold leading-none sm:text-7xl">{idleCountdown}</span>
                  <p className="text-sm text-neutral-500 sm:text-base">Resetting in {idleCountdown} seconds…</p>
                </div>
                <div className="mt-auto grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleIdleStay}
                    className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-3 text-base font-semibold text-neutral-800 transition hover:bg-neutral-50"
                  >
                    I’m still here
                  </button>
                  <button
                    type="button"
                    onClick={handleIdleTimeout}
                    className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-3 text-base font-semibold uppercase tracking-wide text-white shadow-lg shadow-rose-900/20 transition hover:bg-rose-700 active:translate-y-px"
                  >
                    Start over
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
