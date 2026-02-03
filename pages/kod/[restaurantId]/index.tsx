import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import FullscreenAppLayout from '@/components/layouts/FullscreenAppLayout';

type AudioContextConstructor = typeof AudioContext;

export default function KitchenDisplayPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const audioContextRef = useRef<AudioContext | null>(null);

  const preferenceKey = useMemo(
    () => (restaurantId ? `kod_audio_enabled_${restaurantId}` : 'kod_audio_enabled'),
    [restaurantId]
  );
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(preferenceKey);
    setSoundEnabled(stored === 'true');
  }, [preferenceKey]);

  const handleEnableSound = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const AudioContextCtor = (window.AudioContext ||
      (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext) as
      | AudioContextConstructor
      | undefined;

    if (AudioContextCtor) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextCtor();
        }
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } catch (err) {
        console.debug('[kod] unable to initialize audio context', err);
      }
    }

    window.localStorage.setItem(preferenceKey, 'true');
    setSoundEnabled(true);
  }, [preferenceKey]);

  return (
    <FullscreenAppLayout
      promptTitle="Tap to enter fullscreen"
      promptDescription="Kitchen Display works best in fullscreen mode."
    >
      <div className="min-h-screen w-full bg-neutral-950 text-white">
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
          <div className="space-y-4">
            <p className="text-3xl font-semibold tracking-tight sm:text-5xl">
              Kitchen Display – Waiting for orders
            </p>
            <p className="text-base text-neutral-300 sm:text-lg">
              This screen stays ready for incoming kitchen tickets.
            </p>
          </div>
          <button
            type="button"
            onClick={handleEnableSound}
            className="rounded-full border border-white/40 bg-white/10 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-white/20"
          >
            {soundEnabled ? 'Sound enabled' : 'Tap to enable sound'}
          </button>
          {!soundEnabled ? (
            <p className="text-sm text-neutral-400">
              Sound must be enabled to play alerts once orders start flowing.
            </p>
          ) : null}
        </div>
      </div>
    </FullscreenAppLayout>
  );
}
