import type { NextApiRequest, NextApiResponse } from 'next';
import { createPrintJobs, type PrintJobSource } from '@/lib/server/printJobs';
import { processPrintQueue } from '@/lib/server/printQueueProcessor';

const validSources: PrintJobSource[] = ['auto', 'manual_print', 'manual_reprint', 'retry', 'test'];
const validTicketTypes = ['kot', 'invoice'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { restaurant_id, order_id, ticket_type, source, trigger_event, dedupe_token } = req.body || {};

    if (!restaurant_id || !order_id || !ticket_type || !source) {
      return res.status(400).json({ error: 'restaurant_id, order_id, ticket_type, source are required' });
    }
    if (!validTicketTypes.includes(ticket_type)) {
      return res.status(400).json({ error: 'Invalid ticket_type' });
    }
    if (!validSources.includes(source)) {
      return res.status(400).json({ error: 'Invalid source' });
    }

    if (source === 'manual_print') {
      console.info(`[print-jobs/create] manual ${ticket_type} print triggered`, { restaurant_id, order_id });
    }

    const result = await createPrintJobs({
      restaurantId: restaurant_id,
      orderId: order_id,
      ticketType: ticket_type,
      source,
      triggerEvent: trigger_event,
      dedupeToken: dedupe_token,
    });

    let dispatch: any = null;
    try {
      if (result.jobIds?.length) {
        console.info('[print-jobs/create] job processed immediately', { restaurant_id, order_id, ticket_type, job_ids: result.jobIds });
      }
      dispatch = await processPrintQueue({ batchSize: Math.max(5, result.jobIds?.length || 0), restaurantId: restaurant_id, priorityJobIds: result.jobIds || [] });
    } catch (dispatchError) {
      console.warn('[print-jobs/create] immediate dispatch failed', dispatchError);
    }

    return res.status(200).json({ ...result, dispatch });
  } catch (error: any) {
    console.error('[print-jobs/create] failed', error);
    return res.status(500).json({ error: error?.message || 'Failed to create print jobs' });
  }
}
