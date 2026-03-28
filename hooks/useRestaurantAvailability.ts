import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useRestaurantAvailability(restaurantId?: string | null) {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [breakUntil, setBreakUntil] = useState<string | null>(null);
  const [overrideMode, setOverrideMode] = useState<'none' | 'manual_closed' | 'on_break'>('none');
  const [overrideUntil, setOverrideUntil] = useState<string | null>(null);
  const [showBreakModal, setShowBreakModal] = useState(false);

  const applyRow = useCallback(
    (row: {
      availability_override_mode?: string | null;
      availability_override_until?: string | null;
      is_open?: boolean | null;
      break_until?: string | null;
    }) => {
      const mode =
        row.availability_override_mode === 'manual_closed' || row.availability_override_mode === 'on_break'
          ? row.availability_override_mode
          : 'none';
      const until = row.availability_override_until ?? row.break_until ?? null;
      setOverrideMode(mode);
      setOverrideUntil(until);
      setIsOpen(mode !== 'manual_closed');
      setBreakUntil(until);
    },
    []
  );

  useEffect(() => {
    if (!restaurantId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('availability_override_mode, availability_override_until, is_open, break_until')
        .eq('id', restaurantId)
        .single();
      if (!error && data) {
        applyRow(data);
      }
    };
    load();
  }, [applyRow, restaurantId]);

  const endBreak = useCallback(async () => {
    if (!restaurantId) return;
    const { error } = await supabase
      .from('restaurants')
      .update({
        availability_override_mode: 'none',
        availability_override_until: null,
        is_open: true,
        break_until: null,
      })
      .eq('id', restaurantId);
    if (!error) {
      setIsOpen(true);
      setBreakUntil(null);
      setOverrideMode('none');
      setOverrideUntil(null);
    }
  }, [restaurantId]);

  const startBreak = useCallback(
    async (mins: number) => {
      if (!restaurantId) return;
      const until = new Date(Date.now() + mins * 60000).toISOString();
      const { error } = await supabase
        .from('restaurants')
        .update({
          availability_override_mode: 'on_break',
          availability_override_until: until,
          is_open: true,
          break_until: until,
        })
        .eq('id', restaurantId);
      if (!error) {
        setIsOpen(true);
        setBreakUntil(until);
        setOverrideMode('on_break');
        setOverrideUntil(until);
      }
    },
    [restaurantId]
  );

  const toggleOpen = useCallback(async () => {
    if (!restaurantId || isOpen === null) return;
    const manuallyClosed = overrideMode === 'manual_closed';
    const { error } = await supabase
      .from('restaurants')
      .update(
        manuallyClosed
          ? {
              availability_override_mode: 'none',
              availability_override_until: null,
              is_open: true,
              break_until: null,
            }
          : {
              availability_override_mode: 'manual_closed',
              availability_override_until: null,
              is_open: false,
              break_until: null,
            }
      )
      .eq('id', restaurantId);
    if (!error) {
      setIsOpen(manuallyClosed);
      setBreakUntil(null);
      setOverrideMode(manuallyClosed ? 'none' : 'manual_closed');
      setOverrideUntil(null);
    }
  }, [isOpen, overrideMode, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel('restaurant-' + restaurantId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `id=eq.${restaurantId}`,
        },
        (payload) => {
          const newRow = payload.new as {
            availability_override_mode?: string | null;
            availability_override_until?: string | null;
            is_open?: boolean | null;
            break_until?: string | null;
          };
          applyRow(newRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyRow, restaurantId]);

  return {
    isOpen,
    breakUntil,
    overrideMode,
    overrideUntil,
    showBreakModal,
    setShowBreakModal,
    toggleOpen,
    startBreak,
    endBreak,
  };
}
