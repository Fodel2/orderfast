import { ORDER_ALERT_AUDIO } from '@/audio/orderAlertBase64';

type AudioContextConstructor = typeof AudioContext;

export type AlarmSource = 'Orders' | 'KOD';

type BeepOptions = {
  count?: number;
  intervalMs?: number;
  onComplete?: (wasLooping: boolean) => void;
};

const isDev = process.env.NODE_ENV !== 'production';

let audioContext: AudioContext | null = null;
let alertAudio: HTMLAudioElement | null = null;
let isPlaying = false;
let loopOwner: AlarmSource | null = null;
const timerHandles = new Set<number>();

const log = (action: 'play' | 'stop', source: AlarmSource) => {
  if (!isDev) return;
  console.log(`[alarm] ${action}`, { source, loopOwner, isPlaying });
};

const getAudio = () => {
  if (!alertAudio) {
    alertAudio = new Audio(ORDER_ALERT_AUDIO);
    alertAudio.loop = true;
  }
  return alertAudio;
};

const clearTimers = () => {
  timerHandles.forEach((handle) => window.clearTimeout(handle));
  timerHandles.clear();
};

const resetAudio = () => {
  if (!alertAudio) return;
  alertAudio.pause();
  alertAudio.currentTime = 0;
};

const ensureAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = (window.AudioContext ||
    (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext) as
    | AudioContextConstructor
    | undefined;

  if (!AudioContextCtor) return null;

  try {
    if (!audioContext) {
      audioContext = new AudioContextCtor();
    }
    return audioContext;
  } catch (error) {
    if (isDev) {
      console.debug('[alarm] unable to initialize audio context', error);
    }
    return null;
  }
};

const resumeAudioContext = async () => {
  const context = ensureAudioContext();
  if (!context) return null;
  if (context.state === 'suspended') {
    await context.resume();
  }
  return context;
};

const stop = (source: AlarmSource) => {
  clearTimers();
  resetAudio();
  isPlaying = false;
  loopOwner = null;
  log('stop', source);
};

const playLoop = async (source: AlarmSource) => {
  if (typeof window === 'undefined') return false;
  const audio = getAudio();
  clearTimers();

  if (isPlaying) {
    if (loopOwner === source) {
      return true;
    }
    stop(source);
  } else {
    resetAudio();
  }

  audio.loop = true;
  try {
    await audio.play();
    isPlaying = true;
    loopOwner = source;
    log('play', source);
    return true;
  } catch (error) {
    if (isDev) {
      console.error('[alarm] audio playback failed', error);
    }
    isPlaying = false;
    loopOwner = null;
    return false;
  }
};

const playBeeps = (source: AlarmSource, options: BeepOptions = {}) => {
  if (typeof window === 'undefined') return;
  const { count = 5, intervalMs = 1000, onComplete } = options;
  const audio = getAudio();
  const wasLooping = isPlaying;

  if (wasLooping) {
    stop(source);
  } else {
    clearTimers();
    resetAudio();
  }

  audio.loop = false;

  const playOnce = () => {
    try {
      audio.pause();
      audio.currentTime = 0;
      void audio.play();
    } catch (error) {
      if (isDev) {
        console.error('[alarm] beep playback failed', error);
      }
    }
  };

  playOnce();
  for (let i = 1; i < count; i += 1) {
    const handle = window.setTimeout(playOnce, i * intervalMs);
    timerHandles.add(handle);
  }

  const doneHandle = window.setTimeout(() => {
    timerHandles.delete(doneHandle);
    onComplete?.(wasLooping);
  }, count * intervalMs);
  timerHandles.add(doneHandle);
};

export const orderAlertSoundController = {
  ensureAudioContext,
  resumeAudioContext,
  playLoop,
  playBeeps,
  stop,
};
