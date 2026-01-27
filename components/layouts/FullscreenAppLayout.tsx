import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import KioskActionButton from '@/components/kiosk/KioskActionButton';

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

type FullscreenAppLayoutProps = {
  children: ReactNode;
  promptTitle?: string;
  promptDescription?: string;
};

export default function FullscreenAppLayout({
  children,
  promptTitle = 'Tap to enter fullscreen',
  promptDescription = 'Tap below to stay fully immersed in the POS experience.',
}: FullscreenAppLayoutProps) {
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const fullscreenRequestInFlight = useRef(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

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
        console.debug('[pos] fullscreen request failed', err);
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
      console.debug('[pos] wake lock unavailable', err);
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

    const handleFullscreenChange = () => {
      if (isFullscreenActive()) {
        setShowFullscreenPrompt(false);
        return;
      }
      setTimeout(() => {
        attemptFullscreen({ allowModal: true });
      }, 150);
    };

    attemptFullscreen({ allowModal: true });

    window.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('webkitfullscreenchange', handleFullscreenChange as any);

    return () => {
      window.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('webkitfullscreenchange', handleFullscreenChange as any);
    };
  }, [attemptFullscreen, isFullscreenActive]);

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
        console.debug('[pos] wake lock renewal failed', err);
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

  const handleFullscreenPromptClick = useCallback(async () => {
    await Promise.allSettled([attemptFullscreen({ allowModal: true }), requestWakeLock()]);
  }, [attemptFullscreen, requestWakeLock]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#fafafa] via-white to-white text-neutral-900">
      {children}
      {showFullscreenPrompt ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 px-6 text-center">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl shadow-black/10">
            <p className="text-lg font-semibold text-neutral-900">{promptTitle}</p>
            <p className="mt-2 text-sm text-neutral-600">{promptDescription}</p>
            <KioskActionButton onClick={handleFullscreenPromptClick} className="mt-6 w-full justify-center text-base">
              Enter fullscreen
            </KioskActionButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
