import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

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
  title?: string;
  subtitle?: string;
  backHref?: string;
  action?: ReactNode;
  children: ReactNode;
};

export default function KioskLayout({
  title,
  subtitle,
  backHref,
  action,
  children,
}: KioskLayoutProps) {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const requestedRef = useRef(false);
  const hasRequestedFullscreen = useRef(false);
  const autoPromptedRef = useRef(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  const headerContent = useMemo(() => {
    if (!title && !subtitle && !backHref && !action) return null;

    return (
      <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/40 px-6 py-4 text-white">
        <div className="flex items-center gap-4">
          {backHref ? (
            <Link
              href={backHref}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold tracking-wide transition hover:bg-white/20"
            >
              Back
            </Link>
          ) : null}
          <div>
            {title ? <h1 className="text-lg font-semibold tracking-wide sm:text-xl">{title}</h1> : null}
            {subtitle ? (
              <p className="text-sm font-medium text-white/70 sm:text-base">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
    );
  }, [action, backHref, subtitle, title]);

  const attemptFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) return;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (!el) return;
    if (hasRequestedFullscreen.current) return;
    hasRequestedFullscreen.current = true;
    try {
      const request = el.requestFullscreen?.bind(el) || el.webkitRequestFullscreen?.bind(el);
      if (request) {
        await request();
      } else {
        hasRequestedFullscreen.current = false;
      }
    } catch (err) {
      hasRequestedFullscreen.current = false;
      console.debug('[kiosk] fullscreen request failed', err);
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
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    html.classList.add('kiosk-mode');
    body.classList.add('kiosk-mode');

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overscrollBehavior = previousBodyOverscroll;
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

    const media = window.matchMedia?.('(display-mode: standalone)');

    evaluateDisplayMode();
    attemptFullscreen();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    media?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      media?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, [attemptFullscreen, isInstalled]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      if (typeof deferredPrompt.prompt === 'function') {
        await deferredPrompt.prompt();
      }
      const choice = deferredPrompt.userChoice ? await deferredPrompt.userChoice.catch(() => null) : null;
      if (choice && choice.outcome === 'accepted') {
        setIsInstalled(true);
        await attemptFullscreen();
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
          await attemptFullscreen();
        }
      } catch (err) {
        console.debug('[kiosk] auto install prompt blocked', err);
      }
    };

    attemptAutoPrompt();
  }, [attemptFullscreen, deferredPrompt, installDismissed, isInstalled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const requestWakeLock = async () => {
      try {
        const nav = navigator as WakeLockNavigator;
        if (!nav.wakeLock?.request) return;
        const sentinel: WakeLockSentinel | null = await nav.wakeLock.request('screen');
        if (sentinel) {
          setWakeLock(sentinel);
        }
      } catch (err) {
        console.debug('[kiosk] wake lock unavailable', err);
      }
    };

    const handleInteraction = async () => {
      if (requestedRef.current) return;
      requestedRef.current = true;
      await Promise.allSettled([attemptFullscreen(), requestWakeLock()]);
    };

    attemptFullscreen();
    requestWakeLock();

    window.addEventListener('pointerdown', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [attemptFullscreen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!wakeLock) return;

    const handleVisibility = async () => {
      try {
        if (document.visibilityState === 'visible') {
          const nav = navigator as WakeLockNavigator;
          if (!nav.wakeLock?.request) return;
          const renewed: WakeLockSentinel | null = await nav.wakeLock.request('screen');
          if (renewed) setWakeLock(renewed);
        }
      } catch (err) {
        console.debug('[kiosk] wake lock renewal failed', err);
      }
    };

    const handleRelease = async () => {
      try {
        const nav = navigator as WakeLockNavigator;
        if (!nav.wakeLock?.request) return;
        const renewed: WakeLockSentinel | null = await nav.wakeLock.request('screen');
        if (renewed) setWakeLock(renewed);
      } catch (err) {
        console.debug('[kiosk] wake lock re-acquire failed', err);
      }
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
  }, [wakeLock]);

  return (
    <div className="min-h-screen w-full overflow-hidden bg-slate-100 text-slate-900">
      <main className="flex min-h-screen flex-col overflow-hidden">
        {headerContent}
        <div className="flex-1 overflow-auto px-4 py-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-none flex-col gap-8">
            {children}
          </div>
        </div>
      </main>
      {deferredPrompt && !isInstalled && !installDismissed ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={handleInstallClick}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-200/70 backdrop-blur transition hover:bg-white"
          >
            Install App
          </button>
        </div>
      ) : null}
    </div>
  );
}
