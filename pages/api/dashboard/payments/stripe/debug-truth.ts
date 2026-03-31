import type { NextApiRequest, NextApiResponse } from 'next';
import { getStripeDebugTruth, resolveRestaurantIdFromSession } from '@/lib/server/payments/stripeConnectService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const restaurantId = await resolveRestaurantIdFromSession(req, res);
  if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

  const debugRestaurantId = process.env.STRIPE_CONNECT_DEBUG_RESTAURANT_ID;
  if (debugRestaurantId && restaurantId !== debugRestaurantId) {
    return res.status(403).json({ message: 'Debug endpoint is not enabled for this restaurant.' });
  }

  try {
    const payload = await getStripeDebugTruth(restaurantId);
    console.info('[stripe-connect-debug-truth]', payload);
    return res.status(200).json(payload);
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to fetch Stripe debug truth' });
  }
}
