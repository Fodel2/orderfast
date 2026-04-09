const DEFAULT_TIMEZONE = 'UTC';

const WEEKDAY_INDEX_BY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
};

function parseNumberPart(value: string | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveRestaurantTimeZone(timezone: string | null | undefined): string {
  const candidate = typeof timezone === 'string' ? timezone.trim() : '';
  if (!candidate) return DEFAULT_TIMEZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayRaw = lookup.weekday || 'Sun';

  return {
    year: parseNumberPart(lookup.year),
    month: parseNumberPart(lookup.month),
    day: parseNumberPart(lookup.day),
    weekday: WEEKDAY_INDEX_BY_SHORT[weekdayRaw] ?? 0,
    hour: parseNumberPart(lookup.hour),
    minute: parseNumberPart(lookup.minute),
  };
}

export function toIsoDateInTimeZone(date: Date, timeZone: string): string {
  const parts = getZonedDateParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map((value) => Number(value));
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  const nextYear = utcDate.getUTCFullYear();
  const nextMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function formatClockTime(time: string, timeZone: string): string {
  const [hourRaw, minuteRaw] = time.split(':').map((part) => Number(part));
  const hour = Number.isFinite(hourRaw) ? hourRaw : 0;
  const minute = Number.isFinite(minuteRaw) ? minuteRaw : 0;
  const reference = new Date(Date.UTC(2000, 0, 1, hour, minute));
  return reference.toLocaleTimeString([], {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatWeekdayInTimeZone(date: Date, timeZone: string): string {
  return date.toLocaleDateString([], { timeZone, weekday: 'long' });
}

export function formatTimeInTimeZone(date: Date, timeZone: string): string {
  return date.toLocaleTimeString([], { timeZone, hour: 'numeric', minute: '2-digit' });
}
