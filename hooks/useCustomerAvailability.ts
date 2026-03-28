import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { evaluateAvailability, type OpeningException, type OpeningPeriod } from '@/lib/customerAvailability';

const WEBSITE_GRACE_MESSAGES = [
  'We just closed. Speed run your order.',
  'Closing time. Final boss: checkout.',
  'Kitchen clocked out. Beat the timer.',
];

const KIOSK_GRACE_MESSAGES = [
  'Doors just closed. Timer is on.',
  'Closing time. Power through checkout.',
  'Last call. Beat the countdown.',
];

type Channel = 'website' | 'kiosk' | 'express';

type UseCustomerAvailabilityOptions = {
  restaurantId?: string | null;
  channel: Channel;
  sessionActive: boolean;
  graceMinutes: number;
};

function pickFunnyMessage(channel: Channel) {
  const pool = channel === 'website' ? WEBSITE_GRACE_MESSAGES : KIOSK_GRACE_MESSAGES;
  return pool[Math.floor(Math.random() * pool.length)] || pool[0];
}

export function useCustomerAvailability({ restaurantId, channel, sessionActive, graceMinutes }: UseCustomerAvailabilityOptions) {
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [breakUntil, setBreakUntil] = useState<string | null>(null);
  const [availabilityUpdatedAt, setAvailabilityUpdatedAt] = useState<string | null>(null);
  const [weeklyPeriods, setWeeklyPeriods] = useState<Array<OpeningPeriod & { day_of_week: number }>>([]);
  const [exceptions, setExceptions] = useState<OpeningException[]>([]);
  const [tick, setTick] = useState(Date.now());
  const [graceEndAt, setGraceEndAt] = useState<number | null>(null);
  const [graceMessage, setGraceMessage] = useState('');
  const previousBlockedRef = useRef<boolean | null>(null);

  const storageKey = useMemo(() => {
    if (!restaurantId) return null;
    return `orderfast-grace-${channel}-${restaurantId}`;
  }, [channel, restaurantId]);

  const hasActiveBreak = Boolean(breakUntil && new Date(breakUntil).getTime() > Date.now());
  const hasActiveGrace = Boolean(graceEndAt && graceEndAt > Date.now());
  const needsSecondResolution = hasActiveBreak || hasActiveGrace;

  useEffect(() => {
    const intervalMs = needsSecondResolution ? 1000 : 15000;
    const timer = setInterval(() => setTick(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [needsSecondResolution]);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);

      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 1);
      const end = new Date(today);
      end.setDate(today.getDate() + 7);
      const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const [restaurantRes, weeklyRes, exceptionRes] = await Promise.all([
        supabase.from('restaurants').select('is_open, break_until, updated_at').eq('id', restaurantId).maybeSingle(),
        supabase
          .from('opening_hours_weekly_periods')
          .select('day_of_week,open_time,close_time,sort_order')
          .eq('restaurant_id', restaurantId),
        supabase
          .from('opening_hours_exceptions')
          .select('exception_date,is_closed,opening_hours_exception_periods(open_time,close_time,sort_order)')
          .eq('restaurant_id', restaurantId)
          .gte('exception_date', toIso(start))
          .lte('exception_date', toIso(end)),
      ]);

      if (!active) return;

      setIsOpen(typeof restaurantRes.data?.is_open === 'boolean' ? restaurantRes.data.is_open : true);
      setBreakUntil(restaurantRes.data?.break_until || null);
      setAvailabilityUpdatedAt(restaurantRes.data?.updated_at || null);
      setWeeklyPeriods((weeklyRes.data || []) as Array<OpeningPeriod & { day_of_week: number }>);
      setExceptions(
        ((exceptionRes.data || []) as any[]).map((row) => ({
          exception_date: row.exception_date,
          is_closed: Boolean(row.is_closed),
          periods: (row.opening_hours_exception_periods || []) as OpeningPeriod[],
        }))
      );
      setLoading(false);
    };

    void load();

    const channelRef = supabase
      .channel(`customer-availability-${restaurantId}-${channel}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `id=eq.${restaurantId}`,
        },
        (payload) => {
          const next = payload.new as { is_open?: boolean; break_until?: string | null; updated_at?: string | null };
          if (typeof next.is_open === 'boolean') setIsOpen(next.is_open);
          if (typeof next.break_until !== 'undefined') setBreakUntil(next.break_until || null);
          if (typeof next.updated_at !== 'undefined') setAvailabilityUpdatedAt(next.updated_at || null);
        }
      )
      .subscribe();

    const scheduleRef = supabase
      .channel(`customer-availability-schedule-${restaurantId}-${channel}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opening_hours_weekly_periods', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          void load();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opening_hours_exceptions', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          void load();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'opening_hours_exception_periods' },
        () => {
          void load();
        }
      )
      .subscribe();

    const scheduleRefreshTimer = window.setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      active = false;
      supabase.removeChannel(channelRef);
      supabase.removeChannel(scheduleRef);
      window.clearInterval(scheduleRefreshTimer);
    };
  }, [channel, restaurantId]);

  const snapshot = useMemo(
    () =>
      evaluateAvailability({
        now: new Date(tick),
        isOpen,
        breakUntil,
        availabilityUpdatedAt,
        weeklyPeriods,
        exceptions,
      }),
    [availabilityUpdatedAt, breakUntil, exceptions, isOpen, tick, weeklyPeriods]
  );

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem(storageKey);
    if (!stored) return;
    const storedTime = Number(stored);
    if (!Number.isFinite(storedTime) || storedTime <= Date.now()) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }
    setGraceEndAt(storedTime);
    setGraceMessage(pickFunnyMessage(channel));
  }, [channel, storageKey]);

  useEffect(() => {
    const blocked = snapshot.blocksNewSessions;
    const previous = previousBlockedRef.current;

    if (previous === false && blocked && sessionActive) {
      const endAt = Date.now() + graceMinutes * 60_000;
      setGraceEndAt(endAt);
      setGraceMessage(pickFunnyMessage(channel));
      if (storageKey && typeof window !== 'undefined') {
        window.sessionStorage.setItem(storageKey, String(endAt));
      }
    }

    if (!blocked) {
      setGraceEndAt(null);
      if (storageKey && typeof window !== 'undefined') {
        window.sessionStorage.removeItem(storageKey);
      }
    }

    previousBlockedRef.current = blocked;
  }, [channel, graceMinutes, sessionActive, snapshot.blocksNewSessions, storageKey]);

  const graceRemainingMs = graceEndAt ? Math.max(0, graceEndAt - tick) : 0;
  const graceActive = sessionActive && snapshot.blocksNewSessions && graceRemainingMs > 0;
  const canSubmitActiveSession = !snapshot.blocksNewSessions || graceActive;

  const countdownLabel =
    graceRemainingMs > 0
      ? `${String(Math.floor(graceRemainingMs / 60000)).padStart(2, '0')}:${String(
          Math.floor((graceRemainingMs % 60000) / 1000)
        ).padStart(2, '0')}`
      : '00:00';

  return {
    loading,
    snapshot,
    graceActive,
    graceMessage,
    countdownLabel,
    canStartNewSession: !snapshot.blocksNewSessions,
    canSubmitActiveSession,
  };
}
