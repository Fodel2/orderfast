import { tapToPayBridge } from '@/lib/kiosk/tapToPayBridge';

export type AppFlowState =
  | 'bootstrapping'
  | 'requesting_permissions'
  | 'permissions_ready'
  | 'permission_denied'
  | 'location_services_disabled'
  | 'unsupported_device'
  | 'setup_failed'
  | 'ready'
  | 'preparing'
  | 'collecting'
  | 'processing'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'interrupted';

export type LauncherBootstrapSnapshot = {
  state: AppFlowState;
  ready: boolean;
  reason: string;
  supported: boolean;
  permissionState: string | null;
  permissionStateBeforeRequest: string | null;
  permissionRequestAttempted: boolean;
  locationServicesEnabled: boolean | null;
  nativeStage: string | null;
  updatedAt: string;
  restaurantId: string | null;
};

const STORAGE_KEY = 'orderfast_launcher_bootstrap_snapshot_v1';

const nowIso = () => new Date().toISOString();

const normalizePermissionState = (value: string | null | undefined) => {
  if (!value) return null;
  return value.toLowerCase();
};

const buildSnapshot = (partial: Omit<LauncherBootstrapSnapshot, 'updatedAt'>): LauncherBootstrapSnapshot => ({
  ...partial,
  updatedAt: nowIso(),
});

export const createDefaultBootstrapSnapshot = (restaurantId: string | null): LauncherBootstrapSnapshot =>
  buildSnapshot({
    state: 'bootstrapping',
    ready: false,
    reason: 'Launcher bootstrap has not completed yet.',
    supported: true,
    permissionState: null,
    permissionStateBeforeRequest: null,
    permissionRequestAttempted: false,
    locationServicesEnabled: null,
    nativeStage: null,
    restaurantId,
  });

export const persistLauncherBootstrapSnapshot = (snapshot: LauncherBootstrapSnapshot) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
};

export const readLauncherBootstrapSnapshot = (): LauncherBootstrapSnapshot | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LauncherBootstrapSnapshot;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.state !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
};

const deriveFinalState = (payload: {
  supported: boolean;
  permissionState: string | null;
  locationServicesEnabled: boolean | null;
  ready: boolean;
}): AppFlowState => {
  if (!payload.supported) return 'unsupported_device';
  if (payload.permissionState === 'denied') return 'permission_denied';
  if (payload.permissionState !== 'granted') return 'setup_failed';
  if (payload.locationServicesEnabled === false) return 'location_services_disabled';
  if (payload.ready) return 'ready';
  return 'permissions_ready';
};

export const runLauncherBootstrap = async (options: {
  restaurantId: string | null;
  promptIfNeeded: boolean;
}): Promise<LauncherBootstrapSnapshot> => {
  const startSnapshot = createDefaultBootstrapSnapshot(options.restaurantId);
  persistLauncherBootstrapSnapshot(startSnapshot);

  console.info('[launcher-bootstrap]', {
    event: 'launcher_bootstrap_start',
    restaurantId: options.restaurantId,
    promptIfNeeded: options.promptIfNeeded,
  });

  try {
    const supportCheck = await tapToPayBridge.isTapToPaySupported();
    const permissionBeforeRes = await tapToPayBridge.getLocationPermissionState();
    const permissionStateBeforeRequest = normalizePermissionState(permissionBeforeRes.permissionState ?? supportCheck.permissionState);

    console.info('[launcher-bootstrap]', {
      event: 'all_permission_states_before_request',
      permissionStateBeforeRequest,
      supportCheck,
    });

    let permissionState = permissionStateBeforeRequest;
    let permissionRequestAttempted = false;
    let requestNativeStage: string | null = null;

    if (options.promptIfNeeded && permissionStateBeforeRequest !== 'granted') {
      permissionRequestAttempted = true;
      persistLauncherBootstrapSnapshot(
        buildSnapshot({
          ...startSnapshot,
          state: 'requesting_permissions',
          reason: 'Requesting required runtime permissions.',
          permissionState: permissionStateBeforeRequest,
          permissionStateBeforeRequest,
          permissionRequestAttempted: true,
          nativeStage: supportCheck.nativeStage || null,
        })
      );

      console.info('[launcher-bootstrap]', {
        event: 'permission_request_attempted',
        permission: 'location',
      });

      const requested = await tapToPayBridge.requestLocationPermission();
      permissionState = normalizePermissionState(requested.permissionState) ?? permissionState;
      requestNativeStage = requested.nativeStage || null;

      console.info('[launcher-bootstrap]', {
        event: 'permission_request_result',
        permission: 'location',
        granted: requested.granted,
        permissionState,
        reason: requested.reason || null,
      });
    }

    const locationCheck = await tapToPayBridge.getLocationServicesStatus();
    const readiness = await tapToPayBridge.checkTapToPayReadiness();

    const locationServicesEnabled = readiness.locationServicesEnabled ?? locationCheck.enabled ?? supportCheck.locationServicesEnabled ?? null;
    const supported = readiness.supported === true;
    const ready = readiness.ready === true;
    const finalState = deriveFinalState({
      supported,
      permissionState,
      locationServicesEnabled,
      ready,
    });

    console.info('[launcher-bootstrap]', {
      event: 'device_service_checks_result',
      locationServicesEnabled,
      supported,
      ready,
      readinessReason: readiness.reason || null,
    });

    const finalSnapshot = buildSnapshot({
      state: finalState,
      ready: finalState === 'ready',
      reason: readiness.reason || 'Launcher bootstrap did not complete successfully.',
      supported,
      permissionState,
      permissionStateBeforeRequest,
      permissionRequestAttempted,
      locationServicesEnabled,
      nativeStage: readiness.nativeStage || requestNativeStage || locationCheck.nativeStage || supportCheck.nativeStage || null,
      restaurantId: options.restaurantId,
    });

    persistLauncherBootstrapSnapshot(finalSnapshot);
    console.info('[launcher-bootstrap]', {
      event: 'normalized_readiness_snapshot_written',
      snapshot: finalSnapshot,
    });
    return finalSnapshot;
  } catch (error: any) {
    const failedSnapshot = buildSnapshot({
      state: 'setup_failed',
      ready: false,
      reason: error?.message || 'Launcher bootstrap failed.',
      supported: false,
      permissionState: null,
      permissionStateBeforeRequest: null,
      permissionRequestAttempted: false,
      locationServicesEnabled: null,
      nativeStage: 'launcher_bootstrap_exception',
      restaurantId: options.restaurantId,
    });
    persistLauncherBootstrapSnapshot(failedSnapshot);
    console.info('[launcher-bootstrap]', {
      event: 'normalized_readiness_snapshot_written',
      snapshot: failedSnapshot,
    });
    return failedSnapshot;
  }
};
