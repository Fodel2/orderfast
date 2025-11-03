import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';

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

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

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

    const requestFullscreen = async () => {
      try {
        if (document.fullscreenElement || !document.documentElement?.requestFullscreen) return;
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.debug('[kiosk] fullscreen rejected', err);
      }
    };

    const handleInteraction = async () => {
      if (requestedRef.current) return;
      requestedRef.current = true;
      await Promise.allSettled([requestFullscreen(), requestWakeLock()]);
    };

    window.addEventListener('pointerdown', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

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

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      try {
        if (!wakeLock.released) {
          wakeLock.release().catch(() => undefined);
        }
      } catch {
        // ignore
      }
    };
  }, [wakeLock]);

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

  return (
    <div className="min-h-screen w-full bg-slate-900 text-white">
      <main className="flex min-h-screen flex-col">
        {headerContent}
        <div className="flex-1 overflow-auto px-4 py-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-none flex-col gap-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
