import {
  type ContactlessEligibilityCheckpoint,
  type ContactlessEntryPoint,
  resolveContactlessEligibility,
} from '@/lib/payments/contactlessEligibility';

export type StaffTapToPayAvailability = {
  resolved: Awaited<ReturnType<typeof resolveContactlessEligibility>>;
  serverAvailable: boolean;
  serverReason: string;
  httpStatus: number;
};

const logStaffAvailability = (entryPoint: ContactlessEntryPoint, event: string, payload?: Record<string, unknown>) => {
  console.info('[payments][contactless_eligibility]', event, { entryPoint, ...payload });
};

export const resolveStaffTapToPayAvailability = async (input: {
  checkpoint: ContactlessEligibilityCheckpoint;
  entryPoint: ContactlessEntryPoint;
  source: 'launcher' | 'internal_settlement';
}): Promise<StaffTapToPayAvailability> => {
  logStaffAvailability(input.entryPoint, 'staff_availability_check_started', {
    checkpoint: input.checkpoint,
    source: input.source,
    model: 'live_server_and_native',
  });

  const response = await fetch('/api/dashboard/internal-settlement/tap-to-pay-availability', { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  const serverAvailable = response.ok && payload?.tap_to_pay_available === true;
  const serverReason = response.ok
    ? (serverAvailable ? '' : String(payload?.reason || 'Tap to Pay is not available for this restaurant.'))
    : String(payload?.message || `HTTP ${response.status}`);

  const resolved = await resolveContactlessEligibility({
    checkpoint: input.checkpoint,
    audience: 'staff',
    entryPoint: input.entryPoint,
    restaurantAllowsContactless: serverAvailable,
    entryPointSupportsContactless: true,
  });

  logStaffAvailability(input.entryPoint, 'staff_availability_checked', {
    checkpoint: input.checkpoint,
    source: input.source,
    httpStatus: response.status,
    serverAvailable,
    serverReason: serverReason || null,
    nativeEligibility: resolved.eligible,
    nativeReason: resolved.reason,
  });

  if (serverAvailable && !resolved.eligible) {
    logStaffAvailability(input.entryPoint, 'settings_allowed_but_live_availability_denied', {
      checkpoint: input.checkpoint,
      source: input.source,
      reason: resolved.detail,
      nativeReason: resolved.reason,
    });
  }

  return {
    resolved,
    serverAvailable,
    serverReason,
    httpStatus: response.status,
  };
};
