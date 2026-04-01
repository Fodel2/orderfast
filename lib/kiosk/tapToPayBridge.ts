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
};

export interface TapToPayPlugin {
  isTapToPaySupported(): Promise<{ supported: boolean; reason?: string }>;
  prepareTapToPay(options: { restaurantId: string; sessionId: string; backendBaseUrl: string }): Promise<TapToPayResult>;
  startTapToPayPayment(options: { restaurantId: string; sessionId: string; backendBaseUrl: string }): Promise<TapToPayResult>;
  cancelTapToPayPayment(): Promise<TapToPayResult>;
  getTapToPayStatus(): Promise<TapToPayResult>;
}

const TapToPayNative = registerPlugin<TapToPayPlugin>('OrderfastTapToPay');

const webUnavailable = async (): Promise<TapToPayResult> => ({
  status: 'unavailable',
  code: 'unsupported',
  message: 'Tap to Pay is only available in the Orderfast Android kiosk app.',
});

export const tapToPayBridge: TapToPayPlugin = {
  async isTapToPaySupported() {
    try {
      return await TapToPayNative.isTapToPaySupported();
    } catch {
      return { supported: false, reason: 'Tap to Pay native bridge unavailable' };
    }
  },
  async prepareTapToPay(options) {
    try {
      return await TapToPayNative.prepareTapToPay(options);
    } catch {
      return webUnavailable();
    }
  },
  async startTapToPayPayment(options) {
    try {
      return await TapToPayNative.startTapToPayPayment(options);
    } catch {
      return webUnavailable();
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
    } catch {
      return { status: 'unavailable', code: 'unsupported', message: 'Tap to Pay native bridge unavailable' };
    }
  },
};
