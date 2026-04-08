import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveRestaurantIdFromSession } from '@/lib/server/payments/stripeConnectService';
import { createInternalSettlementSession, type InternalSettlementMode } from '@/lib/server/payments/internalSettlementService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const restaurantId = await resolveRestaurantIdFromSession(req, res);
  if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const flowRunId = req.body?.flow_run_id ? String(req.body.flow_run_id) : null;
    console.info('[internal-settlement][api]', {
      route: 'create-session',
      stage: 'session_create.start',
      at: new Date().toISOString(),
      restaurantId,
      mode: req.body?.mode || 'order_payment',
      flowRunId,
    });
    const mode = (req.body?.mode || 'order_payment') as InternalSettlementMode;
    const result = await createInternalSettlementSession({
      restaurantId,
      mode,
      idempotencyKey: String(req.body?.idempotency_key || ''),
      orderId: req.body?.order_id ? String(req.body.order_id) : null,
      amountCents: req.body?.amount_cents == null ? null : Number(req.body.amount_cents),
      currency: req.body?.currency ? String(req.body.currency) : 'gbp',
      note: req.body?.note ? String(req.body.note) : null,
      reference: req.body?.reference ? String(req.body.reference) : null,
    });

    console.info('[internal-settlement][api]', {
      route: 'create-session',
      stage: 'session_create.result',
      at: new Date().toISOString(),
      restaurantId,
      flowRunId,
      sessionId: result?.session?.id || null,
      state: result?.session?.state || null,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Failed to create settlement session' });
  }
}
