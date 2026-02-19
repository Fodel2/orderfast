import type { NextApiRequest, NextApiResponse } from 'next';
import { getExpressServiceSupabaseClient } from './_serverClient';

type Body = {
  restaurant_id?: string;
  table_number?: number;
  mode?: 'dine_in' | 'takeaway';
  entered_code?: string;
};

type ExpressOrderSettings = {
  dine_in_security_mode: 'none' | 'table_code';
  dine_in_payment_mode: 'immediate_pay' | 'open_tab';
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supaServer = getExpressServiceSupabaseClient();
  if (!supaServer) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  const body = (req.body || {}) as Body;
  const restaurantId = String(body.restaurant_id || '');
  const tableNumber = Number(body.table_number);
  const mode = body.mode || 'dine_in';

  if (
    !restaurantId ||
    !isUuid(restaurantId) ||
    !Number.isInteger(tableNumber) ||
    tableNumber <= 0 ||
    (mode !== 'dine_in' && mode !== 'takeaway')
  ) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const { data: settings, error: settingsError } = await supaServer
    .from('express_order_settings')
    .select('dine_in_security_mode,dine_in_payment_mode')
    .eq('restaurant_id', restaurantId)
    .maybeSingle<ExpressOrderSettings>();

  if (settingsError || !settings) {
    return res.status(500).json({ error: 'Failed to load express settings' });
  }

  const { data: table, error: tableError } = await supaServer
    .from('restaurant_tables')
    .select('id,table_code,enabled')
    .eq('restaurant_id', restaurantId)
    .eq('table_number', tableNumber)
    .eq('enabled', true)
    .maybeSingle<{ id: string; table_code: string | null; enabled: boolean }>();

  if (tableError) {
    return res.status(500).json({ error: 'Failed to load table details' });
  }

  if (!table) {
    return res.status(400).json({ error: 'Invalid table selection' });
  }

  if (settings.dine_in_security_mode === 'table_code') {
    const normalizedCode = String(body.entered_code || '').trim();
    if (!normalizedCode || normalizedCode !== (table.table_code || '')) {
      return res.status(400).json({ error: 'Invalid table code' });
    }
  }

  let tableSessionId: string | null = null;

  if (mode === 'dine_in' && settings.dine_in_payment_mode === 'open_tab') {
    const { data: existingSession, error: existingSessionError } = await supaServer
      .from('table_sessions')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('table_number', tableNumber)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (existingSessionError) {
      return res.status(500).json({ error: 'Failed to load table session' });
    }

    if (existingSession?.id) {
      tableSessionId = existingSession.id;
    } else {
      const { data: insertedSession, error: insertError } = await supaServer
        .from('table_sessions')
        .insert({
          restaurant_id: restaurantId,
          table_number: tableNumber,
          status: 'open',
          notes: 'Express open tab session',
        })
        .select('id')
        .single<{ id: string }>();

      if (insertError) {
        const isRaceCondition = insertError.code === '23505';
        if (!isRaceCondition) {
          return res.status(500).json({ error: 'Failed to start table session' });
        }

        const { data: racedSession, error: racedSessionError } = await supaServer
          .from('table_sessions')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('table_number', tableNumber)
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string }>();

        if (racedSessionError || !racedSession?.id) {
          return res.status(500).json({ error: 'Failed to start table session' });
        }

        tableSessionId = racedSession.id;
      } else {
        tableSessionId = insertedSession.id;
      }
    }
  }

  return res.status(200).json({
    ok: true,
    tableSessionId,
    dineInPaymentMode: settings.dine_in_payment_mode,
  });
}
