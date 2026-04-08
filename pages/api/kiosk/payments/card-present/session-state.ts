import type { NextApiRequest, NextApiResponse } from 'next';
import { isKioskSessionState, markKioskPaymentSessionState } from '@/lib/server/payments/kioskCardPresentService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { session_id, restaurant_id, next_state, failure_code, failure_message, event_type, flow_run_id } = req.body || {};
    if (!session_id || !next_state || !isKioskSessionState(String(next_state))) {
      return res.status(400).json({ error: 'session_id and valid next_state are required' });
    }
    if (next_state === 'finalized' || next_state === 'succeeded') {
      return res.status(400).json({
        error: 'finalized/succeeded cannot be set directly; use Stripe-verified finalize flow',
      });
    }

    const session = await markKioskPaymentSessionState({
      sessionId: String(session_id),
      restaurantId: restaurant_id ? String(restaurant_id) : null,
      nextState: next_state,
      failureCode: failure_code ? String(failure_code) : null,
      failureMessage: failure_message ? String(failure_message) : null,
      eventType: event_type ? String(event_type) : 'state_transition',
      eventPayload: flow_run_id ? { flow_run_id: String(flow_run_id) } : undefined,
    });

    return res.status(200).json({ session });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Failed to mark state' });
  }
}
