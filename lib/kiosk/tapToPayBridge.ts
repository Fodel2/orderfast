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
});

export const tapToPayBridge: TapToPayPlugin = {
  async isTapToPaySupported() {
    try {
      return await TapToPayNative.isTapToPaySupported();
    } catch (error) {
      return { supported: false, reason: `Tap to Pay native bridge unavailable: ${readErrorMessage(error)}` };
    }
  },
  async prepareTapToPay(options) {
    try {
      return await TapToPayNative.prepareTapToPay(options);
    } catch (error) {
      return { status: 'unavailable', code: 'unsupported', message: `Tap to Pay native bridge unavailable: ${readErrorMessage(error)}` };
    }
  },
  async startTapToPayPayment(options) {
    try {
      return await TapToPayNative.startTapToPayPayment(options);
    } catch (error) {
      return { status: 'unavailable', code: 'unsupported', message: `Tap to Pay native bridge unavailable: ${readErrorMessage(error)}` };
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
      return { status: 'unavailable', code: 'unsupported', message: `Tap to Pay native bridge unavailable: ${readErrorMessage(error)}` };
    }
  },
};
