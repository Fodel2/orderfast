import { supaServer } from '@/lib/supaServer';
import { evaluateAvailability, type OpeningException, type OpeningPeriod } from '@/lib/customerAvailability';

type AvailabilityCheckResult =
  | { ok: true; snapshot: ReturnType<typeof evaluateAvailability> }
  | { ok: false; reason: string };

function toIsoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export async function getServerAvailabilitySnapshot(restaurantId: string): Promise<AvailabilityCheckResult> {
  if (!restaurantId) {
    return { ok: false, reason: 'Missing restaurant id.' };
  }

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 1);
  const end = new Date(today);
  end.setDate(today.getDate() + 7);

  const [restaurantRes, weeklyRes, exceptionRes] = await Promise.all([
    supaServer
      .from('restaurants')
      .select('availability_override_mode,availability_override_until,is_open,break_until,updated_at')
      .eq('id', restaurantId)
      .maybeSingle(),
    supaServer
      .from('opening_hours_weekly_periods')
      .select('day_of_week,open_time,close_time,sort_order')
      .eq('restaurant_id', restaurantId),
    supaServer
      .from('opening_hours_exceptions')
      .select('exception_date,is_closed,opening_hours_exception_periods(open_time,close_time,sort_order)')
      .eq('restaurant_id', restaurantId)
      .gte('exception_date', toIsoDate(start))
      .lte('exception_date', toIsoDate(end)),
  ]);

  if (restaurantRes.error) {
    return { ok: false, reason: 'Unable to read restaurant availability.' };
  }
  if (weeklyRes.error) {
    return { ok: false, reason: 'Unable to read weekly availability periods.' };
  }
  if (exceptionRes.error) {
    return { ok: false, reason: 'Unable to read special-day overrides.' };
  }

  const snapshot = evaluateAvailability({
    now: new Date(),
    overrideMode:
      restaurantRes.data?.availability_override_mode === 'manual_closed' ||
      restaurantRes.data?.availability_override_mode === 'on_break'
        ? restaurantRes.data.availability_override_mode
        : 'none',
    overrideUntil: restaurantRes.data?.availability_override_until || null,
    isOpen: typeof restaurantRes.data?.is_open === 'boolean' ? restaurantRes.data.is_open : true,
    breakUntil: restaurantRes.data?.break_until || null,
    availabilityUpdatedAt: restaurantRes.data?.updated_at || null,
    weeklyPeriods: (weeklyRes.data || []) as Array<OpeningPeriod & { day_of_week: number }>,
    exceptions: ((exceptionRes.data || []) as any[]).map((row) => ({
      exception_date: row.exception_date,
      is_closed: Boolean(row.is_closed),
      periods: (row.opening_hours_exception_periods || []) as OpeningPeriod[],
    })) as OpeningException[],
  });

  return { ok: true, snapshot };
}
