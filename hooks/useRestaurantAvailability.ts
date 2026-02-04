import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useRestaurantAvailability(restaurantId?: string | null) {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [breakUntil, setBreakUntil] = useState<string | null>(null);
  const [showBreakModal, setShowBreakModal] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('is_open, break_until')
        .eq('id', restaurantId)
        .single();
      if (!error && data) {
        setIsOpen(data.is_open);
        setBreakUntil(data.break_until);
      }
    };
    load();
  }, [restaurantId]);

  const endBreak = useCallback(async () => {
    if (!restaurantId) return;
    const { error } = await supabase
      .from('restaurants')
      .update({ is_open: true, break_until: null })
      .eq('id', restaurantId);
    if (!error) {
      setIsOpen(true);
      setBreakUntil(null);
    }
  }, [restaurantId]);

  const startBreak = useCallback(
    async (mins: number) => {
      if (!restaurantId) return;
      const until = new Date(Date.now() + mins * 60000).toISOString();
      const { error } = await supabase
        .from('restaurants')
        .update({ is_open: false, break_until: until })
        .eq('id', restaurantId);
      if (!error) {
        setIsOpen(false);
        setBreakUntil(until);
      }
    },
    [restaurantId]
  );

  const toggleOpen = useCallback(async () => {
    if (!restaurantId || isOpen === null) return;
    if (!isOpen && breakUntil && new Date(breakUntil).getTime() > Date.now()) {
      await endBreak();
      return;
    }
    const newState = !isOpen;
    const { error } = await supabase
      .from('restaurants')
      .update({ is_open: newState })
      .eq('id', restaurantId);
    if (!error) {
      setIsOpen(newState);
    }
  }, [breakUntil, endBreak, isOpen, restaurantId]);

  useEffect(() => {
    if (!breakUntil) return;
    if (new Date(breakUntil).getTime() <= Date.now()) {
      void endBreak();
      return;
    }
    const timer = setInterval(() => {
      if (breakUntil && new Date(breakUntil).getTime() <= Date.now()) {
        void endBreak();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [breakUntil, endBreak]);

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
          const newRow = payload.new as { is_open?: boolean | null; break_until?: string | null };
          if (typeof newRow.is_open === 'boolean') {
            setIsOpen(newRow.is_open);
          }
          if (typeof newRow.break_until !== 'undefined') {
            setBreakUntil(newRow.break_until ?? null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return {
    isOpen,
    breakUntil,
    showBreakModal,
    setShowBreakModal,
    toggleOpen,
    startBreak,
    endBreak,
  };
}
