import { resolveNativeTapToPayReadiness } from '@/lib/kiosk/tapToPayNativeReadiness';

export type ContactlessEntryPoint = 'kiosk' | 'pos' | 'take_payment';
export type ContactlessRuntime = 'native' | 'web' | 'server';
export type ContactlessAudience = 'customer' | 'staff';
export type ContactlessEligibilityCheckpoint =
  | 'app_launch'
  | 'screen_entry'
  | 'session_start'
  | 'before_render'
  | 'selection'
  | 'before_native_start';
export type ContactlessIneligibilityReason =
  | 'restaurant_setting_disabled'
  | 'entry_point_not_supported'
  | 'runtime_not_native'
  | 'native_device_not_supported'
  | 'native_setup_not_ready';

export type ContactlessEligibilityResult = {
  eligible: boolean;
  runtime: ContactlessRuntime;
  audience: ContactlessAudience;
  checkpoint: ContactlessEligibilityCheckpoint;
  reason: ContactlessIneligibilityReason | null;
  detail: string;
};

export type ContactlessOptionPresentation = 'enabled' | 'disabled' | 'hidden';

export type ContactlessEligibilityPresentation = ContactlessEligibilityResult & {
  presentation: ContactlessOptionPresentation;
};

type ResolveContactlessEligibilityInput = {
  checkpoint: ContactlessEligibilityCheckpoint;
  audience: ContactlessAudience;
  entryPoint: ContactlessEntryPoint;
  restaurantAllowsContactless: boolean;
  entryPointSupportsContactless: boolean;
};

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
  };
};

const resolveRuntime = (): ContactlessRuntime => {
  if (typeof window === 'undefined') return 'server';
  const native = Boolean((window as CapacitorWindow).Capacitor?.isNativePlatform?.());
  return native ? 'native' : 'web';
};

const logEligibility = (entryPoint: ContactlessEntryPoint, event: string, payload?: Record<string, unknown>) => {
  console.info('[payments][contactless_eligibility]', event, { entryPoint, ...payload });
};

export const resolveContactlessEligibility = async (
  input: ResolveContactlessEligibilityInput
): Promise<ContactlessEligibilityResult> => {
  const runtime = resolveRuntime();
  logEligibility(input.entryPoint, 'runtime_detected', { runtime, checkpoint: input.checkpoint, audience: input.audience });
  logEligibility(input.entryPoint, 'eligibility_evaluation_started', {
    runtime,
    checkpoint: input.checkpoint,
    audience: input.audience,
    restaurantAllowsContactless: input.restaurantAllowsContactless,
    entryPointSupportsContactless: input.entryPointSupportsContactless,
  });

  if (!input.restaurantAllowsContactless) {
    const result: ContactlessEligibilityResult = {
      eligible: false,
      runtime,
      audience: input.audience,
      checkpoint: input.checkpoint,
      reason: 'restaurant_setting_disabled',
      detail: 'Restaurant settings disabled contactless.',
    };
    logEligibility(input.entryPoint, 'eligibility_resolved', result);
    return result;
  }

  if (!input.entryPointSupportsContactless) {
    const result: ContactlessEligibilityResult = {
      eligible: false,
      runtime,
      audience: input.audience,
      checkpoint: input.checkpoint,
      reason: 'entry_point_not_supported',
      detail: 'This payment entry point does not support contactless.',
    };
    logEligibility(input.entryPoint, 'eligibility_resolved', result);
    return result;
  }

  if (runtime !== 'native') {
    const result: ContactlessEligibilityResult = {
      eligible: false,
      runtime,
      audience: input.audience,
      checkpoint: input.checkpoint,
      reason: 'runtime_not_native',
      detail: 'Contactless is unavailable outside the native app runtime.',
    };
    logEligibility(input.entryPoint, 'eligibility_resolved', result);
    return result;
  }

  const readiness = await resolveNativeTapToPayReadiness({ promptIfNeeded: false });
  if (!readiness.supported) {
    const result: ContactlessEligibilityResult = {
      eligible: false,
      runtime,
      audience: input.audience,
      checkpoint: input.checkpoint,
      reason: 'native_device_not_supported',
      detail: readiness.reason || 'Native Tap to Pay is not supported on this device/runtime.',
    };
    logEligibility(input.entryPoint, 'eligibility_resolved', result);
    return result;
  }

  if (!readiness.ready) {
    const result: ContactlessEligibilityResult = {
      eligible: false,
      runtime,
      audience: input.audience,
      checkpoint: input.checkpoint,
      reason: 'native_setup_not_ready',
      detail: readiness.reason || 'Native Tap to Pay setup is not ready.',
    };
    logEligibility(input.entryPoint, 'eligibility_resolved', result);
    return result;
  }

  const result: ContactlessEligibilityResult = {
    eligible: true,
    runtime,
    audience: input.audience,
    checkpoint: input.checkpoint,
    reason: null,
    detail: 'Contactless is eligible and can be rendered.',
  };
  logEligibility(input.entryPoint, 'eligibility_resolved', result);
  return result;
};

export const resolveContactlessPresentation = (
  result: ContactlessEligibilityResult
): ContactlessEligibilityPresentation => {
  if (result.eligible) {
    return { ...result, presentation: 'enabled' };
  }
  if (result.audience === 'staff') {
    return { ...result, presentation: 'disabled' };
  }
  return { ...result, presentation: 'hidden' };
};
