import { evaluateAvailability, type OpeningException, type OpeningPeriod } from '@/lib/customerAvailability';
import { supaServer } from '@/lib/supaServer';
import { addDaysToIsoDate, resolveRestaurantTimeZone, toIsoDateInTimeZone } from '@/lib/timezone';

type AvailabilityCheckResult =
  | { ok: true; snapshot: ReturnType<typeof evaluateAvailability> }
  | { ok: false; reason: string };

export async function getServerAvailabilitySnapshot(restaurantId: string): Promise<AvailabilityCheckResult> {
  if (!restaurantId) {
    return { ok: false, reason: 'Missing restaurant id.' };
  }

  const now = new Date();

  const { data: restaurantData, error: restaurantError } = await supaServer
    .from('restaurants')
    .select('availability_override_mode,availability_override_until,is_open,break_until,timezone')
    .eq('id', restaurantId)
    .maybeSingle();

  if (restaurantError) {
    return { ok: false, reason: 'Unable to read restaurant availability.' };
  }

  const timeZone = resolveRestaurantTimeZone(restaurantData?.timezone);
  const todayIso = toIsoDateInTimeZone(now, timeZone);
  const startIso = addDaysToIsoDate(todayIso, -1);
  const endIso = addDaysToIsoDate(todayIso, 7);

  const [weeklyRes, exceptionRes] = await Promise.all([
    supaServer
      .from('opening_hours_weekly_periods')
      .select('day_of_week,open_time,close_time,sort_order')
      .eq('restaurant_id', restaurantId),
    supaServer
      .from('opening_hours_exceptions')
      .select('exception_date,is_closed,opening_hours_exception_periods(open_time,close_time,sort_order)')
      .eq('restaurant_id', restaurantId)
      .gte('exception_date', startIso)
      .lte('exception_date', endIso),
  ]);

  if (weeklyRes.error) {
    return { ok: false, reason: 'Unable to read weekly availability periods.' };
  }
  if (exceptionRes.error) {
    return { ok: false, reason: 'Unable to read special-day overrides.' };
  }

  const snapshot = evaluateAvailability({
    now,
    timeZone,
    overrideMode:
      restaurantData?.availability_override_mode === 'manual_closed' ||
      restaurantData?.availability_override_mode === 'on_break'
        ? restaurantData.availability_override_mode
        : 'none',
    overrideUntil: restaurantData?.availability_override_until || null,
    isOpen: typeof restaurantData?.is_open === 'boolean' ? restaurantData.is_open : true,
    breakUntil: restaurantData?.break_until || null,
    weeklyPeriods: (weeklyRes.data || []) as Array<OpeningPeriod & { day_of_week: number }>,
    exceptions: ((exceptionRes.data || []) as any[]).map((row) => ({
      exception_date: row.exception_date,
      is_closed: Boolean(row.is_closed),
      periods: (row.opening_hours_exception_periods || []) as OpeningPeriod[],
    })) as OpeningException[],
  });

  return { ok: true, snapshot };
}
