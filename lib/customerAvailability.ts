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
  isOpen: boolean;
  breakUntil: string | null;
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

function formatTime(value: string) {
  const [h, m] = value.split(':').map((part) => Number(part));
  const dt = new Date();
  dt.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function toIsoLocalDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getScheduleForDate(inputs: AvailabilityInputs, date: Date): ScheduleDay {
  const isoDate = toIsoLocalDate(date);
  const exception = inputs.exceptions.find((row) => row.exception_date === isoDate);

  if (exception) {
    return {
      source: 'exception',
      periods: exception.periods || [],
      isClosedException: Boolean(exception.is_closed),
    };
  }

  const day = date.getDay();
  const periods = inputs.weeklyPeriods
    .filter((row) => row.day_of_week === day)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return {
    source: 'weekly',
    periods,
    isClosedException: false,
  };
}

function findNextOpening(inputs: AvailabilityInputs, now: Date): { when: Date; label: string } | null {
  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const date = new Date(now.getTime() + dayOffset * DAY_MS);
    const schedule = getScheduleForDate(inputs, date);
    if (schedule.isClosedException) continue;
    if (!schedule.periods.length) continue;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const candidate = schedule.periods
      .map((period) => minutesFromTime(period.open_time))
      .find((openMinutes) => dayOffset > 0 || openMinutes > nowMinutes);

    if (candidate === undefined) continue;

    const when = new Date(date);
    when.setHours(Math.floor(candidate / 60), candidate % 60, 0, 0);

    const label = dayOffset === 0
      ? `Opens at ${formatTime(String(Math.floor(candidate / 60)).padStart(2, '0') + ':' + String(candidate % 60).padStart(2, '0'))}`
      : dayOffset === 1
      ? `Opens tomorrow at ${formatTime(String(Math.floor(candidate / 60)).padStart(2, '0') + ':' + String(candidate % 60).padStart(2, '0'))}`
      : `Opens ${when.toLocaleDateString([], { weekday: 'long' })} at ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

    return { when, label };
  }
  return null;
}

export function evaluateAvailability(inputs: AvailabilityInputs): AvailabilitySnapshot {
  const now = inputs.now;

  if (!inputs.isOpen) {
    return {
      isOpenNow: false,
      blocksNewSessions: true,
      reason: 'manual_closed',
      primaryLabel: 'Closed right now',
      secondaryLabel: null,
    };
  }

  if (inputs.breakUntil) {
    const breakDate = new Date(inputs.breakUntil);
    if (breakDate.getTime() > now.getTime()) {
      return {
        isOpenNow: false,
        blocksNewSessions: true,
        reason: 'on_break',
        primaryLabel: 'Temporarily closed',
        secondaryLabel: `Back at ${breakDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
      };
    }
  }

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

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
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

  if (activePeriod) {
    return {
      isOpenNow: true,
      blocksNewSessions: false,
      reason: 'open',
      primaryLabel: 'Open now',
      secondaryLabel: `Closes at ${formatTime(activePeriod.close_time)}`,
    };
  }

  const next = findNextOpening(inputs, now);
  return {
    isOpenNow: false,
    blocksNewSessions: true,
    reason: 'outside_hours',
    primaryLabel: 'Closed right now',
    secondaryLabel: next?.label || null,
  };
}
