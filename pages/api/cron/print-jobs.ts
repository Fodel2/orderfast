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
    const result = await processPrintQueue({ batchSize: 15 });
    return res.status(200).json({ ok: true, ...result });
  } catch (error: any) {
    console.error('[cron/print-jobs] failed', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Cron queue processing failed' });
  }
}
