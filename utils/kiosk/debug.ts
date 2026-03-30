export type KioskDebugState = {
  route?: string;
  pathname?: string;
  resolvedRestaurantId?: string | null;
  homeSeen?: boolean;
  sessionActive?: boolean;
  homeVisible?: boolean;
  contentVisible?: boolean;
  lastNavigationTarget?: string | null;
  navigationStatus?: 'idle' | 'start' | 'complete' | 'error';
  menuMounted?: boolean;
  menuBlockedBySession?: boolean;
  menuBlockedReason?: string | null;
  lastEvent?: string;
  lastUpdatedAt?: string;
};

type KioskDebugPatch = Partial<KioskDebugState>;

declare global {
  interface Window {
    __ORDERFAST_KIOSK_DEBUG__?: KioskDebugState;
  }
}

const EVENT_NAME = 'orderfast:kiosk-debug';

export function getKioskDebugState(): KioskDebugState {
  if (typeof window === 'undefined') return {};
  return window.__ORDERFAST_KIOSK_DEBUG__ || {};
}

export function patchKioskDebugState(patch: KioskDebugPatch, lastEvent?: string) {
  if (typeof window === 'undefined') return;

  const nextState: KioskDebugState = {
    ...getKioskDebugState(),
    ...patch,
    ...(lastEvent ? { lastEvent } : {}),
    lastUpdatedAt: new Date().toISOString(),
  };

  window.__ORDERFAST_KIOSK_DEBUG__ = nextState;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextState }));
}

export function subscribeKioskDebugState(listener: (state: KioskDebugState) => void) {
  if (typeof window === 'undefined') return () => undefined;

  const wrapped = (event: Event) => {
    const customEvent = event as CustomEvent<KioskDebugState>;
    listener(customEvent.detail || getKioskDebugState());
  };

  window.addEventListener(EVENT_NAME, wrapped as EventListener);
  return () => {
    window.removeEventListener(EVENT_NAME, wrapped as EventListener);
  };
}
