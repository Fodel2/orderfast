import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/DashboardLayout';
import Toast from '../../../components/Toast';
import ResponsiveSectionNav, {
  type SectionItem,
} from '../../../components/dashboard/settings/ResponsiveSectionNav';
import { supabase } from '../../../utils/supabaseClient';

const SECTION_ITEMS = [
  { key: 'regular-hours', label: 'Regular Hours' },
  { key: 'live-preview', label: 'Live Status Preview' },
] as const satisfies readonly SectionItem[];

type OpeningHoursSection = (typeof SECTION_ITEMS)[number]['key'];

type HoursRow = {
  id: string | null;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
};

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const isValidSection = (value: string): value is OpeningHoursSection =>
  SECTION_ITEMS.some((item) => item.key === value);

const defaultRow = (day: number): HoursRow => ({
  id: null,
  day_of_week: day,
  open_time: '09:00:00',
  close_time: '17:00:00',
  is_closed: false,
});

export default function DashboardSettingsOpeningHoursPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [activeSection, setActiveSection] = useState<OpeningHoursSection>('regular-hours');
  const [hours, setHours] = useState<HoursRow[]>(Array.from({ length: 7 }, (_, i) => defaultRow(i)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const querySection = String(router.query.section || '').toLowerCase();
    if (querySection && isValidSection(querySection)) {
      setActiveSection(querySection);
    }
  }, [router.query.section]);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const { data: membership } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!membership?.restaurant_id) {
        setLoading(false);
        return;
      }

      setRestaurantId(membership.restaurant_id);

      const { data, error } = await supabase
        .from('opening_hours')
        .select('id,day_of_week,open_time,close_time,is_closed')
        .eq('restaurant_id', membership.restaurant_id)
        .order('day_of_week', { ascending: true });

      if (error) {
        setToastMessage(`Failed to load opening hours: ${error.message}`);
      } else {
        const byDay = new Map<number, HoursRow>();
        (data || []).forEach((row: any) => {
          if (!byDay.has(Number(row.day_of_week))) {
            byDay.set(Number(row.day_of_week), {
              id: row.id,
              day_of_week: Number(row.day_of_week),
              open_time: row.open_time,
              close_time: row.close_time,
              is_closed: !!row.is_closed,
            });
          }
        });

        setHours(Array.from({ length: 7 }, (_, day) => byDay.get(day) || defaultRow(day)));
      }

      setLoading(false);
    };

    load();
  }, [router]);

  const setSection = (next: string) => {
    if (!isValidSection(next)) return;
    setActiveSection(next);
    router.replace(
      {
        pathname: '/dashboard/settings/opening-hours',
        query: { section: next },
      },
      undefined,
      { shallow: true }
    );
  };

  const updateRow = (day: number, patch: Partial<HoursRow>) => {
    setHours((prev) => prev.map((row) => (row.day_of_week === day ? { ...row, ...patch } : row)));
  };

  const applyMondayToAll = () => {
    const monday = hours.find((row) => row.day_of_week === 1) || defaultRow(1);
    setHours((prev) =>
      prev.map((row) => ({
        ...row,
        open_time: monday.open_time,
        close_time: monday.close_time,
        is_closed: monday.is_closed,
      }))
    );
  };

  const saveHours = async () => {
    if (!restaurantId) return;
    setSaving(true);

    try {
      for (const row of hours) {
        const payload = {
          restaurant_id: restaurantId,
          day_of_week: row.day_of_week,
          open_time: row.is_closed ? null : row.open_time,
          close_time: row.is_closed ? null : row.close_time,
          is_closed: row.is_closed,
        };

        if (row.id) {
          const { error } = await supabase
            .from('opening_hours')
            .update(payload)
            .eq('id', row.id)
            .eq('restaurant_id', restaurantId);

          if (error) throw error;
        } else {
          const { data: inserted, error } = await supabase
            .from('opening_hours')
            .insert(payload)
            .select('id,day_of_week,open_time,close_time,is_closed')
            .single();

          if (error) throw error;

          updateRow(row.day_of_week, {
            id: inserted.id,
            open_time: inserted.open_time,
            close_time: inserted.close_time,
            is_closed: !!inserted.is_closed,
          });
        }
      }

      setToastMessage('Opening hours saved.');
    } catch (error: any) {
      setToastMessage(`Failed to save opening hours: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().getDay();
  const todayRow = hours.find((row) => row.day_of_week === today) || null;

  const statusPreview = useMemo(() => {
    if (!todayRow) return { label: 'Loading…', detail: '' };
    if (todayRow.is_closed || !todayRow.open_time || !todayRow.close_time) {
      return {
        label: 'Closed now',
        detail: `${DAYS[today]} is marked closed.`,
      };
    }

    const now = new Date();
    const [oh, om] = todayRow.open_time.split(':').map(Number);
    const [ch, cm] = todayRow.close_time.split(':').map(Number);
    const openDate = new Date();
    openDate.setHours(oh, om, 0, 0);
    const closeDate = new Date();
    closeDate.setHours(ch, cm, 0, 0);

    const formatTime = (t: string) => {
      const d = new Date(`1970-01-01T${t}`);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    if (now < openDate) {
      return {
        label: 'Closed now',
        detail: `Opens today at ${formatTime(todayRow.open_time)}.`,
      };
    }

    if (now > closeDate) {
      return {
        label: 'Closed now',
        detail: `Closed at ${formatTime(todayRow.close_time)} today.`,
      };
    }

    return {
      label: 'Open now',
      detail: `Closes today at ${formatTime(todayRow.close_time)}.`,
    };
  }, [today, todayRow]);

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;

  if (!restaurantId) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto space-y-4">
          <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
            ← Back to Settings
          </Link>
          <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-600">
            We could not find your restaurant settings right now.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
            ← Settings Home
          </Link>
          <h1 className="text-3xl font-bold">Opening Hours</h1>
          <p className="text-sm text-gray-600">Manage weekly service windows used by dashboard status surfaces.</p>
        </div>

        <div className="space-y-4">
          <ResponsiveSectionNav
            items={SECTION_ITEMS as unknown as SectionItem[]}
            value={activeSection}
            onChange={setSection}
            ariaLabel="Opening hours sections"
          />

          {activeSection === 'regular-hours' && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Regular Hours</h2>
                  <p className="text-sm text-gray-500">Set standard opening and closing times for each day.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyMondayToAll}
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    Apply Monday to All
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveHours()}
                    disabled={saving}
                    className="px-3 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save Hours'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {hours.map((row) => (
                  <div
                    key={row.day_of_week}
                    className="rounded-lg border border-gray-200 p-3 sm:p-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(120px,180px)_auto_1fr_1fr] sm:items-center"
                  >
                    <p className="font-semibold text-gray-900">{DAYS[row.day_of_week]}</p>

                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={row.is_closed}
                        onChange={(e) => updateRow(row.day_of_week, { is_closed: e.target.checked })}
                      />
                      Closed
                    </label>

                    <label className="text-sm">
                      <span className="block mb-1 text-gray-600">Open</span>
                      <input
                        type="time"
                        value={(row.open_time || '09:00:00').slice(0, 5)}
                        onChange={(e) => updateRow(row.day_of_week, { open_time: `${e.target.value}:00` })}
                        disabled={row.is_closed}
                        className="w-full border border-gray-300 rounded-lg p-2 disabled:bg-gray-100"
                      />
                    </label>

                    <label className="text-sm">
                      <span className="block mb-1 text-gray-600">Close</span>
                      <input
                        type="time"
                        value={(row.close_time || '17:00:00').slice(0, 5)}
                        onChange={(e) => updateRow(row.day_of_week, { close_time: `${e.target.value}:00` })}
                        disabled={row.is_closed}
                        className="w-full border border-gray-300 rounded-lg p-2 disabled:bg-gray-100"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeSection === 'live-preview' && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Live Status Preview</h2>
                <p className="text-sm text-gray-500">Customer-facing preview based on today’s opening-hours row.</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${statusPreview.label === 'Open now' ? 'bg-green-500' : 'bg-red-500'}`}
                    aria-hidden="true"
                  />
                  <p className="text-base font-semibold text-gray-900">{statusPreview.label}</p>
                </div>
                <p className="mt-2 text-sm text-gray-600">{statusPreview.detail}</p>
              </div>

              <div className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-600">
                Temporary pauses and manual open/close controls are managed separately in live operations.
              </div>
            </section>
          )}
        </div>
      </div>

      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
