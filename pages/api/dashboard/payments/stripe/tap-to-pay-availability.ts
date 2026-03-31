import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveRestaurantIdFromSession } from '@/lib/server/payments/stripeConnectService';
import { isTapToPayAvailableForRestaurant } from '@/lib/server/payments/restaurantStripeContext';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const restaurantId = await resolveRestaurantIdFromSession(req, res);
  if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const tap_to_pay_available = await isTapToPayAvailableForRestaurant(restaurantId);
    return res.status(200).json({ tap_to_pay_available });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to fetch Tap to Pay availability' });
  }
}
