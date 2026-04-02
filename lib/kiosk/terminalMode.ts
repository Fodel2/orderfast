export type KioskTerminalMode = 'real_tap_to_pay' | 'simulated_terminal';

const normalizeMode = (value: string | null | undefined): KioskTerminalMode | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'real_tap_to_pay') return 'real_tap_to_pay';
  if (normalized === 'simulated_terminal') return 'simulated_terminal';
  return null;
};

const inferDefaultModeFromEnv = (envName: string | null | undefined): KioskTerminalMode => {
  if (!envName) return 'real_tap_to_pay';
  const normalized = envName.trim().toLowerCase();
  return normalized === 'production' ? 'real_tap_to_pay' : 'simulated_terminal';
};

export const resolveServerDefaultKioskTerminalMode = (): KioskTerminalMode => {
  const explicit = normalizeMode(process.env.KIOSK_TERMINAL_MODE);
  if (explicit) return explicit;
  return inferDefaultModeFromEnv(process.env.VERCEL_ENV || process.env.NODE_ENV);
};

export const normalizeKioskTerminalMode = normalizeMode;
