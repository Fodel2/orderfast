import type { NextApiRequest, NextApiResponse } from 'next';
import { cancelKioskPaymentSession } from '@/lib/server/payments/kioskCardPresentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { session_id, restaurant_id, reason } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });

    const canceled = await cancelKioskPaymentSession({
      sessionId: String(session_id),
      restaurantId: restaurant_id ? String(restaurant_id) : null,
      reason: reason ? String(reason) : 'Canceled',
    });

    return res.status(200).json({ session: canceled });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Failed to cancel session' });
  }
}
