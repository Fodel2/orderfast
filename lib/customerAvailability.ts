import {
  formatClockTime,
  formatTimeInTimeZone,
  formatWeekdayInTimeZone,
  getZonedDateParts,
  toIsoDateInTimeZone,
} from '@/lib/timezone';

export type OpeningPeriod = {
  open_time: string;
  close_time: string;
  sort_order?: number | null;
};

export type OpeningException = {
  exception_date: string;
  is_closed: boolean;
  periods: OpeningPeriod[];
};

export type AvailabilityInputs = {
  now: Date;
  timeZone: string;
  overrideMode?: 'none' | 'manual_closed' | 'on_break' | null;
  overrideUntil?: string | null;
  isOpen?: boolean;
  breakUntil?: string | null;
  availabilityUpdatedAt?: string | null;
  weeklyPeriods: Array<OpeningPeriod & { day_of_week: number }>;
  exceptions: OpeningException[];
};

export type AvailabilitySnapshot = {
  isOpenNow: boolean;
  blocksNewSessions: boolean;
  reason: 'manual_closed' | 'on_break' | 'outside_hours' | 'closed_exception' | 'open';
  primaryLabel: string;
  secondaryLabel: string | null;
};

type ScheduleDay = {
  source: 'weekly' | 'exception';
  periods: OpeningPeriod[];
  isClosedException: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function minutesFromTime(value: string): number {
  const [h, m] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function getScheduleForDate(inputs: AvailabilityInputs, date: Date): ScheduleDay {
  const isoDate = toIsoDateInTimeZone(date, inputs.timeZone);
  const exception = inputs.exceptions.find((row) => row.exception_date === isoDate);

  if (exception) {
    return {
      source: 'exception',
      periods: exception.periods || [],
      isClosedException: Boolean(exception.is_closed),
    };
  }

  const day = getZonedDateParts(date, inputs.timeZone).weekday;
  const periods = inputs.weeklyPeriods
    .filter((row) => row.day_of_week === day)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return {
    source: 'weekly',
    periods,
    isClosedException: false,
  };
}

function findNextOpening(inputs: AvailabilityInputs, now: Date): { label: string } | null {
  const nowParts = getZonedDateParts(now, inputs.timeZone);
  const nowMinutes = nowParts.hour * 60 + nowParts.minute;

  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const date = new Date(now.getTime() + dayOffset * DAY_MS);
    const schedule = getScheduleForDate(inputs, date);
    if (schedule.isClosedException) continue;
    if (!schedule.periods.length) continue;

    const candidate = schedule.periods
      .map((period) => minutesFromTime(period.open_time))
      .find((openMinutes) => dayOffset > 0 || openMinutes > nowMinutes);

    if (candidate === undefined) continue;

    const openingTime = formatClockTime(
      `${String(Math.floor(candidate / 60)).padStart(2, '0')}:${String(candidate % 60).padStart(2, '0')}`,
      inputs.timeZone
    );

    const label =
      dayOffset === 0
        ? `Opens at ${openingTime}`
        : dayOffset === 1
        ? `Opens tomorrow at ${openingTime}`
        : `Opens ${formatWeekdayInTimeZone(date, inputs.timeZone)} at ${openingTime}`;

    return { label };
  }
  return null;
}

export function evaluateAvailability(inputs: AvailabilityInputs): AvailabilitySnapshot {
  const now = inputs.now;
  const todaySchedule = getScheduleForDate(inputs, now);
  if (todaySchedule.isClosedException) {
    const next = findNextOpening(inputs, now);
    return {
      isOpenNow: false,
      blocksNewSessions: true,
      reason: 'closed_exception',
      primaryLabel: 'Closed right now',
      secondaryLabel: next?.label || null,
    };
  }

  const nowParts = getZonedDateParts(now, inputs.timeZone);
  const nowMinutes = nowParts.hour * 60 + nowParts.minute;
  const periods = todaySchedule.periods || [];

  let activePeriod: OpeningPeriod | null = null;
  for (const period of periods) {
    const openMinutes = minutesFromTime(period.open_time);
    const closeMinutes = minutesFromTime(period.close_time);
    if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) {
      activePeriod = period;
      break;
    }
  }

  if (!activePeriod) {
    const next = findNextOpening(inputs, now);
    return {
      isOpenNow: false,
      blocksNewSessions: true,
      reason: 'outside_hours',
      primaryLabel: 'Closed right now',
      secondaryLabel: next?.label || null,
    };
  }

  const normalizedOverrideMode =
    inputs.overrideMode === 'manual_closed' || inputs.overrideMode === 'on_break' || inputs.overrideMode === 'none'
      ? inputs.overrideMode
      : !inputs.isOpen
      ? 'manual_closed'
      : inputs.breakUntil
      ? 'on_break'
      : 'none';
  const effectiveOverrideUntil = inputs.overrideUntil ?? inputs.breakUntil ?? null;

  if (normalizedOverrideMode === 'manual_closed') {
    return {
      isOpenNow: false,
      blocksNewSessions: true,
      reason: 'manual_closed',
      primaryLabel: 'Closed right now',
      secondaryLabel: null,
    };
  }

  if (normalizedOverrideMode === 'on_break' && effectiveOverrideUntil) {
    const breakDate = new Date(effectiveOverrideUntil);
    if (breakDate.getTime() > now.getTime()) {
      return {
        isOpenNow: false,
        blocksNewSessions: true,
        reason: 'on_break',
        primaryLabel: 'Temporarily closed',
        secondaryLabel: `Back at ${formatTimeInTimeZone(breakDate, inputs.timeZone)}`,
      };
    }
  }

  return {
    isOpenNow: true,
    blocksNewSessions: false,
    reason: 'open',
    primaryLabel: 'Open now',
    secondaryLabel: `Closes at ${formatClockTime(activePeriod.close_time, inputs.timeZone)}`,
  };
}
