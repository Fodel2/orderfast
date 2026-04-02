import type { NextApiRequest, NextApiResponse } from 'next';
import { getKioskSessionPaymentVerification } from '@/lib/server/payments/kioskCardPresentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionId = String(req.query.session_id || '');
    const restaurantId = req.query.restaurant_id ? String(req.query.restaurant_id) : null;
    if (!sessionId) return res.status(400).json({ error: 'session_id is required' });

    const { session, verification } = await getKioskSessionPaymentVerification({ sessionId, restaurantId });

    return res.status(200).json({ session, verification });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Failed to fetch session' });
  }
}
