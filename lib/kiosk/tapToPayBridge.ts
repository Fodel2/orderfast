import { registerPlugin } from '@capacitor/core';

export type TapToPayStatus =
  | 'idle'
  | 'preparing'
  | 'ready'
  | 'collecting'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'unavailable';

export type TapToPayErrorCode =
  | 'unsupported_device'
  | 'unsupported'
  | 'permission_required'
  | 'readiness_false'
  | 'network_error'
  | 'session_error'
  | 'native_busy'
  | 'canceled'
  | 'processing_error'
  | 'unknown_error';

export type TapToPayResult = {
  status: TapToPayStatus;
  code?: TapToPayErrorCode;
  message?: string;
  sessionId?: string;
  detail?: unknown;
  nativeStage?: string;
};

export interface TapToPayPlugin {
  isTapToPaySupported(): Promise<{
    supported: boolean;
    reason?: string;
    permissionState?: string;
    locationServicesEnabled?: boolean;
    nativeStage?: string;
  }>;
  ensureTapToPaySetup(options?: { promptIfNeeded?: boolean }): Promise<{
    ready: boolean;
    supported: boolean;
    reason?: string;
    permissionState?: string;
    locationServicesEnabled?: boolean;
    nativeStage?: string;
  }>;
  prepareTapToPay(options: { restaurantId: string; sessionId: string; backendBaseUrl: string; terminalLocationId: string }): Promise<TapToPayResult>;
  startTapToPayPayment(options: { restaurantId: string; sessionId: string; backendBaseUrl: string; terminalLocationId: string }): Promise<TapToPayResult>;
  cancelTapToPayPayment(): Promise<TapToPayResult>;
  getTapToPayStatus(): Promise<TapToPayResult>;
  lockPaymentOrientationToPortrait(): Promise<{ locked: boolean; reason?: string }>;
  unlockPaymentOrientation(): Promise<{ unlocked: boolean; reason?: string }>;
}

const TapToPayNative = registerPlugin<TapToPayPlugin>('OrderfastTapToPay');

const normalizeTapToPayResult = (result: TapToPayResult): TapToPayResult => {
  if (result.code === 'unsupported_device') {
    return result;
  }

  if (result.code === 'unsupported' && result.detail && typeof result.detail === 'object') {
    const terminalCode = (result.detail as { terminalCode?: unknown }).terminalCode;
    if (terminalCode === 'TAP_TO_PAY_UNSUPPORTED_DEVICE') {
      return {
        ...result,
        code: 'unsupported_device',
      };
    }
  }

  return result;
};

const readErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown native bridge error';
    }
  }
  return 'Unknown native bridge error';
};

const webUnavailable = async (): Promise<TapToPayResult> => ({
  status: 'unavailable',
  code: 'unsupported',
  message: 'Tap to Pay is only available in the Orderfast Android kiosk app.',
  detail: { nativeStage: 'bridge', reason: 'not_native_platform' },
  nativeStage: 'bridge',
});

export const tapToPayBridge: TapToPayPlugin = {
  async isTapToPaySupported() {
    try {
      return await TapToPayNative.isTapToPaySupported();
    } catch (error) {
      return {
        supported: false,
        reason: `Tap to Pay native bridge unavailable: ${readErrorMessage(error)}`,
        nativeStage: 'bridge',
      };
    }
  },
  async prepareTapToPay(options) {
    try {
      return normalizeTapToPayResult(await TapToPayNative.prepareTapToPay(options));
    } catch (error) {
      return {
        status: 'unavailable',
        code: 'unsupported',
        message: `Tap to Pay native bridge unavailable: ${readErrorMessage(error)}`,
        detail: { nativeStage: 'bridge', reason: 'prepare_bridge_unavailable' },
        nativeStage: 'bridge',
      };
    }
  },
  async ensureTapToPaySetup(options) {
    try {
      return await TapToPayNative.ensureTapToPaySetup(options ?? {});
    } catch (error) {
      return {
        ready: false,
        supported: false,
        reason: `Tap to Pay native bridge unavailable: ${readErrorMessage(error)}`,
        nativeStage: 'bridge',
      };
    }
  },
  async startTapToPayPayment(options) {
    try {
      return normalizeTapToPayResult(await TapToPayNative.startTapToPayPayment(options));
    } catch (error) {
      return {
        status: 'unavailable',
        code: 'unsupported',
        message: `Tap to Pay native bridge unavailable: ${readErrorMessage(error)}`,
        detail: { nativeStage: 'bridge', reason: 'start_bridge_unavailable' },
        nativeStage: 'bridge',
      };
    }
  },
  async cancelTapToPayPayment() {
    try {
      return await TapToPayNative.cancelTapToPayPayment();
    } catch {
      return webUnavailable();
    }
  },
  async getTapToPayStatus() {
    try {
      return await TapToPayNative.getTapToPayStatus();
    } catch (error) {
      return {
        status: 'unavailable',
        code: 'unsupported',
        message: `Tap to Pay native bridge unavailable: ${readErrorMessage(error)}`,
        detail: { nativeStage: 'bridge', reason: 'status_bridge_unavailable' },
        nativeStage: 'bridge',
      };
    }
  },
  async lockPaymentOrientationToPortrait() {
    try {
      return await TapToPayNative.lockPaymentOrientationToPortrait();
    } catch (error) {
      return {
        locked: false,
        reason: `Orientation lock unavailable: ${readErrorMessage(error)}`,
      };
    }
  },
  async unlockPaymentOrientation() {
    try {
      return await TapToPayNative.unlockPaymentOrientation();
    } catch (error) {
      return {
        unlocked: false,
        reason: `Orientation unlock unavailable: ${readErrorMessage(error)}`,
      };
    }
  },
};
