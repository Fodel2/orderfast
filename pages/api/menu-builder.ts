import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

const isProd = process.env.NODE_ENV === 'production';

function resolveRestaurantId(req: NextApiRequest): string | undefined {
  const q =
    (typeof req.query.restaurant_id === 'string' && req.query.restaurant_id) ||
    (typeof req.query.rid === 'string' && req.query.rid) ||
    (typeof (req.body as any)?.restaurantId === 'string' && (req.body as any).restaurantId) ||
    undefined;
  if (q) return q;
  if (!isProd) return process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID;
  return undefined;
}

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
  const restaurantId = resolveRestaurantId(req);
  const path = req.url || '/api/menu-builder';

  if (!restaurantId) {
    return res.status(400).json({ message: 'restaurant_id is required' });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('menu_drafts')
        .select('draft, version, updated_at')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) {
        console.error('[draft:load]', { path, restaurantId, error });
        return res
          .status(500)
          .json({ message: error.message });
      }

      if (!data) {
        const { data: inserted, error: insertErr } = await supabase
          .from('menu_drafts')
          .insert({ restaurant_id: restaurantId, draft: {} })
          .select('draft, version, updated_at')
          .single();
        if (insertErr) {
          console.error('[draft:init]', { path, restaurantId, error: insertErr });
          return res.status(500).json({ message: insertErr.message });
        }
        return res.status(200).json(inserted);
      }
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const draft = (req.body as { draft?: DraftPayload }).draft;
      if (!draft) return res.status(400).json({ message: 'draft is required' });

      const { data, error } = await supabase
        .from('menu_drafts')
        .upsert({ restaurant_id: restaurantId, draft }, { onConflict: 'restaurant_id' })
        .select('draft, version, updated_at')
        .single();

      if (error) {
        console.error('[draft:save]', { path, restaurantId, error });
        return res.status(500).json({ message: error.message });
      }
      return res.status(200).json(data);
    }

    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).end('Method Not Allowed');
  } catch (e: any) {
    console.error('[draft:unhandled]', { path, restaurantId, error: e });
    return res.status(500).json({ message: e?.message || 'server_error' });
  }
}

