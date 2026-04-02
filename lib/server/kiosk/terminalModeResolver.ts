import { normalizeKioskTerminalMode, resolveServerDefaultKioskTerminalMode, type KioskTerminalMode } from '@/lib/kiosk/terminalMode';
import { supaServer } from '@/lib/supaServer';

export const resolveRestaurantTerminalMode = async (restaurantId: string): Promise<KioskTerminalMode> => {
  const { data, error } = await supaServer
    .from('kiosk_payment_settings')
    .select('terminal_mode')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) {
    console.error('[kiosk][terminal_mode] failed to load restaurant mode', { restaurant_id: restaurantId, error: error.message });
    return resolveServerDefaultKioskTerminalMode();
  }

  const configured = normalizeKioskTerminalMode((data as { terminal_mode?: string | null } | null)?.terminal_mode);
  return configured || resolveServerDefaultKioskTerminalMode();
};
