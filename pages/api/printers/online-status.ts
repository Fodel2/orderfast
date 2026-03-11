import type { NextApiRequest, NextApiResponse } from 'next';
import { getPrinterOnlineStatus } from '@/lib/server/printQueueProcessor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { printer_id, restaurant_id } = req.body || {};
  if (!printer_id || !restaurant_id) {
    return res.status(400).json({ error: 'printer_id and restaurant_id are required' });
  }

  try {
    const status = await getPrinterOnlineStatus(printer_id, restaurant_id);
    return res.status(200).json(status);
  } catch (error: any) {
    console.error('[printers/online-status] failed', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Online status check failed' });
  }
}
