import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type PauseOption = 10 | 20 | 30 | 60 | 'until_reopened';

export function useRestaurantAvailability(restaurantId?: string | null) {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [breakUntil, setBreakUntil] = useState<string | null>(null);
  const [overrideMode, setOverrideMode] = useState<'none' | 'manual_closed' | 'on_break'>('none');
  const [overrideUntil, setOverrideUntil] = useState<string | null>(null);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

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

  const refreshConfirmedState = useCallback(async () => {
    if (!restaurantId) return false;
    const { data, error } = await supabase
      .from('restaurants')
      .select('availability_override_mode, availability_override_until, is_open, break_until')
      .eq('id', restaurantId)
      .single();
    if (error || !data) {
      return false;
    }
    applyRow(data);
    return true;
  }, [applyRow, restaurantId]);

  const commitAvailabilityUpdate = useCallback(
    async (payload: {
      availability_override_mode: 'none' | 'manual_closed' | 'on_break';
      availability_override_until: string | null;
      is_open: boolean;
      break_until: string | null;
    }) => {
      if (!restaurantId || isConfirmingAction) return false;
      setIsConfirmingAction(true);
      const { error } = await supabase.from('restaurants').update(payload).eq('id', restaurantId);
      const confirmed = await refreshConfirmedState();
      setIsConfirmingAction(false);
      return !error && confirmed;
    },
    [isConfirmingAction, refreshConfirmedState, restaurantId]
  );

  const endBreak = useCallback(async () => {
    await commitAvailabilityUpdate({
      availability_override_mode: 'none',
      availability_override_until: null,
      is_open: true,
      break_until: null,
    });
  }, [commitAvailabilityUpdate]);

  const startBreak = useCallback(
    async (selection: PauseOption) => {
      if (!restaurantId) return;
      const isTemporaryPause = selection !== 'until_reopened';
      const until = isTemporaryPause ? new Date(Date.now() + selection * 60000).toISOString() : null;
      const ok = await commitAvailabilityUpdate({
        availability_override_mode: isTemporaryPause ? 'on_break' : 'manual_closed',
        availability_override_until: until,
        is_open: false,
        break_until: until,
      });
      if (ok) {
        setShowBreakModal(false);
      }
    },
    [commitAvailabilityUpdate, restaurantId]
  );

  const toggleOpen = useCallback(async () => {
    if (!restaurantId || isOpen === null) return;
    const isPaused = overrideMode === 'manual_closed' || overrideMode === 'on_break';
    await commitAvailabilityUpdate(
      isPaused
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
    );
  }, [commitAvailabilityUpdate, isOpen, overrideMode, restaurantId]);

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
    isConfirmingAction,
  };
}
