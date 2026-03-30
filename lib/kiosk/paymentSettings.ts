export type KioskPaymentMethod = 'pay_at_counter' | 'cash' | 'contactless';

export type KioskPaymentSettingsRow = {
  restaurant_id: string;
  process_on_device: boolean;
  enable_cash: boolean;
  enable_contactless: boolean;
  enable_pay_at_counter: boolean;
};

export const DEFAULT_KIOSK_PAYMENT_SETTINGS: Omit<KioskPaymentSettingsRow, 'restaurant_id'> = {
  process_on_device: false,
  enable_cash: false,
  enable_contactless: false,
  enable_pay_at_counter: true,
};

export type NormalizedKioskPaymentSettings = {
  processOnDevice: boolean;
  enableCash: boolean;
  enableContactless: boolean;
  enablePayAtCounter: boolean;
  enabledMethods: KioskPaymentMethod[];
};

export const normalizeKioskPaymentSettings = (
  row: Partial<KioskPaymentSettingsRow> | null | undefined
): NormalizedKioskPaymentSettings => {
  const processOnDevice = !!row?.process_on_device;
  const enableCash = !!row?.enable_cash;
  const enableContactless = !!row?.enable_contactless;
  const enablePayAtCounter = row?.enable_pay_at_counter !== false;

  const enabledMethods: KioskPaymentMethod[] = [];

  if (!processOnDevice) {
    enabledMethods.push('pay_at_counter');
  } else {
    if (enableContactless) enabledMethods.push('contactless');
    if (enableCash) enabledMethods.push('cash');
    if (enablePayAtCounter) enabledMethods.push('pay_at_counter');
  }

  if (!enabledMethods.length) {
    enabledMethods.push('pay_at_counter');
  }

  return {
    processOnDevice,
    enableCash,
    enableContactless,
    enablePayAtCounter,
    enabledMethods,
  };
};
