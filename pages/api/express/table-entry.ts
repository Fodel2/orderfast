import type { NextApiRequest, NextApiResponse } from 'next';
import { getExpressServiceSupabaseClient } from './_serverClient';

type Body = {
  restaurant_id?: string;
  table_number?: number | null;
  mode?: 'dine_in' | 'takeaway';
};

type ExpressOrderSettings = {
  dine_in_security_mode: 'none' | 'table_code';
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
  const mode = body.mode || 'dine_in';
  const hasTableNumber = Number.isInteger(body.table_number) && Number(body.table_number) > 0;
  const tableNumber = hasTableNumber ? Number(body.table_number) : null;

  if (!restaurantId || !isUuid(restaurantId) || (mode !== 'dine_in' && mode !== 'takeaway')) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const { data: settings, error: settingsError } = await supaServer
    .from('express_order_settings')
    .select('dine_in_security_mode')
    .eq('restaurant_id', restaurantId)
    .maybeSingle<ExpressOrderSettings>();

  if (settingsError || !settings) {
    return res.status(500).json({ error: 'Failed to load express settings' });
  }

  const enableTableNumbers = settings.dine_in_security_mode === 'table_code';

  if (mode === 'dine_in' && enableTableNumbers) {
    if (!tableNumber) {
      return res.status(400).json({ error: 'Please select a table' });
    }

    const { data: table, error: tableError } = await supaServer
      .from('restaurant_tables')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('table_number', tableNumber)
      .eq('enabled', true)
      .maybeSingle<{ id: string }>();

    if (tableError) {
      return res.status(500).json({ error: 'Failed to load table details' });
    }

    if (!table) {
      return res.status(400).json({ error: 'Invalid table selection' });
    }
  }

  return res.status(200).json({
    ok: true,
    tableSessionId: null,
    dineInPaymentMode: 'immediate_pay',
  });
}
