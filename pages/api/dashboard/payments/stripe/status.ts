import type { NextApiRequest, NextApiResponse } from 'next';
import { getStripeConnectionStatus, resolveRestaurantIdFromSession } from '@/lib/server/payments/stripeConnectService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const restaurantId = await resolveRestaurantIdFromSession(req, res);
  if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const payload = await getStripeConnectionStatus(restaurantId);
    return res.status(200).json(payload);
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to fetch Stripe status' });
  }
}
