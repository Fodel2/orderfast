import type { NextApiRequest, NextApiResponse } from 'next';
import { reconcileAbandonedOrUnknownKioskPaymentSession, verifyKioskSessionPaymentCompletion } from '@/lib/server/payments/kioskCardPresentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { session_id, restaurant_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });

    const session = await reconcileAbandonedOrUnknownKioskPaymentSession({
      sessionId: String(session_id),
      restaurantId: restaurant_id ? String(restaurant_id) : null,
    });

    const verification = await verifyKioskSessionPaymentCompletion(session);

    return res.status(200).json({ session, verification });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Failed to reconcile session' });
  }
}
