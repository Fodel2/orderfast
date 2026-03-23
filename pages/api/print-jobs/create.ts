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
      console.info('[print-jobs/create] order print requested', { restaurant_id, order_id, ticket_type, source });
    }

    const result = await createPrintJobs({
      restaurantId: restaurant_id,
      orderId: order_id,
      ticketType: ticket_type,
      source,
      triggerEvent: trigger_event,
      dedupeToken: dedupe_token,
    });


    if (source === 'manual_print' && (!result.created || !result.jobIds?.length)) {
      console.warn('[print-jobs/create] manual print did not create jobs', {
        restaurant_id,
        order_id,
        ticket_type,
        source,
        reason: result.reason || null,
        created: result.created || 0,
      });
      return res.status(409).json({
        error: result.reason || 'Manual print job was not created',
        ...result,
      });
    }

    let dispatch: any = null;
    try {
      if (source === 'manual_print' && result.jobIds?.length) {
        const runs = [];
        for (const jobId of result.jobIds) {
          console.info('[print-jobs/create] immediate processing started', { restaurant_id, order_id, ticket_type, job_id: jobId });
          const jobDispatch = await processPrintQueue({
            batchSize: 1,
            restaurantId: restaurant_id,
            priorityJobId: jobId,
          });
          console.info('[print-jobs/create] dispatch success/failure', {
            restaurant_id,
            order_id,
            ticket_type,
            job_id: jobId,
            sent: jobDispatch.sent,
            failed: jobDispatch.failed,
            processed: jobDispatch.processed,
          });
          runs.push({ job_id: jobId, dispatch: jobDispatch });
        }
        dispatch = { runs };
        const failedRuns = runs.filter((run) => !run.dispatch || run.dispatch.sent < 1);
        if (failedRuns.length) {
          return res.status(500).json({
            error: 'Manual print dispatch failed',
            ...result,
            dispatch,
          });
        }
      } else {
        dispatch = await processPrintQueue({ batchSize: 5, restaurantId: restaurant_id });
      }
    } catch (dispatchError: any) {
      console.warn('[print-jobs/create] immediate dispatch failed', dispatchError);
      if (source === 'manual_print') {
        return res.status(500).json({
          error: dispatchError?.message || 'Manual print dispatch failed',
          ...result,
          dispatch,
        });
      }
    }

    return res.status(200).json({ ...result, dispatch });
  } catch (error: any) {
    console.error('[print-jobs/create] failed', error);
    return res.status(500).json({ error: error?.message || 'Failed to create print jobs' });
  }
}
