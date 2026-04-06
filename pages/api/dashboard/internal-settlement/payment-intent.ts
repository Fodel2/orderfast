import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveRestaurantIdFromSession } from '@/lib/server/payments/stripeConnectService';
import { createInternalSettlementPaymentIntent } from '@/lib/server/payments/internalSettlementService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const restaurantId = await resolveRestaurantIdFromSession(req, res);
  if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sessionId = String(req.body?.session_id || '');
    if (!sessionId) return res.status(400).json({ message: 'session_id is required' });

    const paymentIntent = await createInternalSettlementPaymentIntent({ sessionId, restaurantId });
    return res.status(200).json(paymentIntent);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Failed to create payment intent' });
  }
}
