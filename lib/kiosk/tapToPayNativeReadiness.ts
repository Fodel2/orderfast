import { runTapToPaySetupBootstrap, TapToPaySetupState } from '@/lib/kiosk/tapToPaySetupBootstrap';

export type NativeTapToPayReadiness = {
  ready: boolean;
  supported: boolean;
  state: TapToPaySetupState;
  reason: string;
  permissionState: string | null;
  permissionStateBeforeRequest: string | null;
  permissionRequestAttempted: boolean;
  locationServicesEnabled: boolean | null;
  nativeStage: string | null;
};

export const resolveNativeTapToPayReadiness = async (options?: {
  promptIfNeeded?: boolean;
}): Promise<NativeTapToPayReadiness> => {
  const setup = await runTapToPaySetupBootstrap({ promptIfNeeded: options?.promptIfNeeded ?? true });

  return {
    ready: setup.ready,
    supported: setup.supported,
    state: setup.state,
    reason: setup.reason,
    permissionState: setup.permissionState,
    permissionStateBeforeRequest: setup.permissionStateBeforeRequest,
    permissionRequestAttempted: setup.permissionRequestAttempted,
    locationServicesEnabled: setup.locationServicesEnabled,
    nativeStage: setup.nativeStage,
  };
};
