import type { NextApiRequest, NextApiResponse } from 'next';
import { createOrRetrieveCardPresentPaymentIntentForSession } from '@/lib/server/payments/kioskCardPresentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { session_id, restaurant_id, flow_run_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id is required' });

    const paymentIntent = await createOrRetrieveCardPresentPaymentIntentForSession({
      sessionId: String(session_id),
      restaurantId: restaurant_id ? String(restaurant_id) : null,
      flowRunId: flow_run_id ? String(flow_run_id) : null,
    });

    console.info('[kiosk][payment_intent_result]', {
      session_id: String(session_id),
      restaurant_id: restaurant_id ? String(restaurant_id) : null,
      flow_run_id: flow_run_id ? String(flow_run_id) : null,
      payment_intent_id: paymentIntent.paymentIntentId,
      status: paymentIntent.status,
    });
    return res.status(200).json(paymentIntent);
  } catch (error: any) {
    const detail = error?.message || 'Failed to create/retrieve payment intent';
    console.error('[kiosk][payment_intent_result] failed', {
      session_id: req.body?.session_id ? String(req.body.session_id) : null,
      restaurant_id: req.body?.restaurant_id ? String(req.body.restaurant_id) : null,
      error: detail,
    });
    return res.status(400).json({ error: detail });
  }
}
