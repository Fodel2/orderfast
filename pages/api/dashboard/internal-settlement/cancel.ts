import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveRestaurantIdFromSession } from '@/lib/server/payments/stripeConnectService';
import { cancelInternalSettlement } from '@/lib/server/payments/internalSettlementService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const restaurantId = await resolveRestaurantIdFromSession(req, res);
  if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sessionId = String(req.body?.session_id || '');
    const flowRunId = req.body?.flow_run_id ? String(req.body.flow_run_id) : null;
    const reason = req.body?.reason ? String(req.body.reason) : null;
    const failureCode = req.body?.failure_code ? String(req.body.failure_code) : null;
    const outcomeRaw = req.body?.outcome ? String(req.body.outcome) : 'canceled';
    const outcome = outcomeRaw === 'failed' || outcomeRaw === 'needs_reconciliation' ? outcomeRaw : 'canceled';
    if (!sessionId) return res.status(400).json({ message: 'session_id is required' });
    console.info('[internal-settlement][api]', { route: 'cancel', restaurantId, sessionId, flowRunId, outcome, reason, failureCode });

    const result = await cancelInternalSettlement({ sessionId, restaurantId, reason, failureCode, outcome });
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Failed to cancel settlement session' });
  }
}
