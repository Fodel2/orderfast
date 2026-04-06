import { tapToPayBridge } from '@/lib/kiosk/tapToPayBridge';

export type NativeTapToPayReadiness = {
  ready: boolean;
  supported: boolean;
  reason: string;
  permissionState: string | null;
  locationServicesEnabled: boolean | null;
  nativeStage: string | null;
};

export const resolveNativeTapToPayReadiness = async (options?: {
  promptIfNeeded?: boolean;
}): Promise<NativeTapToPayReadiness> => {
  const setup = await tapToPayBridge.ensureTapToPaySetup({ promptIfNeeded: options?.promptIfNeeded ?? true });

  return {
    ready: setup.ready === true,
    supported: setup.supported === true,
    reason: setup.reason || 'Tap to Pay setup is incomplete on this device.',
    permissionState: setup.permissionState || null,
    locationServicesEnabled: setup.locationServicesEnabled ?? null,
    nativeStage: setup.nativeStage || null,
  };
};
