import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const restaurantId = String(req.query.restaurant_id || '');
  if (!restaurantId || !isUuid(restaurantId)) {
    return res.status(400).json({ error: 'Invalid restaurant_id' });
  }

  const [{ data: settings, error: settingsError }, { data: tables, error: tableError }] = await Promise.all([
    supaServer
      .from('express_order_settings')
      .select('enabled,enable_takeaway,enable_dine_in,dine_in_security_mode,dine_in_payment_mode')
      .eq('restaurant_id', restaurantId)
      .maybeSingle(),
    supaServer
      .from('restaurant_tables')
      .select('id,table_number,table_name,enabled')
      .eq('restaurant_id', restaurantId)
      .eq('enabled', true)
      .order('table_number', { ascending: true }),
  ]);

  if (settingsError || tableError) {
    return res.status(500).json({ error: 'Failed to load express entry data' });
  }

  return res.status(200).json({
    settings: settings || null,
    tables: tables || [],
  });
}
