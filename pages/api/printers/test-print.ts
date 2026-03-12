import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';
import { processPrintQueue } from '@/lib/server/printQueueProcessor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { restaurant_id, printer_id } = req.body || {};
  if (!restaurant_id || !printer_id) {
    return res.status(400).json({ error: 'restaurant_id and printer_id are required' });
  }

  try {
    const [{ data: printer }, { data: restaurant }, { data: settings }] = await Promise.all([
      supaServer
        .from('printers')
        .select('id,name,provider,serial_number,restaurant_id')
        .eq('id', printer_id)
        .eq('restaurant_id', restaurant_id)
        .maybeSingle(),
      supaServer.from('restaurants').select('name').eq('id', restaurant_id).maybeSingle(),
      supaServer
        .from('printer_settings')
        .select('voice_alert_enabled,voice_message')
        .eq('restaurant_id', restaurant_id)
        .maybeSingle(),
    ]);

    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    const { data: inserted, error: insertError } = await supaServer
      .from('print_jobs')
      .insert({
        restaurant_id,
        order_id: null,
        print_rule_id: null,
        printer_id,
        ticket_type: 'kot',
        provider: printer.provider,
        serial_number: printer.serial_number,
        source: 'test',
        status: 'pending',
        attempts: 0,
        payload_json: {
          restaurant_name: restaurant?.name || null,
          printer_name: printer.name,
          created_at: new Date().toISOString(),
          message: 'Printer test successful',
        },
        voice_enabled: Boolean(settings?.voice_alert_enabled),
        voice_message: settings?.voice_message || null,
        scheduled_retry_at: null,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      throw insertError || new Error('Failed to create test print job');
    }

    console.info('[printers/test-print] job created', {
      restaurant_id,
      printer_id,
      job_id: inserted.id,
      source: 'test',
      ticket_type: 'kot',
    });

    console.info('[printers/test-print] queue processing started', {
      restaurant_id,
      priority_job_id: inserted.id,
      source: 'test',
    });

    const dispatch = await processPrintQueue({
      batchSize: 1,
      restaurantId: restaurant_id,
      priorityJobId: inserted.id,
    });

    console.info('[printers/test-print] queue processing finished', {
      restaurant_id,
      job_id: inserted.id,
      processed: dispatch.processed,
      sent: dispatch.sent,
      failed: dispatch.failed,
    });

    return res.status(200).json({
      ok: dispatch.sent > 0,
      job_id: inserted.id,
      job_created: true,
      processing_triggered: true,
      jobs_processed: dispatch.processed,
      dispatch,
    });
  } catch (error: any) {
    console.error('[printers/test-print] failed', {
      restaurant_id,
      printer_id,
      error,
      message: error?.message || 'Test print failed',
    });
    return res.status(500).json({
      error: error?.message || 'Test print failed',
      job_created: false,
      processing_triggered: false,
    });
  }
}
