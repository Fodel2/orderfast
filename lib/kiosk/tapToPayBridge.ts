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
  terminalCode?: string;
  stripeTakeoverActive?: boolean;
  appBackgrounded?: boolean;
  definitiveCustomerCancelSignal?: boolean;
  paymentIntentId?: string;
  paymentIntentStatus?: string;
  paymentIntentSource?: string;
};

export interface TapToPayPlugin {
  getLocationPermissionState(): Promise<{ permissionState: string; nativeStage?: string }>;
  requestLocationPermission(): Promise<{ permissionState: string; granted: boolean; nativeStage?: string; reason?: string }>;
  getLocationServicesStatus(): Promise<{ enabled: boolean; nativeStage?: string }>;
  checkTapToPayReadiness(): Promise<{
    ready: boolean;
    supported: boolean;
    reason?: string;
    permissionState?: string;
    nfcEnabled?: boolean;
    locationServicesEnabled?: boolean;
    nativeStage?: string;
  }>;
  isTapToPaySupported(): Promise<{
    supported: boolean;
    reason?: string;
    permissionState?: string;
    nfcEnabled?: boolean;
    locationServicesEnabled?: boolean;
    nativeStage?: string;
  }>;
  ensureTapToPaySetup(options?: { promptIfNeeded?: boolean }): Promise<{
    ready: boolean;
    supported: boolean;
    reason?: string;
    permissionState?: string;
    nfcEnabled?: boolean;
    locationServicesEnabled?: boolean;
    nativeStage?: string;
  }>;
  prepareTapToPay(options: {
    restaurantId: string;
    sessionId: string;
    backendBaseUrl: string;
    terminalLocationId: string;
    flowRunId?: string;
  }): Promise<TapToPayResult>;
  startTapToPayPayment(options: {
    restaurantId: string;
    sessionId: string;
    backendBaseUrl: string;
    terminalLocationId: string;
    flowRunId?: string;
    paymentIntentClientSecret?: string;
    paymentIntentId?: string;
    paymentIntentStatus?: string;
  }): Promise<TapToPayResult>;
  cancelTapToPayPayment(): Promise<TapToPayResult>;
  getTapToPayStatus(): Promise<TapToPayResult>;
  getActivePaymentRunState(): Promise<{
    status: string;
    inFlight: boolean;
    connected: boolean;
    sessionId?: string;
    restaurantId?: string;
    terminalLocationId?: string;
    flowRunId?: string;
    activeRun: boolean;
    stripeTakeoverActive?: boolean;
    appBackgrounded?: boolean;
    cachedFinalResult?: TapToPayResult | null;
  }>;
  lockPaymentOrientationToPortrait(): Promise<{ locked: boolean; reason?: string }>;
  unlockPaymentOrientation(): Promise<{ unlocked: boolean; reason?: string }>;
}

const TapToPayNative = registerPlugin<TapToPayPlugin>('OrderfastTapToPay');

const CANCELED_ALIASES = new Set([
  'canceled',
  'cancelled',
  'canceled_by_user',
  'cancelled_by_user',
  'user_canceled',
  'user_cancelled',
  'payment_canceled',
  'payment_cancelled',
  'cancelled_payment',
  'canceled_payment',
]);

const canonicalize = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const normalizeTapToPayStatus = (status: unknown): TapToPayStatus => {
  const normalized = canonicalize(status);
  if (CANCELED_ALIASES.has(normalized)) return 'canceled';
  if (normalized === 'completed' || normalized === 'success' || normalized === 'succeeded') return 'succeeded';
  if (normalized === 'error') return 'failed';
  if (
    normalized === 'idle' ||
    normalized === 'preparing' ||
    normalized === 'ready' ||
    normalized === 'collecting' ||
    normalized === 'processing' ||
    normalized === 'succeeded' ||
    normalized === 'failed' ||
    normalized === 'canceled' ||
    normalized === 'unavailable'
  ) {
    return normalized;
  }
  return 'failed';
};

const normalizeTapToPayErrorCode = (code: unknown): TapToPayErrorCode | undefined => {
  const normalized = canonicalize(code);
  if (!normalized) return undefined;
  if (CANCELED_ALIASES.has(normalized)) return 'canceled';
  if (
    normalized === 'unsupported_device' ||
    normalized === 'unsupported' ||
    normalized === 'permission_required' ||
    normalized === 'readiness_false' ||
    normalized === 'network_error' ||
    normalized === 'session_error' ||
    normalized === 'native_busy' ||
    normalized === 'canceled' ||
    normalized === 'processing_error' ||
    normalized === 'unknown_error'
  ) {
    return normalized;
  }
  return 'unknown_error';
};

const normalizeTapToPayResult = (result: TapToPayResult): TapToPayResult => {
  const normalizedResult: TapToPayResult = {
    ...result,
    status: normalizeTapToPayStatus(result.status),
    code: normalizeTapToPayErrorCode(result.code),
  };
  if (result.code === 'unsupported_device') {
    return normalizedResult;
  }

  if (normalizedResult.code === 'unsupported' && normalizedResult.detail && typeof normalizedResult.detail === 'object') {
    const terminalCode = (normalizedResult.detail as { terminalCode?: unknown }).terminalCode;
    if (terminalCode === 'TAP_TO_PAY_UNSUPPORTED_DEVICE') {
      return {
        ...normalizedResult,
        code: 'unsupported_device',
      };
    }
  }

  return normalizedResult;
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
  async getLocationPermissionState() {
    try {
      return await TapToPayNative.getLocationPermissionState();
    } catch (error) {
      return {
        permissionState: 'unknown',
        nativeStage: `bridge:getLocationPermissionState:${readErrorMessage(error)}`,
      };
    }
  },
  async requestLocationPermission() {
    try {
      return await TapToPayNative.requestLocationPermission();
    } catch (error) {
      return {
        permissionState: 'unknown',
        granted: false,
        reason: `Tap to Pay native bridge unavailable: ${readErrorMessage(error)}`,
        nativeStage: 'bridge',
      };
    }
  },
  async getLocationServicesStatus() {
    try {
      return await TapToPayNative.getLocationServicesStatus();
    } catch (error) {
      return {
        enabled: false,
        nativeStage: `bridge:getLocationServicesStatus:${readErrorMessage(error)}`,
      };
    }
  },
  async checkTapToPayReadiness() {
    try {
      return await TapToPayNative.checkTapToPayReadiness();
    } catch (error) {
      return {
        ready: false,
        supported: false,
        reason: `Tap to Pay native bridge unavailable: ${readErrorMessage(error)}`,
        nativeStage: 'bridge',
      };
    }
  },
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
      return normalizeTapToPayResult(await TapToPayNative.cancelTapToPayPayment());
    } catch {
      return webUnavailable();
    }
  },
  async getTapToPayStatus() {
    try {
      return normalizeTapToPayResult(await TapToPayNative.getTapToPayStatus());
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

  async getActivePaymentRunState() {
    try {
      return await TapToPayNative.getActivePaymentRunState();
    } catch (error) {
      return {
        status: 'unavailable',
        inFlight: false,
        connected: false,
        activeRun: false,
        cachedFinalResult: null,
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
