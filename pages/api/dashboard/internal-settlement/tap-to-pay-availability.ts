import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveRestaurantIdFromSession } from '@/lib/server/payments/stripeConnectService';
import { getRestaurantStripeContext } from '@/lib/server/payments/restaurantStripeContext';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const restaurantId = await resolveRestaurantIdFromSession(req, res);
  if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const context = await getRestaurantStripeContext(restaurantId);
    return res.status(200).json({
      tap_to_pay_available: !!context?.tapToPayAvailable,
      terminal_location_id: context?.terminalLocationId ?? null,
      reason: context?.paymentReadinessReason ?? null,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to resolve Tap to Pay availability' });
  }
}
