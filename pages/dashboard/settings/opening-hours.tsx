import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import DashboardLayout from '../../../components/DashboardLayout';
import Toast from '../../../components/Toast';
import SettingsSectionSwitcher from '../../../components/dashboard/settings/SettingsSectionSwitcher';
import { supabase } from '../../../utils/supabaseClient';

type OpeningSection = 'weekly' | 'special' | 'preview';

type WeeklyPeriodRow = {
  id?: number;
  day_of_week: number;
  open_time: string;
  close_time: string;
  sort_order: number;
};

type WeeklyDayState = {
  day: number;
  periods: WeeklyPeriodRow[];
};

type ExceptionPeriodRow = {
  id?: number;
  open_time: string;
  close_time: string;
  sort_order: number;
};

type ExceptionState = {
  id?: number;
  exception_date: string;
  is_closed: boolean;
  label: string;
  periods: ExceptionPeriodRow[];
};

const SECTION_ITEMS: { key: OpeningSection; label: string }[] = [
  { key: 'weekly', label: 'Weekly Hours' },
  { key: 'special', label: 'Special Days' },
  { key: 'preview', label: 'Status & Preview' },
];

const WEEKDAYS = [
  { day: 0, label: 'Sunday' },
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
];

function createDefaultWeeklyDays(): WeeklyDayState[] {
  return WEEKDAYS.map((row) => ({ day: row.day, periods: [] }));
}

export default function DashboardSettingsOpeningHoursPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<OpeningSection>('weekly');
  const [toastMessage, setToastMessage] = useState('');

  const [weeklyDays, setWeeklyDays] = useState<WeeklyDayState[]>(createDefaultWeeklyDays());
  const [weeklySaving, setWeeklySaving] = useState(false);
  const [existingWeeklyIds, setExistingWeeklyIds] = useState<number[]>([]);

  const [exceptions, setExceptions] = useState<ExceptionState[]>([]);
  const [specialSaving, setSpecialSaving] = useState(false);
  const [existingExceptionIds, setExistingExceptionIds] = useState<number[]>([]);
  const [existingExceptionPeriodIds, setExistingExceptionPeriodIds] = useState<Record<number, number[]>>({});

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (membershipError || !membership?.restaurant_id) {
        setToastMessage('Unable to load restaurant context.');
        setLoading(false);
        return;
      }

      const rid = membership.restaurant_id;
      setRestaurantId(rid);

      const [{ data: weeklyRows, error: weeklyError }, { data: exceptionRows, error: exceptionError }] = await Promise.all([
        supabase
          .from('opening_hours_weekly_periods')
          .select('id,day_of_week,open_time,close_time,sort_order')
          .eq('restaurant_id', rid)
          .order('day_of_week', { ascending: true })
          .order('sort_order', { ascending: true }),
        supabase
          .from('opening_hours_exceptions')
          .select('id,exception_date,is_closed,label,opening_hours_exception_periods(id,open_time,close_time,sort_order)')
          .eq('restaurant_id', rid)
          .order('exception_date', { ascending: true }),
      ]);

      if (weeklyError) {
        setToastMessage(`Failed to load weekly hours: ${weeklyError.message}`);
      }

      if (exceptionError) {
        setToastMessage(`Failed to load special days: ${exceptionError.message}`);
      }

      const byDay = createDefaultWeeklyDays();
      const collectedWeeklyIds: number[] = [];
      (weeklyRows || []).forEach((row: any) => {
        collectedWeeklyIds.push(row.id);
        const index = byDay.findIndex((entry) => entry.day === row.day_of_week);
        if (index < 0) return;
        byDay[index].periods.push({
          id: row.id,
          day_of_week: row.day_of_week,
          open_time: row.open_time,
          close_time: row.close_time,
          sort_order: row.sort_order ?? byDay[index].periods.length,
        });
      });

      byDay.forEach((day) => {
        day.periods.sort((a, b) => a.sort_order - b.sort_order);
      });

      setWeeklyDays(byDay);
      setExistingWeeklyIds(collectedWeeklyIds);

      const loadedExceptions: ExceptionState[] = (exceptionRows || []).map((row: any) => ({
        id: row.id,
        exception_date: row.exception_date,
        is_closed: Boolean(row.is_closed),
        label: row.label || '',
        periods: (row.opening_hours_exception_periods || [])
          .map((period: any) => ({
            id: period.id,
            open_time: period.open_time,
            close_time: period.close_time,
            sort_order: period.sort_order ?? 0,
          }))
          .sort((a: ExceptionPeriodRow, b: ExceptionPeriodRow) => a.sort_order - b.sort_order),
      }));

      setExceptions(loadedExceptions);
      setExistingExceptionIds(loadedExceptions.map((entry) => entry.id).filter(Boolean) as number[]);
      setExistingExceptionPeriodIds(
        loadedExceptions.reduce<Record<number, number[]>>((acc, entry) => {
          if (!entry.id) return acc;
          acc[entry.id] = entry.periods.map((period) => period.id).filter(Boolean) as number[];
          return acc;
        }, {})
      );

      setLoading(false);
    };

    load();
  }, [router]);

  const saveWeeklyHours = async () => {
    if (!restaurantId) return;
    setWeeklySaving(true);

    const flattened = weeklyDays.flatMap((day) =>
      day.periods.map((period, index) => ({
        id: period.id,
        restaurant_id: restaurantId,
        day_of_week: day.day,
        open_time: period.open_time,
        close_time: period.close_time,
        sort_order: index,
      }))
    );

    let savedRows: Array<{ id: number }> = [];
    let upsertError: { message: string } | null = null;
    if (flattened.length > 0) {
      const upsertRes = await supabase
        .from('opening_hours_weekly_periods')
        .upsert(flattened, { onConflict: 'id' })
        .select('id');
      savedRows = (upsertRes.data || []) as Array<{ id: number }>;
      upsertError = upsertRes.error;
    }

    if (upsertError) {
      setToastMessage(`Failed to save weekly hours: ${upsertError.message}`);
      setWeeklySaving(false);
      return;
    }

    const savedIds = (savedRows || []).map((row: any) => row.id as number);
    const removedIds = existingWeeklyIds.filter((id) => !savedIds.includes(id));

    if (removedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('opening_hours_weekly_periods')
        .delete()
        .eq('restaurant_id', restaurantId)
        .in('id', removedIds);

      if (deleteError) {
        setToastMessage(`Weekly hours saved, but cleanup failed: ${deleteError.message}`);
        setWeeklySaving(false);
        return;
      }
    }

    setExistingWeeklyIds(savedIds);
    setWeeklyDays((prev) =>
      prev.map((day) => ({
        ...day,
        periods: day.periods
          .map((period, idx) => ({ ...period, sort_order: idx }))
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
    );

    setToastMessage('Weekly hours saved.');
    setWeeklySaving(false);
  };

  const saveSpecialDays = async () => {
    if (!restaurantId) return;
    setSpecialSaving(true);

    const keptExceptionIds: number[] = [];
    const nextExistingPeriodIds: Record<number, number[]> = {};

    for (const [index, exception] of exceptions.entries()) {
      if (!exception.exception_date) {
        setToastMessage(`Special day #${index + 1} is missing a date.`);
        setSpecialSaving(false);
        return;
      }

      if (!exception.is_closed && exception.periods.length === 0) {
        setToastMessage(
          `Special day #${index + 1} needs at least one opening period, or mark it closed all day.`
        );
        setSpecialSaving(false);
        return;
      }

      const { data: savedException, error: exceptionError } = await supabase
        .from('opening_hours_exceptions')
        .upsert(
          {
            id: exception.id,
            restaurant_id: restaurantId,
            exception_date: exception.exception_date,
            is_closed: exception.is_closed,
            label: exception.label || null,
          },
          { onConflict: 'id' }
        )
        .select('id')
        .single();

      if (exceptionError || !savedException?.id) {
        setToastMessage(`Failed to save special day #${index + 1}: ${exceptionError?.message || 'unknown error'}`);
        setSpecialSaving(false);
        return;
      }

      const savedExceptionId = savedException.id as number;
      keptExceptionIds.push(savedExceptionId);

      if (exception.is_closed || exception.periods.length === 0) {
        if (existingExceptionPeriodIds[savedExceptionId]?.length) {
          const { error: deletePeriodsError } = await supabase
            .from('opening_hours_exception_periods')
            .delete()
            .eq('exception_id', savedExceptionId);
          if (deletePeriodsError) {
            setToastMessage(`Failed to clear periods for ${exception.exception_date}: ${deletePeriodsError.message}`);
            setSpecialSaving(false);
            return;
          }
        }
        nextExistingPeriodIds[savedExceptionId] = [];
        continue;
      }

      const periodPayload = exception.periods.map((period, periodIndex) => ({
        id: period.id,
        exception_id: savedExceptionId,
        open_time: period.open_time,
        close_time: period.close_time,
        sort_order: periodIndex,
      }));

      let periodRows: Array<{ id: number }> = [];
      let periodError: { message: string } | null = null;
      if (periodPayload.length > 0) {
        const periodRes = await supabase
          .from('opening_hours_exception_periods')
          .upsert(periodPayload, { onConflict: 'id' })
          .select('id');
        periodRows = (periodRes.data || []) as Array<{ id: number }>;
        periodError = periodRes.error;
      }

      if (periodError) {
        setToastMessage(`Failed to save periods for ${exception.exception_date}: ${periodError.message}`);
        setSpecialSaving(false);
        return;
      }

      const keptPeriodIds = (periodRows || []).map((row: any) => row.id as number);
      const removedPeriodIds = (existingExceptionPeriodIds[savedExceptionId] || []).filter((id) => !keptPeriodIds.includes(id));

      if (removedPeriodIds.length > 0) {
        const { error: removePeriodError } = await supabase
          .from('opening_hours_exception_periods')
          .delete()
          .eq('exception_id', savedExceptionId)
          .in('id', removedPeriodIds);

        if (removePeriodError) {
          setToastMessage(`Failed to remove old periods for ${exception.exception_date}: ${removePeriodError.message}`);
          setSpecialSaving(false);
          return;
        }
      }

      nextExistingPeriodIds[savedExceptionId] = keptPeriodIds;
    }

    const deletedExceptionIds = existingExceptionIds.filter((id) => !keptExceptionIds.includes(id));
    if (deletedExceptionIds.length > 0) {
      const { error: deletePeriodsError } = await supabase
        .from('opening_hours_exception_periods')
        .delete()
        .in('exception_id', deletedExceptionIds);

      if (deletePeriodsError) {
        setToastMessage(`Saved special days, but period cleanup failed: ${deletePeriodsError.message}`);
        setSpecialSaving(false);
        return;
      }

      const { error: deleteExceptionError } = await supabase
        .from('opening_hours_exceptions')
        .delete()
        .eq('restaurant_id', restaurantId)
        .in('id', deletedExceptionIds);

      if (deleteExceptionError) {
        setToastMessage(`Saved special days, but exception cleanup failed: ${deleteExceptionError.message}`);
        setSpecialSaving(false);
        return;
      }
    }

    setExistingExceptionIds(keptExceptionIds);
    setExistingExceptionPeriodIds(nextExistingPeriodIds);
    setToastMessage('Special day overrides saved.');
    setSpecialSaving(false);
  };

  const totalWeeklyPeriods = useMemo(
    () => weeklyDays.reduce((sum, day) => sum + day.periods.length, 0),
    [weeklyDays]
  );

  const closedWeeklyDays = useMemo(() => weeklyDays.filter((day) => day.periods.length === 0).length, [weeklyDays]);

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;

  if (!restaurantId) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-4">
          <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
            ← Settings Home
          </Link>
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            We could not find your restaurant settings right now.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
            ← Settings Home
          </Link>
          <h1 className="text-3xl font-bold">Opening Hours</h1>
          <p className="text-sm text-gray-600">Weekly service windows and date-specific overrides powered by the new opening-hours schema.</p>
        </header>

        <SettingsSectionSwitcher
          label="Opening hours sections"
          items={SECTION_ITEMS}
          value={activeSection}
          onChange={(next) => setActiveSection(next as OpeningSection)}
        />

        {activeSection === 'weekly' && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Regular Weekly Hours</h2>
                <p className="text-sm text-gray-500">Add one or more periods per day. No periods means closed.</p>
              </div>
              <button
                type="button"
                onClick={saveWeeklyHours}
                disabled={weeklySaving}
                className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
              >
                {weeklySaving ? 'Saving…' : 'Save Weekly Hours'}
              </button>
            </div>

            <div className="space-y-3">
              {weeklyDays.map((day) => {
                const weekday = WEEKDAYS.find((row) => row.day === day.day)?.label || `Day ${day.day}`;
                return (
                  <div key={day.day} className="rounded-xl border border-gray-200 p-3 sm:p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{weekday}</h3>
                      <button
                        type="button"
                        onClick={() =>
                          setWeeklyDays((prev) =>
                            prev.map((entry) =>
                              entry.day === day.day
                                ? {
                                    ...entry,
                                    periods: [
                                      ...entry.periods,
                                      {
                                        day_of_week: entry.day,
                                        open_time: '09:00',
                                        close_time: '17:00',
                                        sort_order: entry.periods.length,
                                      },
                                    ],
                                  }
                                : entry
                            )
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-teal-200 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
                      >
                        <PlusIcon className="h-3.5 w-3.5" /> Add period
                      </button>
                    </div>

                    {day.periods.length === 0 ? (
                      <p className="text-xs text-gray-500">Closed all day.</p>
                    ) : (
                      <div className="space-y-2">
                        {day.periods.map((period, periodIndex) => (
                          <div key={`${day.day}-${period.id || periodIndex}`} className="grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                            <label className="space-y-1">
                              <span className="text-xs font-medium text-gray-600">Open</span>
                              <input
                                type="time"
                                value={period.open_time}
                                onChange={(event) =>
                                  setWeeklyDays((prev) =>
                                    prev.map((entry) =>
                                      entry.day === day.day
                                        ? {
                                            ...entry,
                                            periods: entry.periods.map((entryPeriod, entryIndex) =>
                                              entryIndex === periodIndex ? { ...entryPeriod, open_time: event.target.value } : entryPeriod
                                            ),
                                          }
                                        : entry
                                    )
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-xs font-medium text-gray-600">Close</span>
                              <input
                                type="time"
                                value={period.close_time}
                                onChange={(event) =>
                                  setWeeklyDays((prev) =>
                                    prev.map((entry) =>
                                      entry.day === day.day
                                        ? {
                                            ...entry,
                                            periods: entry.periods.map((entryPeriod, entryIndex) =>
                                              entryIndex === periodIndex ? { ...entryPeriod, close_time: event.target.value } : entryPeriod
                                            ),
                                          }
                                        : entry
                                    )
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setWeeklyDays((prev) =>
                                  prev.map((entry) =>
                                    entry.day === day.day
                                      ? {
                                          ...entry,
                                          periods: entry.periods.filter((_, entryIndex) => entryIndex !== periodIndex),
                                        }
                                      : entry
                                  )
                                )
                              }
                              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeSection === 'special' && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Special Days</h2>
                <p className="text-sm text-gray-500">Date overrides that take priority over weekly hours.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setExceptions((prev) => [
                      ...prev,
                      {
                        exception_date: '',
                        is_closed: false,
                        label: '',
                        periods: [{ open_time: '09:00', close_time: '17:00', sort_order: 0 }],
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
                >
                  <PlusIcon className="h-3.5 w-3.5" /> Add special day
                </button>
                <button
                  type="button"
                  onClick={saveSpecialDays}
                  disabled={specialSaving}
                  className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
                >
                  {specialSaving ? 'Saving…' : 'Save Special Days'}
                </button>
              </div>
            </div>

            {exceptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">No special day overrides yet.</div>
            ) : (
              <div className="space-y-3">
                {exceptions.map((exception, exceptionIndex) => (
                  <div key={`exception-${exception.id || exceptionIndex}`} className="rounded-xl border border-gray-200 p-3 sm:p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-gray-600">Date</span>
                        <input
                          type="date"
                          value={exception.exception_date}
                          onChange={(event) =>
                            setExceptions((prev) =>
                              prev.map((entry, idx) => (idx === exceptionIndex ? { ...entry, exception_date: event.target.value } : entry))
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </label>

                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-xs font-medium text-gray-600">Label</span>
                        <input
                          value={exception.label}
                          onChange={(event) =>
                            setExceptions((prev) =>
                              prev.map((entry, idx) => (idx === exceptionIndex ? { ...entry, label: event.target.value } : entry))
                            )
                          }
                          placeholder="Bank Holiday, Event Night, etc."
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setExceptions((prev) => prev.filter((_, idx) => idx !== exceptionIndex))}
                        className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>

                    <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={exception.is_closed}
                        onChange={(event) =>
                          setExceptions((prev) =>
                            prev.map((entry, idx) =>
                              idx === exceptionIndex
                                ? {
                                    ...entry,
                                    is_closed: event.target.checked,
                                    periods: event.target.checked ? [] : entry.periods.length ? entry.periods : [{ open_time: '09:00', close_time: '17:00', sort_order: 0 }],
                                  }
                                : entry
                            )
                          )
                        }
                      />
                      Closed all day
                    </label>

                    {!exception.is_closed && (
                      <div className="mt-3 space-y-2">
                        {exception.periods.map((period, periodIndex) => (
                          <div key={`exception-period-${period.id || periodIndex}`} className="grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                            <label className="space-y-1">
                              <span className="text-xs font-medium text-gray-600">Open</span>
                              <input
                                type="time"
                                value={period.open_time}
                                onChange={(event) =>
                                  setExceptions((prev) =>
                                    prev.map((entry, idx) =>
                                      idx === exceptionIndex
                                        ? {
                                            ...entry,
                                            periods: entry.periods.map((entryPeriod, entryIndex) =>
                                              entryIndex === periodIndex ? { ...entryPeriod, open_time: event.target.value } : entryPeriod
                                            ),
                                          }
                                        : entry
                                    )
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="text-xs font-medium text-gray-600">Close</span>
                              <input
                                type="time"
                                value={period.close_time}
                                onChange={(event) =>
                                  setExceptions((prev) =>
                                    prev.map((entry, idx) =>
                                      idx === exceptionIndex
                                        ? {
                                            ...entry,
                                            periods: entry.periods.map((entryPeriod, entryIndex) =>
                                              entryIndex === periodIndex ? { ...entryPeriod, close_time: event.target.value } : entryPeriod
                                            ),
                                          }
                                        : entry
                                    )
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setExceptions((prev) =>
                                  prev.map((entry, idx) =>
                                    idx === exceptionIndex
                                      ? { ...entry, periods: entry.periods.filter((_, entryIndex) => entryIndex !== periodIndex) }
                                      : entry
                                  )
                                )
                              }
                              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() =>
                            setExceptions((prev) =>
                              prev.map((entry, idx) =>
                                idx === exceptionIndex
                                  ? {
                                      ...entry,
                                      periods: [...entry.periods, { open_time: '09:00', close_time: '17:00', sort_order: entry.periods.length }],
                                    }
                                  : entry
                              )
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-teal-200 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
                        >
                          <PlusIcon className="h-3.5 w-3.5" /> Add period
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === 'preview' && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-gray-900">Status & Preview</h2>
            <p className="mt-1 text-sm text-gray-500">Special dates override weekly hours for matching calendar dates.</p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Weekly periods</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{totalWeeklyPeriods}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Closed weekdays</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{closedWeeklyDays}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Special date overrides</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{exceptions.length}</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Weekly hours define your normal schedule. If a special day exists for a date, that override is used instead.
              Manual availability controls such as is_open and break_until are managed elsewhere and are not changed here.
            </div>
          </section>
        )}
      </div>

      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
