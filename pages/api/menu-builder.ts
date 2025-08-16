import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerClient } from '../../lib/supaServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const debugMode =
    process.env.NODE_ENV !== 'production' &&
    (req.query.debug === '1' || req.headers['x-debug'] === '1');

  const restaurantId =
    req.method === 'GET'
      ? (req.query.restaurant_id as string | undefined)
      : (req.body?.restaurantId as string | undefined);

  if (!restaurantId) {
    return res.status(400).json({ error: 'Missing restaurant_id' });
  }

  let supabase;
  try {
    supabase = getServerClient();
  } catch {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  let step = '';
  let sqlOperation = '';
  try {
    if (req.method === 'GET') {
      step = 'fetchDraft';
      sqlOperation = 'select menu_builder_drafts';
      const { data, error } = await supabase
        .from('menu_builder_drafts')
        .select('payload')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (error) throw error;
      const payload = data?.payload || { categories: [], items: [] };
      return res.status(200).json({ payload });
    }

    if (req.method === 'PUT') {
      step = 'upsertDraft';
      sqlOperation = 'upsert menu_builder_drafts';
      const payload = req.body?.payload;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Missing payload' });
      }
      const { error } = await supabase
        .from('menu_builder_drafts')
        .upsert(
          { restaurant_id: restaurantId, payload },
          { onConflict: 'restaurant_id' }
        );
      if (error) throw error;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[menu-builder] draft saved', { rid: restaurantId });
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET,PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[menu-builder]', err);
    }
    const body: any = { error: 'Failed to process request' };
    if (debugMode) {
      body.detail = err.message;
      body.step = step;
      body.sqlOperation = sqlOperation;
    }
    return res.status(500).json(body);
  }
}

