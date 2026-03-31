import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveRestaurantIdFromSession, syncPaymentReadiness } from '@/lib/server/payments/stripeConnectService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const restaurantId = await resolveRestaurantIdFromSession(req, res);
  if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const payload = await syncPaymentReadiness(restaurantId, true);
    return res.status(200).json(payload);
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to prepare Tap to Pay' });
  }
}
