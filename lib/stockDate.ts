const LONDON_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
};

const formatIsoDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function getTomorrowLondonDate(): string {
  const londonToday = LONDON_DATE_FORMATTER.format(new Date());
  const { year, month, day } = parseIsoDate(londonToday);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + 1);
  return formatIsoDate(utcDate);
}
