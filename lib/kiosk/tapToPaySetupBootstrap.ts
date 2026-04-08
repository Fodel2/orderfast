import { tapToPayBridge } from '@/lib/kiosk/tapToPayBridge';

export type TapToPaySetupState =
  | 'ready'
  | 'permission_not_requested'
  | 'permission_denied'
  | 'location_services_disabled'
  | 'unsupported_device'
  | 'error';

export type TapToPaySetupBootstrapResult = {
  ready: boolean;
  supported: boolean;
  state: TapToPaySetupState;
  reason: string;
  permissionState: string | null;
  permissionStateBeforeRequest: string | null;
  locationServicesEnabled: boolean | null;
  nativeStage: string | null;
  permissionRequestAttempted: boolean;
};

const normalizePermissionState = (value: string | null | undefined) => {
  if (!value) return null;
  return value.toLowerCase();
};

const deriveState = (payload: {
  ready: boolean;
  supported: boolean;
  permissionState: string | null;
  locationServicesEnabled: boolean | null;
}): TapToPaySetupState => {
  if (!payload.supported) return 'unsupported_device';

  if (payload.permissionState === 'denied') return 'permission_denied';

  if (payload.permissionState !== 'granted') return 'permission_not_requested';

  if (payload.locationServicesEnabled === false) return 'location_services_disabled';

  if (payload.ready) return 'ready';

  return 'error';
};

const deriveReason = (payload: {
  state: TapToPaySetupState;
  permissionRequestAttempted: boolean;
  fallbackReason: string;
}) => {
  if (payload.state === 'permission_not_requested') {
    return payload.permissionRequestAttempted
      ? 'Location permission has not been granted yet.'
      : 'Location permission has not been requested yet.';
  }

  if (payload.state === 'permission_denied') {
    return 'Location permission was denied. Allow location to use Tap to Pay.';
  }

  if (payload.state === 'location_services_disabled') {
    return 'Location services are disabled. Turn on device location to use Tap to Pay.';
  }

  if (payload.state === 'unsupported_device') {
    return payload.fallbackReason || 'This device does not support Tap to Pay.';
  }

  if (payload.state === 'ready') {
    return 'Tap to Pay device prerequisites satisfied.';
  }

  return payload.fallbackReason || 'Tap to Pay setup is incomplete on this device.';
};

export const runTapToPaySetupBootstrap = async (options?: {
  promptIfNeeded?: boolean;
}): Promise<TapToPaySetupBootstrapResult> => {
  const promptIfNeeded = options?.promptIfNeeded ?? true;

  const supportCheck = await tapToPayBridge.isTapToPaySupported();
  const permissionBefore = await tapToPayBridge.getLocationPermissionState();
  const permissionStateBeforeRequest = normalizePermissionState(permissionBefore.permissionState ?? supportCheck.permissionState);

  let permissionState = permissionStateBeforeRequest;
  const shouldRequestPermission = promptIfNeeded && permissionStateBeforeRequest !== 'granted';
  let requestNativeStage: string | null = null;

  if (shouldRequestPermission) {
    const permissionRequest = await tapToPayBridge.requestLocationPermission();
    permissionState = normalizePermissionState(permissionRequest.permissionState) ?? permissionState;
    requestNativeStage = permissionRequest.nativeStage || null;
  }

  const locationCheck = await tapToPayBridge.getLocationServicesStatus();
  const readiness = await tapToPayBridge.checkTapToPayReadiness();

  const locationServicesEnabled = readiness.locationServicesEnabled ?? locationCheck.enabled ?? supportCheck.locationServicesEnabled ?? null;
  const supported = readiness.supported === true;
  const ready = readiness.ready === true;
  const fallbackReason = readiness.reason || supportCheck.reason || 'Tap to Pay setup is incomplete on this device.';
  const state = deriveState({
    ready,
    supported,
    permissionState,
    locationServicesEnabled,
  });

  return {
    ready,
    supported,
    reason: deriveReason({
      state,
      permissionRequestAttempted: shouldRequestPermission,
      fallbackReason,
    }),
    state,
    permissionState,
    permissionStateBeforeRequest,
    locationServicesEnabled,
    nativeStage: readiness.nativeStage || requestNativeStage || locationCheck.nativeStage || supportCheck.nativeStage || null,
    permissionRequestAttempted: shouldRequestPermission,
  };
};
