import type { NextApiRequest, NextApiResponse } from 'next';
import { processPrintQueue } from '@/lib/server/printQueueProcessor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.info('[print-jobs/process] supabase client path', {
      client: 'supaServer(service_role)',
      has_supabase_url: Boolean(process.env.SUPABASE_URL),
      has_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
    const body = req.body || {};
    const result = await processPrintQueue({
      batchSize: Number(body.batch_size || 10),
      restaurantId: body.restaurant_id || undefined,
    });
    console.info('[print-jobs/process] queue result', {
      claimed: result.claimed,
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      candidates_found: result?.diagnostics?.candidatesFound ?? null,
      due_candidates: result?.diagnostics?.dueCandidates ?? null,
      excluded_future_retry: result?.diagnostics?.excludedFutureRetry ?? null,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[print-jobs/process] failed', error);
    return res.status(500).json({ error: error?.message || 'Queue processing failed' });
  }
}
