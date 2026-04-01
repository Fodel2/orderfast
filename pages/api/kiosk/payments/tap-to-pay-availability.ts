import type { NextApiRequest, NextApiResponse } from 'next';
import { isTapToPayAvailableForRestaurant } from '@/lib/server/payments/restaurantStripeContext';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const restaurantId = String(req.query.restaurant_id || '');
    if (!restaurantId) return res.status(400).json({ error: 'restaurant_id is required' });

    const tap_to_pay_available = await isTapToPayAvailableForRestaurant(restaurantId);
    console.info('[kiosk][availability_result]', { restaurant_id: restaurantId, tap_to_pay_available });
    return res.status(200).json({ tap_to_pay_available });
  } catch (error: any) {
    const detail = error?.message || 'Failed to check readiness';
    console.error('[kiosk][availability_result] failed', {
      restaurant_id: String(req.query.restaurant_id || ''),
      error: detail,
    });
    return res.status(400).json({ error: detail });
  }
}
