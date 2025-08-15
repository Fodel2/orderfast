import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '../../../lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const restaurantId = (req.method === 'GET' ? req.query.restaurant_id : req.body?.restaurant_id) as string | undefined;
  if (!restaurantId) {
    return res.status(400).json({ error: 'Missing restaurant_id' });
  }

  let supabase;
  try {
    supabase = supabaseServer();
  } catch (err) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('menu_builder_drafts')
        .select('payload')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        await supabase
          .from('menu_builder_drafts')
          .insert({ restaurant_id: restaurantId, payload: { categories: [], items: [] } });
        return res.status(200).json({ categories: [], items: [] });
      }
      const payload = data.payload || { categories: [], items: [] };
      return res.status(200).json(payload);
    }

    if (req.method === 'PUT') {
      const { categories, items } = req.body as { categories?: any[]; items?: any[] };
      const payload = {
        categories: Array.isArray(categories) ? categories : [],
        items: Array.isArray(items) ? items : [],
      };
      const { error } = await supabase
        .from('menu_builder_drafts')
        .upsert({ restaurant_id: restaurantId, payload }, { onConflict: 'restaurant_id' });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET,PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[draft]', err);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}

