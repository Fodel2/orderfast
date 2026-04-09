import { evaluateAvailability } from '@/lib/customerAvailability';

describe('evaluateAvailability timezone handling', () => {
  it('uses restaurant timezone for weekly period day selection', () => {
    const snapshot = evaluateAvailability({
      now: new Date('2026-03-30T00:30:00.000Z'),
      timeZone: 'America/New_York',
      overrideMode: 'none',
      weeklyPeriods: [
        { day_of_week: 0, open_time: '20:00', close_time: '23:00', sort_order: 0 },
      ],
      exceptions: [],
    });

    expect(snapshot.isOpenNow).toBe(true);
    expect(snapshot.reason).toBe('open');
  });

  it('uses timezone local date when matching exception rows', () => {
    const snapshot = evaluateAvailability({
      now: new Date('2026-01-01T00:30:00.000Z'),
      timeZone: 'America/Los_Angeles',
      overrideMode: 'none',
      weeklyPeriods: [{ day_of_week: 3, open_time: '00:00', close_time: '23:59', sort_order: 0 }],
      exceptions: [
        {
          exception_date: '2025-12-31',
          is_closed: true,
          periods: [],
        },
      ],
    });

    expect(snapshot.isOpenNow).toBe(false);
    expect(snapshot.reason).toBe('closed_exception');
  });
});
