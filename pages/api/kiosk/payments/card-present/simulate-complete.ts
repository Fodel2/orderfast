import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveRestaurantTerminalMode } from '@/lib/server/kiosk/terminalModeResolver';
import { simulateSuccessfulKioskPaymentSession } from '@/lib/server/payments/kioskCardPresentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { session_id, restaurant_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });
    if (!restaurant_id) return res.status(400).json({ error: 'restaurant_id is required' });

    const mode = await resolveRestaurantTerminalMode(String(restaurant_id));
    if (mode !== 'simulated_terminal') {
      return res.status(403).json({ error: 'Simulated terminal completion is disabled for this restaurant' });
    }

    const session = await simulateSuccessfulKioskPaymentSession({
      sessionId: String(session_id),
      restaurantId: String(restaurant_id),
    });

    return res.status(200).json({ session, terminal_mode: mode });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Failed to simulate terminal completion' });
  }
}
