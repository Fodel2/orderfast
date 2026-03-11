import type { NextApiRequest, NextApiResponse } from 'next';
import { processPrintQueue } from '@/lib/server/printQueueProcessor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const result = await processPrintQueue({
      batchSize: Number(body.batch_size || 10),
      restaurantId: body.restaurant_id || undefined,
    });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[print-jobs/process] failed', error);
    return res.status(500).json({ error: error?.message || 'Queue processing failed' });
  }
}
