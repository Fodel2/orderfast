import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

type Body = {
  restaurant_id?: string;
  table_number?: number;
  entered_code?: string;
  security_mode?: 'none' | 'table_code';
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body || {}) as Body;
  const restaurantId = String(body.restaurant_id || '');
  const tableNumber = Number(body.table_number);
  const securityMode = body.security_mode || 'none';

  if (!restaurantId || !isUuid(restaurantId) || !Number.isInteger(tableNumber) || tableNumber <= 0) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  if (securityMode === 'table_code') {
    const { data: isValid, error: validationError } = await supaServer.rpc('validate_table_code', {
      p_restaurant_id: restaurantId,
      p_table_number: tableNumber,
      p_entered_code: body.entered_code || '',
    });

    if (validationError) {
      return res.status(500).json({ error: 'Failed to validate table code' });
    }

    if (!isValid) {
      return res.status(403).json({ valid: false, error: 'Invalid table code' });
    }
  }

  const { data: sessionId, error: sessionError } = await supaServer.rpc('ensure_open_table_session', {
    p_restaurant_id: restaurantId,
    p_table_number: tableNumber,
    p_notes: 'Express open tab session',
  });

  if (sessionError || !sessionId) {
    return res.status(500).json({ error: 'Failed to start table session' });
  }

  return res.status(200).json({ valid: true, table_session_id: sessionId });
}
