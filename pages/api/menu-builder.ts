import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

type DraftPayload = {
  categories: Array<{ id?: string; tempId?: string; name: string; description?: string|null; sort_order?: number; image_url?: string|null }>;
  items: Array<{
    id?: string; tempId?: string; name: string; description?: string|null; price?: number|null;
    image_url?: string|null; is_vegetarian?: boolean; is_vegan?: boolean; is_18_plus?: boolean;
    stock_status?: string|null; available?: boolean; category_id?: string; sort_order?: number
  }>;
  links?: Array<{ item_id: string; group_id: string }>; // IMPORTANT: group_id (schema uses group_id)
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = supaServer();

  try {
    if (req.method === 'GET') {
      const restaurantId = (req.query.restaurant_id as string) || (req.query.rid as string);
      if (!restaurantId) return res.status(400).json({ error: 'restaurant_id is required' });

      const { data, error } = await supabase
        .from('menu_builder_drafts')
        .select('payload')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) {
        console.error('[draft:load]', error);
        return res.status(500).json({ where: 'draft_load', error: error.message, code: error.code, details: error.details });
      }
      return res.status(200).json({ payload: data?.payload ?? null });
    }

    if (req.method === 'PUT') {
      const { restaurantId, draft } = req.body as { restaurantId?: string; draft?: DraftPayload };
      if (!restaurantId || !draft) return res.status(400).json({ error: 'restaurantId and draft are required' });

      const { error } = await supabase
        .from('menu_builder_drafts')
        .upsert({ restaurant_id: restaurantId, payload: draft, updated_at: new Date().toISOString() }, { onConflict: 'restaurant_id' });

      if (error) {
        console.error('[draft:save]', error);
        return res.status(500).json({ where: 'draft_save', error: error.message, code: error.code, details: error.details });
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).end('Method Not Allowed');
  } catch (e: any) {
    console.error('[draft:unhandled]', e);
    return res.status(500).json({ where: 'draft_unhandled', error: e?.message || 'server_error' });
  }
}

