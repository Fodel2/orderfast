import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveServerKioskTerminalMode } from '@/lib/kiosk/terminalMode';
import { simulateSuccessfulKioskPaymentSession } from '@/lib/server/payments/kioskCardPresentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { session_id, restaurant_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });

    const mode = resolveServerKioskTerminalMode();
    if (mode !== 'simulated_terminal') {
      return res.status(403).json({ error: 'Simulated terminal completion is disabled in this environment' });
    }

    const session = await simulateSuccessfulKioskPaymentSession({
      sessionId: String(session_id),
      restaurantId: restaurant_id ? String(restaurant_id) : null,
    });

    return res.status(200).json({ session, terminal_mode: mode });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Failed to simulate terminal completion' });
  }
}
