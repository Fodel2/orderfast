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
    const sourceStageRaw = req.body?.source_stage ? String(req.body.source_stage) : 'unknown';
    const sourceStage =
      sourceStageRaw === 'collect_or_process' || sourceStageRaw === 'manual_cancel' ? sourceStageRaw : 'unknown';
    const outcomeRaw = req.body?.outcome ? String(req.body.outcome) : 'canceled';
    const outcome = outcomeRaw === 'failed' || outcomeRaw === 'needs_reconciliation' ? outcomeRaw : 'canceled';
    const nativeResultRaw = req.body?.native_result && typeof req.body.native_result === 'object' ? req.body.native_result : {};
    const nativeResult = {
      status: nativeResultRaw?.status ? String(nativeResultRaw.status) : null,
      code: nativeResultRaw?.code ? String(nativeResultRaw.code) : null,
      terminalCode: nativeResultRaw?.terminal_code ? String(nativeResultRaw.terminal_code) : null,
      nativeStage: nativeResultRaw?.native_stage ? String(nativeResultRaw.native_stage) : null,
      stripeTakeoverActive: nativeResultRaw?.stripe_takeover_active === true,
      appBackgrounded: nativeResultRaw?.app_backgrounded === true,
      definitiveCustomerCancelSignal: nativeResultRaw?.definitive_customer_cancel_signal === true,
      paymentIntentId: nativeResultRaw?.payment_intent_id ? String(nativeResultRaw.payment_intent_id) : null,
      paymentIntentStatus: nativeResultRaw?.payment_intent_status ? String(nativeResultRaw.payment_intent_status) : null,
      paymentIntentSource: nativeResultRaw?.payment_intent_source ? String(nativeResultRaw.payment_intent_source) : null,
    };
    if (!sessionId) return res.status(400).json({ message: 'session_id is required' });
    console.info('[internal-settlement][api]', {
      route: 'cancel',
      stage: 'cancel_or_outcome_write',
      at: new Date().toISOString(),
      restaurantId,
      sessionId,
      flowRunId,
      outcome,
      reason,
      failureCode,
      sourceStage,
      nativeResult,
    });

    const result = await cancelInternalSettlement({ sessionId, restaurantId, reason, failureCode, outcome, sourceStage, nativeResult });
    console.info('[internal-settlement][api]', {
      route: 'cancel',
      stage: 'cancel_or_outcome_write.result',
      at: new Date().toISOString(),
      restaurantId,
      sessionId,
      flowRunId,
      persistedState: result?.session?.state || null,
      persistedReason: result?.session?.failure_message || null,
      verification: result?.verification || null,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Failed to cancel settlement session' });
  }
}
