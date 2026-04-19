import { useCallback, useEffect, useState } from 'react';
import { runTapToPaySetupBootstrap } from '@/lib/kiosk/tapToPaySetupBootstrap';

export const TAP_TO_PAY_SETUP_STORAGE_KEY = 'orderfast_kiosk_tap_to_pay_setup_ready';

export type TapToPayBootstrapState =
  | 'idle'
  | 'requesting_permissions'
  | 'nfc_disabled'
  | 'permission_not_requested'
  | 'permission_denied'
  | 'location_services_disabled'
  | 'ready'
  | 'unsupported_device'
  | 'error'
  | 'skipped';

export type TapToPayBootstrapSnapshot = {
  state: TapToPayBootstrapState;
  supported: boolean;
  ready: boolean;
  permissionState: string | null;
  permissionStateBeforeRequest: string | null;
  permissionRequestAttempted: boolean;
  locationServicesEnabled: boolean | null;
  reason: string | null;
  checkedAt: string | null;
  nativeStage: string | null;
};

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
};

const INITIAL_SNAPSHOT: TapToPayBootstrapSnapshot = {
  state: 'idle',
  supported: false,
  ready: false,
  permissionState: null,
  permissionStateBeforeRequest: null,
  permissionRequestAttempted: false,
  locationServicesEnabled: null,
  reason: null,
  checkedAt: null,
  nativeStage: null,
};

const isNativeAndroid = () => {
  if (typeof window === 'undefined') return false;
  const capacitor = (window as CapacitorWindow).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return false;
  return capacitor.getPlatform?.() === 'android';
};

const persistSnapshot = (snapshot: TapToPayBootstrapSnapshot) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TAP_TO_PAY_SETUP_STORAGE_KEY, JSON.stringify(snapshot));
};

export function useTapToPayBootstrap(options?: { enabled?: boolean; promptIfNeeded?: boolean }) {
  const enabled = options?.enabled ?? true;
  const promptIfNeeded = options?.promptIfNeeded ?? true;
  const [snapshot, setSnapshot] = useState<TapToPayBootstrapSnapshot>(INITIAL_SNAPSHOT);
  const [loading, setLoading] = useState(false);

  const runBootstrap = useCallback(async () => {
    if (!enabled) return null;

    if (!isNativeAndroid()) {
      const skippedSnapshot: TapToPayBootstrapSnapshot = {
        ...INITIAL_SNAPSHOT,
        state: 'skipped',
        reason: 'Tap to Pay native bootstrap only runs inside the Android app.',
        checkedAt: new Date().toISOString(),
      };
      setSnapshot(skippedSnapshot);
      setLoading(false);
      return skippedSnapshot;
    }

    setLoading(true);
    setSnapshot((prev) => ({
      ...prev,
      state: 'requesting_permissions',
      reason: 'Checking Tap to Pay device permissions…',
    }));

    try {
      const setup = await runTapToPaySetupBootstrap({ promptIfNeeded });
      const next: TapToPayBootstrapSnapshot = {
        state: setup.state,
        supported: setup.supported,
        ready: setup.ready,
        permissionState: setup.permissionState,
        permissionStateBeforeRequest: setup.permissionStateBeforeRequest,
        permissionRequestAttempted: setup.permissionRequestAttempted,
        locationServicesEnabled: setup.locationServicesEnabled,
        reason: setup.reason || null,
        checkedAt: new Date().toISOString(),
        nativeStage: setup.nativeStage,
      };
      setSnapshot(next);
      persistSnapshot(next);
      return next;
    } catch (error: any) {
      const failed: TapToPayBootstrapSnapshot = {
        ...INITIAL_SNAPSHOT,
        state: 'error',
        reason: error?.message || 'Tap to Pay setup check failed.',
        checkedAt: new Date().toISOString(),
      };
      setSnapshot(failed);
      persistSnapshot(failed);
      return failed;
    } finally {
      setLoading(false);
    }
  }, [enabled, promptIfNeeded]);

  useEffect(() => {
    void runBootstrap();
  }, [runBootstrap]);

  return {
    loading,
    snapshot,
    runBootstrap,
    isNativeAndroid: isNativeAndroid(),
  };
}
