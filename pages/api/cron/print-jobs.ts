import type { NextApiRequest, NextApiResponse } from 'next';
import { processPrintQueue } from '@/lib/server/printQueueProcessor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.info('[cron/print-jobs] supabase client path', {
      client: 'supaServer(service_role)',
      has_supabase_url: Boolean(process.env.SUPABASE_URL),
      has_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
    const result = await processPrintQueue({ batchSize: 15 });
    console.info('[cron/print-jobs] queue result', {
      claimed: result.claimed,
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      candidates_found: result?.diagnostics?.candidatesFound ?? null,
      due_candidates: result?.diagnostics?.dueCandidates ?? null,
      excluded_future_retry: result?.diagnostics?.excludedFutureRetry ?? null,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (error: any) {
    console.error('[cron/print-jobs] failed', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Cron queue processing failed' });
  }
}
